import { Worker, type Job } from 'bullmq';
import { getRedisOptions } from '../lib/redis.js';
import { createLogger } from '../lib/logger.js';
import { QUEUE_NAMES, type AlertCheckJobData } from '../services/queue.service.js';
import { query } from '../db/client.js';
import type { Contract } from '../db/queries/contracts.queries.js';

const log = createLogger('worker.alertCheck');

// ─── Types ───────────────────────────────────────────────────

interface AlertRow {
    org_id: string;
    contract_id: string;
    alert_type: string;
    message: string;
    trigger_date: string;
}

// ─── Processor ───────────────────────────────────────────────

/**
 * Alert Check Worker
 *
 * Daily cron job (08:00 UTC) that:
 *  1. Queries contracts expiring in the next 90/60/30/14/7 days
 *  2. Creates alert records for each milestone (idempotent via unique index)
 *  3. Sends email notifications via Resend
 *  4. Sends Slack alerts for critical risk contracts
 *
 * Idempotency: the DB unique index on (contract_id, alert_type, trigger_date)
 * prevents duplicate alerts even if the job runs multiple times.
 */
async function processAlertCheck(job: Job<AlertCheckJobData>): Promise<void> {
    const { daysBeforeExpiry, runId } = job.data;

    log.info({ jobId: job.id, runId, daysBeforeExpiry }, '▶ Starting alert check');

    await job.updateProgress({ step: 1, label: 'Querying expiring contracts', total: 4 });

    // ── Step 1: Find contracts expiring within the alert window ──
    const expiringContracts = await findExpiringContracts(daysBeforeExpiry);

    log.info(
        { runId, contractCount: expiringContracts.length },
        `Found ${expiringContracts.length} expiring contracts`,
    );

    if (expiringContracts.length === 0) {
        log.info({ runId }, 'No expiring contracts — alert check complete');
        return;
    }

    // ── Step 2: Build alert records ───────────────────────────
    await job.updateProgress({ step: 2, label: 'Creating alert records', total: 4 });

    const alertsToCreate: AlertRow[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const contract of expiringContracts) {
        if (!contract.expiration_date) continue;

        const daysUntilExpiry = getDaysUntil(contract.expiration_date);
        const milestones = getAlertMilestones(daysUntilExpiry);

        for (const milestone of milestones) {
            const alertType = milestone.days <= 7 ? 'expiration' : 'renewal';
            const message = buildAlertMessage(contract, daysUntilExpiry, milestone.days);

            alertsToCreate.push({
                org_id: contract.org_id,
                contract_id: contract.id,
                alert_type: alertType,
                message,
                trigger_date: today,
            });
        }
    }

    // Insert alerts (ON CONFLICT DO NOTHING for idempotency)
    const createdCount = await upsertAlerts(alertsToCreate);

    log.info({ runId, alertsRequested: alertsToCreate.length, alertsCreated: createdCount }, 'Alerts created');

    // ── Step 3: Send email notifications ──────────────────────
    await job.updateProgress({ step: 3, label: 'Sending email notifications', total: 4 });

    const emailsSent = await sendAlertEmails(expiringContracts);
    log.info({ runId, emailsSent }, 'Alert emails dispatched');

    // ── Step 4: Send Slack for critical risk contracts ────────
    await job.updateProgress({ step: 4, label: 'Sending Slack notifications', total: 4 });

    const criticalContracts = expiringContracts.filter(
        (c) => (c.risk_score ?? 0) >= 75 && getDaysUntil(c.expiration_date!) <= 30,
    );

    if (criticalContracts.length > 0) {
        await sendSlackAlerts(criticalContracts);
        log.info({ runId, slackCount: criticalContracts.length }, 'Slack alerts sent for critical contracts');
    }

    log.info(
        {
            runId,
            jobId: job.id,
            contractsChecked: expiringContracts.length,
            alertsCreated: createdCount,
            emailsSent,
            slackAlerts: criticalContracts.length,
        },
        '✅ Alert check complete',
    );
}

// ─── DB Helpers ───────────────────────────────────────────────

async function findExpiringContracts(daysAhead: number): Promise<Contract[]> {
    const result = await query<Contract>(
        `SELECT * FROM contracts
         WHERE status = 'active'
           AND expiration_date IS NOT NULL
           AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::interval
         ORDER BY expiration_date ASC`,
        [`${daysAhead} days`],
    );
    return result.rows;
}

