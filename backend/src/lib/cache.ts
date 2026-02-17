import { getRedis } from './redis.js';
import { createLogger } from './logger.js';

const log = createLogger('cache');

// ─── Cache Key Prefixes ──────────────────────────────────────
export const CachePrefix = {
    RISK_ANALYSIS: 'risk:',
    SUMMARY: 'summary:',
    SEARCH: 'search:',
    DASHBOARD: 'dash:',
    USER_TIER: 'tier:',
    RATE_LIMIT: 'rl:',
    SIGNED_URL: 'url:',
} as const;

// ─── Default TTLs (in seconds) ───────────────────────────────
export const CacheTTL = {
    RISK_ANALYSIS: 7 * 24 * 60 * 60,    // 7 days
    SUMMARY: 24 * 60 * 60,               // 24 hours
    SEARCH: 60 * 60,                      // 1 hour
    DASHBOARD: 60 * 60,                   // 1 hour
    USER_TIER: 15 * 60,                   // 15 minutes
    SIGNED_URL: 60 * 60,                  // 1 hour
} as const;

// ─── Core Cache Operations ───────────────────────────────────

/**
 * Get a cached value. Returns null on miss.
 * Automatically deserializes JSON.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
    try {
        const raw = await getRedis().get(key);
        if (!raw) return null;

        log.debug({ key }, 'Cache HIT');
        return JSON.parse(raw) as T;
    } catch (err) {
        log.warn({ key, err }, 'Cache GET error (returning null)');
        return null;
    }
}

/**
 * Set a cached value with TTL.
 * Automatically serializes to JSON.
 */
export async function cacheSet<T>(
    key: string,
    value: T,
    ttlSeconds: number,
): Promise<void> {
    try {
        const serialized = JSON.stringify(value);
        await getRedis().setex(key, ttlSeconds, serialized);
        log.debug({ key, ttlSeconds }, 'Cache SET');
    } catch (err) {
        log.warn({ key, err }, 'Cache SET error (non-fatal)');
    }
}

/**
 * Delete a cached key.
 */
export async function cacheDel(key: string): Promise<void> {
    try {
        await getRedis().del(key);
        log.debug({ key }, 'Cache DEL');
    } catch (err) {
        log.warn({ key, err }, 'Cache DEL error (non-fatal)');
    }
}

/**
 * Delete all keys matching a pattern.
 * Useful for invalidating all entries for a contract or org.
 *
 * @example
 * ```ts
 * // Invalidate all risk caches for a contract
 * await cacheInvalidatePattern(`risk:${contractId}*`);
 * ```
 */
export async function cacheInvalidatePattern(pattern: string): Promise<number> {
    try {
        const redis = getRedis();
        // Note: keyPrefix is already added by ioredis, so we need the raw pattern
        const keys = await redis.keys(pattern);

        if (keys.length === 0) return 0;

        // Remove the keyPrefix before deleting since ioredis adds it automatically
        const pipeline = redis.pipeline();
        for (const key of keys) {
            // Keys returned by keys() include the prefix, but del() adds it again
            // So we strip the prefix for the del command
            const strippedKey = key.replace(/^cg:/, '');
            pipeline.del(strippedKey);
        }
        await pipeline.exec();

        log.debug({ pattern, count: keys.length }, 'Cache pattern invalidation');
        return keys.length;
    } catch (err) {
        log.warn({ pattern, err }, 'Cache pattern invalidation error');
        return 0;
    }
}

// ─── Convenience Helpers ─────────────────────────────────────

/**
 * Get-or-set: returns cached value if present, otherwise calls the
 * factory function and caches the result.
 *
 * @example
 * ```ts
 * const stats = await cacheGetOrSet(
 *   `${CachePrefix.DASHBOARD}${orgId}`,
 *   () => computeDashboardStats(orgId),
 *   CacheTTL.DASHBOARD,
 * );
 * ```
 */
export async function cacheGetOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number,
): Promise<T> {
    const cached = await cacheGet<T>(key);
    if (cached !== null) return cached;

    log.debug({ key }, 'Cache MISS — computing value');
    const value = await factory();
    await cacheSet(key, value, ttlSeconds);
    return value;
}

// ─── Contract-Specific Cache Helpers ─────────────────────────

/**
 * Build a deterministic cache key for search queries.
 * Uses SHA-256 hash of the query + orgId for uniqueness.
 */
export function buildSearchCacheKey(queryText: string, orgId: string): string {
    const hash = Bun.hash(queryText + orgId).toString(16);
    return `${CachePrefix.SEARCH}${hash}`;
}

/**
 * Invalidate all caches related to a contract.
 * Called after re-analysis completes.
 */
export async function invalidateContractCaches(contractId: string): Promise<void> {
    await Promise.all([
        cacheDel(`${CachePrefix.RISK_ANALYSIS}${contractId}`),
        cacheDel(`${CachePrefix.SUMMARY}${contractId}`),
    ]);
    log.info({ contractId }, 'Contract caches invalidated');
}

/**
 * Invalidate all dashboard caches for an org.
 * Called when contracts are added, analyzed, or deleted.
 */
export async function invalidateDashboardCache(orgId: string): Promise<void> {
    await cacheDel(`${CachePrefix.DASHBOARD}${orgId}`);
    log.debug({ orgId }, 'Dashboard cache invalidated');
}

/**
 * Cache and retrieve user tier info (avoids per-request DB hit).
 */
export async function getCachedUserTier(
    orgId: string,
    fetchTier: () => Promise<string>,
): Promise<string> {
    return cacheGetOrSet(
        `${CachePrefix.USER_TIER}${orgId}`,
        fetchTier,
        CacheTTL.USER_TIER,
    );
}

export default {
    cacheGet,
    cacheSet,
    cacheDel,
    cacheInvalidatePattern,
    cacheGetOrSet,
    buildSearchCacheKey,
    invalidateContractCaches,
    invalidateDashboardCache,
    getCachedUserTier,
    CachePrefix,
    CacheTTL,
};
