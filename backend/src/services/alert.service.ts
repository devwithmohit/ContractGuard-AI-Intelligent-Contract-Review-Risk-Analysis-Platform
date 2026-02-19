import { createLogger } from '../lib/logger.js';
import { cacheGetOrSet, cacheInvalidatePattern } from '../lib/cache.js';
import { query } from '../db/client.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';

const log = createLogger('service.alert');

// ─── TTLs ────────────────────────────────────────────────────

const TTL_ALERT_LIST = 60;  // 1 min
const TTL_UNREAD_COUNT = 30;  // 30s — badge refresh

// ─── Types ───────────────────────────────────────────────────

export type AlertType = 'expiration' | 'renewal' | 'risk' | 'compliance';

export interface Alert {
    id: string;
    org_id: string;
    contract_id: string;
    alert_type: AlertType;
    message: string;
    trigger_date: string;
    is_read: boolean;
    snoozed_until: string | null;
    created_at: string;
    // Joined from contracts table
    contract_name?: string;
    contract_type?: string;
    risk_score?: number | null;
    expiration_date?: string | null;
}

export interface AlertListFilters {
    orgId: string;
    alertType?: AlertType;
    isRead?: boolean;
    contractId?: string;
    page?: number;
    limit?: number;
    includeSnoozed?: boolean;
}

// ─── Queries (inline — alerts don't need a full queries file yet) ─

async function queryAlerts(filters: AlertListFilters): Promise<{
    data: Alert[];
    total: number;
}> {
    const {
        orgId,
        alertType,
        isRead,
        contractId,
        page = 1,
        limit = 20,
        includeSnoozed = false,
    } = filters;

    const conditions: string[] = ['a.org_id = $1'];
    const params: unknown[] = [orgId];
    let idx = 2;

    if (alertType) {
        conditions.push(`a.alert_type = $${idx}`);
        params.push(alertType);
        idx++;
    }

    if (isRead !== undefined) {
        conditions.push(`a.is_read = $${idx}`);
        params.push(isRead);
        idx++;
    }

    if (contractId) {
        conditions.push(`a.contract_id = $${idx}`);
        params.push(contractId);
        idx++;
    }

    // Exclude currently-snoozed alerts unless requested
    if (!includeSnoozed) {
        conditions.push(`(a.snoozed_until IS NULL OR a.snoozed_until < NOW())`);
    }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    // Count
    const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM alerts a WHERE ${where}`,
        params,
    );
    const total = parseInt(countResult.rows[0]!.count, 10);

    // Data (joined with contract metadata)
    const dataResult = await query<Alert>(
        `SELECT
           a.*,
           c.name AS contract_name,
           c.type AS contract_type,
           c.risk_score,
           c.expiration_date
         FROM alerts a
         JOIN contracts c ON a.contract_id = c.id
         WHERE ${where}
         ORDER BY a.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
    );

    return { data: dataResult.rows, total };
}

// ─── Service Methods ──────────────────────────────────────────

/**
 * List alerts for an org with optional filtering and pagination.
 */
export async function listAlerts(filters: AlertListFilters) {
    const { orgId, page = 1, limit = 20, ...rest } = filters;
    const cacheKey = `alerts:list:${orgId}:${JSON.stringify({ page, limit, ...rest })}`;

    const result = await cacheGetOrSet(
        cacheKey,
        () => queryAlerts(filters),
        TTL_ALERT_LIST,
    );

    return {
        data: result.data,
        pagination: {
            page: filters.page ?? 1,
            limit: filters.limit ?? 20,
            total: result.total,
            totalPages: Math.ceil(result.total / (filters.limit ?? 20)),
        },
    };
}

/**
 * Get unread alert count for an org.
 * Used for badge display in the frontend.
 */
