import type { FastifyRequest, FastifyReply } from 'fastify';
import { TierLimitError } from '../lib/errors.js';
import { countOrgContracts } from '../db/queries/contracts.queries.js';
import { getCachedUserTier } from '../lib/cache.js';
import { query } from '../db/client.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('middleware.tierLimit');

// ─── Tier Limits ─────────────────────────────────────────────
// Matches the business model from the product vision:
//   Free/Starter: $49/month → 5 contracts
//   Pro:          $199/month → 50 contracts
//   Enterprise:   $499/month → unlimited

const TIER_LIMITS: Record<string, number> = {
    free: 5,
    starter: 5,
    pro: 50,
    enterprise: Infinity,
};

/**
 * Get the contract upload limit for a given tier.
 */
export function getTierLimit(tier: string): number {
    return TIER_LIMITS[tier.toLowerCase()] ?? TIER_LIMITS.free!;
}

/**
 * Middleware: checkTierLimit
 *
 * Enforces contract upload limits based on the organization's
 * subscription tier. Must be used AFTER `authenticate` and `requireOrg`.
 *
 * Returns 402 (Payment Required) if the org has reached its limit.
 *
 * Usage:
 * ```ts
 * fastify.post('/api/v1/contracts/upload', {
 *   preHandler: [authenticate, requireOrg, checkTierLimit],
 * }, uploadHandler);
 * ```
 */
export async function checkTierLimit(
    request: FastifyRequest,
    _reply: FastifyReply,
): Promise<void> {
    const { user } = request;

    if (!user?.orgId) {
        // This should never happen if used after requireOrg,
        // but guard defensively
        throw new TierLimitError('unknown', 0);
    }

    // Get the org's subscription tier (cached for 15 min)
    const tier = await getCachedUserTier(user.orgId, async () => {
        return await fetchOrgTier(user.orgId!);
    });

    const limit = getTierLimit(tier);

    // Enterprise = unlimited, skip the count query
    if (limit === Infinity) {
        log.debug({ orgId: user.orgId, tier }, 'Enterprise tier — no limit');
        return;
    }

    // Count current active (non-archived) contracts
    const currentCount = await countOrgContracts(user.orgId);

    if (currentCount >= limit) {
        log.warn(
            { orgId: user.orgId, tier, currentCount, limit },
            'Tier limit reached — upload blocked',
        );
        throw new TierLimitError(tier, limit);
    }

    log.debug(
        { orgId: user.orgId, tier, currentCount, limit, remaining: limit - currentCount },
        'Tier limit check passed',
    );
}

/**
 * Middleware factory: checkUploadRateLimit
 *
 * Enforces daily upload limits in addition to total contract limits.
 * Free: 5 uploads/day, Pro: 50/day, Enterprise: unlimited
 *
 * Usage:
 * ```ts
 * fastify.post('/api/v1/contracts/upload', {
 *   preHandler: [authenticate, requireOrg, checkTierLimit, checkUploadRateLimit()],
 * }, uploadHandler);
 * ```
 */
export function checkUploadRateLimit() {
    const DAILY_LIMITS: Record<string, number> = {
        free: 5,
        starter: 5,
        pro: 50,
        enterprise: Infinity,
    };

    return async function dailyLimitCheck(
        request: FastifyRequest,
        _reply: FastifyReply,
    ): Promise<void> {
        const { user } = request;
        if (!user?.orgId) return;

        const tier = user.tier ?? 'free';
        const dailyLimit = DAILY_LIMITS[tier.toLowerCase()] ?? DAILY_LIMITS.free!;

        if (dailyLimit === Infinity) return;

        // Count today's uploads
        const result = await query<{ count: string }>(
            `SELECT COUNT(*) as count FROM contracts
       WHERE org_id = $1 AND created_at >= CURRENT_DATE`,
            [user.orgId],
        );
        const todayCount = parseInt(result.rows[0]!.count, 10);

        if (todayCount >= dailyLimit) {
            log.warn(
                { orgId: user.orgId, tier, todayCount, dailyLimit },
                'Daily upload limit reached',
            );
            throw new TierLimitError(tier, dailyLimit);
        }
    };
}

// ─── Internal Helper ─────────────────────────────────────────

/**
 * Fetch the subscription tier for an org from the database.
 */
async function fetchOrgTier(orgId: string): Promise<string> {
    const result = await query<{ subscription_tier: string }>(
        `SELECT subscription_tier FROM organizations WHERE id = $1`,
        [orgId],
    );
    return result.rows[0]?.subscription_tier ?? 'free';
}

export default checkTierLimit;