async function upsertAlerts(alerts: AlertRow[]): Promise<number> {
    if (alerts.length === 0) return 0;

    let totalInserted = 0;

    // Insert one at a time to use ON CONFLICT correctly
    for (const alert of alerts) {
        const result = await query(
            `INSERT INTO alerts (org_id, contract_id, alert_type, message, trigger_date)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (contract_id, alert_type, trigger_date) DO NOTHING`,
            [alert.org_id, alert.contract_id, alert.alert_type, alert.message, alert.trigger_date],
        );
        totalInserted += result.rowCount ?? 0;
    }

    return totalInserted;
}

// ─── Notification Helpers ─────────────────────────────────────

async function sendAlertEmails(contracts: Contract[]): Promise<number> {
    const resendKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM ?? 'alerts@contractguard.app';

    if (!resendKey) {
        log.warn('RESEND_API_KEY not set — skipping email notifications');
        return 0;
    }

    let sent = 0;

    // Group contracts by org_id to batch lookup emails
    const orgIds = [...new Set(contracts.map((c) => c.org_id))];
    const orgEmailMap = new Map<string, string>();

    for (const orgId of orgIds) {
        try {
            const result = await query<{ email: string }>(
                `SELECT u.email FROM org_members om
                 JOIN auth.users u ON om.user_id = u.id
                 WHERE om.org_id = $1 AND om.role = 'owner'
                 LIMIT 1`,
                [orgId],
            );
            if (result.rows[0]?.email) {
                orgEmailMap.set(orgId, result.rows[0].email);
            }
        } catch (err) {
            // Fallback: if auth.users isn't accessible via service role,
            // try looking up from Supabase admin API
            log.debug({ err, orgId }, 'Could not query auth.users directly — using fallback');
            try {
                const supabaseUrl = process.env.SUPABASE_URL;
                const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
                if (supabaseUrl && supabaseKey) {
                    const memberResult = await query<{ user_id: string }>(
                        `SELECT user_id FROM org_members WHERE org_id = $1 AND role = 'owner' LIMIT 1`,
                        [orgId],
                    );
                    if (memberResult.rows[0]?.user_id) {
                        const { createClient } = await import('@supabase/supabase-js');
                        const adminClient = createClient(supabaseUrl, supabaseKey, {
                            auth: { autoRefreshToken: false, persistSession: false },
                        });
                        const { data } = await adminClient.auth.admin.getUserById(memberResult.rows[0].user_id);
                        if (data?.user?.email) {
                            orgEmailMap.set(orgId, data.user.email);
                        }
                    }
                }
            } catch (fallbackErr) {
                log.warn({ fallbackErr, orgId }, 'Could not look up org owner email');
            }
        }
    }

    for (const contract of contracts) {
        const toEmail = orgEmailMap.get(contract.org_id);
        if (!toEmail) {
            log.debug({ contractId: contract.id, orgId: contract.org_id }, 'No email found for org — skipping');
            continue;
        }

        const daysUntil = getDaysUntil(contract.expiration_date!);
        const urgency = daysUntil <= 7 ? 'URGENT: ' : daysUntil <= 14 ? 'Action Required: ' : '';

        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${resendKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: emailFrom,
                    to: toEmail,
                    subject: `${urgency}Contract Expiring in ${daysUntil} Days: ${contract.name}`,
                    html: buildEmailHtml(contract, daysUntil),
                }),
                signal: AbortSignal.timeout(10_000),
            });

            if (response.ok) sent++;
            else {
                const body = await response.text();
                log.warn({ contractId: contract.id, status: response.status, body }, 'Email send failed');
            }
        } catch (err) {
            log.warn({ err, contractId: contract.id }, 'Email send error (non-fatal)');
        }
    }

    return sent;
}