export async function getUnreadCount(orgId: string): Promise<number> {
    return cacheGetOrSet(
        `alerts:unread:${orgId}`,
        async () => {
            const result = await query<{ count: string }>(
                `SELECT COUNT(*) as count FROM alerts
                 WHERE org_id = $1
                   AND is_read = false
                   AND (snoozed_until IS NULL OR snoozed_until < NOW())`,
                [orgId],
            );
            return parseInt(result.rows[0]!.count, 10);
        },
        TTL_UNREAD_COUNT,
    );
}

/**
 * Mark one or more alerts as read.
 * Passing alertIds = [] marks all org alerts as read.
 */
export async function markAlertsRead(
    orgId: string,
    alertIds: string[],
): Promise<number> {
    let result;

    if (alertIds.length === 0) {
        // Mark all
        result = await query(
            `UPDATE alerts SET is_read = true WHERE org_id = $1 AND is_read = false`,
            [orgId],
        );
    } else {
        result = await query(
            `UPDATE alerts SET is_read = true
             WHERE org_id = $1 AND id = ANY($2::uuid[]) AND is_read = false`,
            [orgId, alertIds],
        );
    }

    const updated = result.rowCount ?? 0;

    if (updated > 0) {
        await Promise.all([
            cacheInvalidatePattern(`alerts:list:${orgId}:*`),
            cacheInvalidatePattern(`alerts:unread:${orgId}`),
        ]);
        log.info({ orgId, updated, alertIds }, 'Alerts marked as read');
    }

    return updated;
}

/**
 * Snooze an alert until a specified date.
 * Snoozed alerts are excluded from list results by default.
 */
export async function snoozeAlert(
    alertId: string,
    orgId: string,
    snoozedUntil: Date,
): Promise<Alert> {
    // Validate snooze date
    if (snoozedUntil <= new Date()) {
        throw new ValidationError('snoozed_until must be in the future');
    }

    const maxSnooze = new Date();
    maxSnooze.setDate(maxSnooze.getDate() + 365);
    if (snoozedUntil > maxSnooze) {
        throw new ValidationError('Cannot snooze an alert for more than 365 days');
    }

    const result = await query<Alert>(
        `UPDATE alerts
         SET snoozed_until = $1, is_read = true
         WHERE id = $2 AND org_id = $3
         RETURNING *`,
        [snoozedUntil.toISOString(), alertId, orgId],
    );

    if (!result.rows[0]) {
        throw new NotFoundError('Alert', alertId);
    }

    await Promise.all([
        cacheInvalidatePattern(`alerts:list:${orgId}:*`),
        cacheInvalidatePattern(`alerts:unread:${orgId}`),
    ]);

    log.info(
        { alertId, orgId, snoozedUntil: snoozedUntil.toISOString() },
        'Alert snoozed',
    );

    return result.rows[0];
}

/**
 * Dismiss (permanently delete) an alert.
 */
export async function dismissAlert(alertId: string, orgId: string): Promise<void> {
    const result = await query(
        `DELETE FROM alerts WHERE id = $1 AND org_id = $2`,
        [alertId, orgId],
    );

    if (!result.rowCount || result.rowCount === 0) {
        throw new NotFoundError('Alert', alertId);
    }

    await Promise.all([
        cacheInvalidatePattern(`alerts:list:${orgId}:*`),
        cacheInvalidatePattern(`alerts:unread:${orgId}`),
    ]);

    log.info({ alertId, orgId }, 'Alert dismissed');
}

/**
 * Get a single alert by ID (org-scoped).
 */
export async function getAlertById(alertId: string, orgId: string): Promise<Alert> {
    const result = await query<Alert>(
        `SELECT a.*, c.name AS contract_name, c.type AS contract_type,
                c.risk_score, c.expiration_date
         FROM alerts a
         JOIN contracts c ON a.contract_id = c.id
         WHERE a.id = $1 AND a.org_id = $2`,
        [alertId, orgId],
    );

    if (!result.rows[0]) {
        throw new NotFoundError('Alert', alertId);
    }

    return result.rows[0];
}

export default {
    listAlerts,
    getUnreadCount,
    markAlertsRead,
    snoozeAlert,
    dismissAlert,
    getAlertById,
};
