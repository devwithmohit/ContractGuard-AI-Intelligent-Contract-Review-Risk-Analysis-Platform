/**
 * POST /api/v1/auth/setup
 *
 * Idempotent user setup endpoint — called after every successful auth.
 * Creates an organization + org_member record for new users.
 *
 * Flow:
 *   1. Verify JWT (authenticate middleware)
 *   2. Check if user is already in an org (org_members table)
 *   3. If not → create org, add as owner, update Supabase app_metadata
 *   4. Return user profile with org details
 *
 * Auth: Bearer JWT → authenticate
 * Returns: { user: { id, email, orgId, orgName, role, tier } }
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { query, transaction } from '../../../db/client.js';
import { createLogger } from '../../../lib/logger.js';
import { createClient } from '@supabase/supabase-js';
import { cacheInvalidatePattern } from '../../../lib/cache.js';

const log = createLogger('route.auth.setup');

interface OrgRecord {
    id: string;
    name: string;
    subscription_tier: string;
}

interface OrgMemberRecord {
    org_id: string;
    role: 'owner' | 'admin' | 'member';
}

export default async function authSetupRoute(fastify: FastifyInstance) {
    // ── POST /auth/setup — idempotent user initialization ─────
    fastify.post('/auth/setup', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { id: userId, email } = request.user;

        log.info({ userId, email }, 'Auth setup requested');

        // ── Check existing org membership ──────────────────────
        const existingResult = await query<OrgMemberRecord & { org_name: string; subscription_tier: string }>(
            `SELECT om.org_id, om.role, o.name AS org_name, o.subscription_tier
             FROM org_members om
             JOIN organizations o ON om.org_id = o.id
             WHERE om.user_id = $1
             LIMIT 1`,
            [userId],
        );

        if (existingResult.rows[0]) {
            // User already has an org — return profile
            const row = existingResult.rows[0];
            log.debug({ userId, orgId: row.org_id }, 'User already has org — returning profile');

            return reply.send({
                user: {
                    id: userId,
                    email,
                    orgId: row.org_id,
                    orgName: row.org_name,
                    role: row.role,
                    tier: row.subscription_tier,
                },
            });
        }

        // ── Create org + membership in a transaction ────────────
        log.info({ userId, email }, 'New user — creating organization');

        const orgName = email
            ? `${email.split('@')[0]}'s Organization`
            : 'My Organization';

        const newOrg = await transaction(async (client) => {
            // Create organization
            const orgResult = await client.query<OrgRecord>(
                `INSERT INTO organizations (name, subscription_tier)
                 VALUES ($1, 'free')
                 RETURNING id, name, subscription_tier`,
                [orgName],
            );
            const org = orgResult.rows[0]!;

            // Add user as owner
            await client.query(
                `INSERT INTO org_members (org_id, user_id, role)
                 VALUES ($1, $2, 'owner')`,
                [org.id, userId],
            );

            return org;
        });

        // ── Update Supabase app_metadata with org_id ────────────
        try {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

            if (supabaseUrl && supabaseServiceKey) {
                const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
                    auth: { autoRefreshToken: false, persistSession: false },
                });

                await adminClient.auth.admin.updateUserById(userId, {
                    app_metadata: {
                        org_id: newOrg.id,
                        tier: 'free',
                    },
                });

                log.info({ userId, orgId: newOrg.id }, 'Updated Supabase app_metadata');
            }
        } catch (err) {
            // Non-fatal — the requireOrg middleware will fall back to DB lookup
            log.warn({ err, userId }, 'Failed to update app_metadata (non-fatal)');
        }

        // Invalidate any cached org lookups for this user
        await cacheInvalidatePattern(`orgmember:${userId}*`).catch(() => {});

        log.info({ userId, orgId: newOrg.id, orgName: newOrg.name }, 'Organization created for new user');

        return reply.status(201).send({
            user: {
                id: userId,
                email,
                orgId: newOrg.id,
                orgName: newOrg.name,
                role: 'owner',
                tier: 'free',
            },
        });
    });

    // ── GET /auth/me — return current user profile ────────────
    fastify.get('/auth/me', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const { id: userId, email } = request.user;

        const result = await query<{
            org_id: string;
            role: string;
            org_name: string;
            subscription_tier: string;
        }>(
            `SELECT om.org_id, om.role, o.name AS org_name, o.subscription_tier
             FROM org_members om
             JOIN organizations o ON om.org_id = o.id
             WHERE om.user_id = $1
             LIMIT 1`,
            [userId],
        );

        const row = result.rows[0];

        return reply.send({
            user: {
                id: userId,
                email,
                orgId: row?.org_id ?? null,
                orgName: row?.org_name ?? null,
                role: row?.role ?? null,
                tier: row?.subscription_tier ?? null,
            },
        });
    });
}