async function sendSlackAlerts(contracts: Contract[]): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
        log.debug('SLACK_WEBHOOK_URL not set — skipping Slack alerts');
        return;
    }

    for (const contract of contracts) {
        const daysUntil = getDaysUntil(contract.expiration_date!);

        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    blocks: [
                        {
                            type: 'header',
                            text: {
                                type: 'plain_text',
                                text: `🚨 Critical Contract Expiring Soon`,
                            },
                        },
                        {
                            type: 'section',
                            fields: [
                                { type: 'mrkdwn', text: `*Contract:*\n${contract.name}` },
                                { type: 'mrkdwn', text: `*Type:*\n${contract.type}` },
                                { type: 'mrkdwn', text: `*Expires in:*\n${daysUntil} days` },
                                { type: 'mrkdwn', text: `*Risk Score:*\n${contract.risk_score ?? 'N/A'}/100` },
                            ],
                        },
                    ],
                }),
                signal: AbortSignal.timeout(10_000),
            });
        } catch (err) {
            log.warn({ err, contractId: contract.id }, 'Slack notification error (non-fatal)');
        }
    }
}

// ─── Utility Functions ────────────────────────────────────────

function getDaysUntil(dateStr: string): number {
    const target = new Date(dateStr).getTime();
    const now = new Date().getTime();
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function getAlertMilestones(daysUntil: number): Array<{ days: number }> {
    const thresholds = [90, 60, 30, 14, 7];
    return thresholds
        .filter((t) => daysUntil <= t && daysUntil > (t === 90 ? 60 : t === 60 ? 30 : t === 30 ? 14 : t === 14 ? 7 : 0))
        .map((days) => ({ days }));
}

function buildAlertMessage(contract: Contract, daysUntil: number, threshold: number): string {
    const urgency = daysUntil <= 7 ? 'URGENT: ' : '';
    return `${urgency}${contract.name} (${contract.type}) expires in ${daysUntil} days on ${contract.expiration_date}. ${contract.auto_renewal ? 'Auto-renewal is enabled.' : 'Manual renewal required.'}`;
}

function buildEmailHtml(contract: Contract, daysUntil: number): string {
    const urgencyColor = daysUntil <= 7 ? '#ef4444' : daysUntil <= 14 ? '#f97316' : '#eab308';

    return `
<!DOCTYPE html>
<html>
<body style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: ${urgencyColor}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0;">Contract Expiring in ${daysUntil} Days</h2>
  </div>
  <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
    <p><strong>Contract:</strong> ${contract.name}</p>
    <p><strong>Type:</strong> ${contract.type}</p>
    <p><strong>Counterparty:</strong> ${contract.counterparty ?? 'N/A'}</p>
    <p><strong>Expiration Date:</strong> ${contract.expiration_date}</p>
    <p><strong>Risk Score:</strong> ${contract.risk_score ?? 'N/A'}/100</p>
    <p><strong>Auto-Renewal:</strong> ${contract.auto_renewal ? 'Yes' : 'No'}</p>
    ${contract.summary ? `<p><strong>Summary:</strong> ${contract.summary}</p>` : ''}
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="color: #6b7280; font-size: 14px;">
      This alert was sent by ContractGuard AI. Review this contract at your dashboard.
    </p>
  </div>
</body>
</html>`;
}

// ─── Worker Factory ───────────────────────────────────────────

/**
 * Create and start the alert check worker.
 * Call this once at startup.
 */
export function startAlertCheckWorker(): Worker<AlertCheckJobData> {
    const worker = new Worker<AlertCheckJobData>(
        QUEUE_NAMES.ALERT_CHECK,
        processAlertCheck,
        {
            connection: getRedisOptions(),
            concurrency: 1, // Alert checks are singleton — no parallel runs
            stalledInterval: 60_000,
            maxStalledCount: 1,
            lockDuration: 300_000, // 5-min lock for long-running cron
            lockRenewTime: 60_000,
        },
    );

    worker.on('completed', (job) => {
        log.info({ jobId: job.id, runId: job.data.runId }, 'Alert check completed');
    });

    worker.on('failed', (job, err) => {
        log.error(
            { jobId: job?.id, runId: job?.data.runId, err },
            `Alert check failed (attempt ${job?.attemptsMade})`,
        );
    });

    worker.on('error', (err) => {
        log.error({ err }, 'Alert check worker error');
    });

    log.info({ queue: QUEUE_NAMES.ALERT_CHECK }, '🚀 Alert check worker started');

    return worker;
}

export default startAlertCheckWorker;
