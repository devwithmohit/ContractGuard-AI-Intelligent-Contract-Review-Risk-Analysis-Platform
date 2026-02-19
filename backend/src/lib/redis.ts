import Redis from 'ioredis';
import { createLogger } from './logger.js';

const log = createLogger('redis');

// ─── BullMQ Connection Options ───────────────────────────────
// BullMQ bundles its own ioredis, so passing our Redis instance
// causes a structural type conflict. Instead we export plain options
// that BullMQ's ioredis can use to build its own connection.
export interface BullMQConnectionOptions {
    host: string;
    port: number;
    password?: string;
    tls?: Record<string, unknown>;
    maxRetriesPerRequest: null; // BullMQ requires null (not a number)
    enableReadyCheck: boolean;
    enableOfflineQueue: boolean;
}

/**
 * Return plain connection options for BullMQ Queues and Workers.
 * Do NOT pass the Redis singleton — BullMQ creates its own connections.
 */
export function getRedisOptions(): BullMQConnectionOptions {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL environment variable is not set');

    // Parse redis[s]://[:password@]host[:port][/db]
    const parsed = new URL(url);
    const isTLS = parsed.protocol === 'rediss:';

    return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '6379', 10),
        password: parsed.password || undefined,
        tls: isTLS ? {} : undefined,
        maxRetriesPerRequest: null,   // Required by BullMQ
        enableReadyCheck: false,      // Required by BullMQ
        enableOfflineQueue: false,
    };
}

// ─── Singleton Instance ──────────────────────────────────────
let redis: Redis | null = null;

/**
 * Get or create the Redis client singleton.
 * Uses Upstash Redis (TLS connection via rediss:// URL).
 */
export function getRedis(): Redis {
    if (!redis) {
        const url = process.env.REDIS_URL;
        if (!url) {
            throw new Error('REDIS_URL environment variable is not set');
        }

        redis = new Redis(url, {
            // Connection settings
            maxRetriesPerRequest: 3,
            retryStrategy(times: number) {
                if (times > 5) {
                    log.error({ retryAttempt: times }, 'Redis max retries reached, giving up');
                    return null; // Stop retrying
                }
                const delay = Math.min(times * 200, 2000);
                log.warn({ retryAttempt: times, delayMs: delay }, 'Redis reconnecting...');
                return delay;
            },

            // TLS for Upstash
            tls: url.startsWith('rediss://') ? {} : undefined,

            // Timeouts
            connectTimeout: 5000,
            commandTimeout: 3000,

            // Disable offline queue to fail fast when disconnected
            enableOfflineQueue: false,

            // Key prefix to namespace all ContractGuard keys
            keyPrefix: 'cg:',

            // Lazy connect — don't connect until first command
            lazyConnect: true,
        });

        // Lifecycle events
        redis.on('connect', () => {
            log.info('Redis connected');
        });

        redis.on('ready', () => {
            log.info('Redis ready to accept commands');
        });

        redis.on('error', (err) => {
            log.error({ err }, 'Redis connection error');
        });

        redis.on('close', () => {
            log.warn('Redis connection closed');
        });

        redis.on('reconnecting', (delay: number) => {
            log.info({ delayMs: delay }, 'Redis reconnecting');
        });
    }

    return redis;
}

/**
 * Health check — tests Redis connectivity.
 * Returns latency in milliseconds.
 */
export async function healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    try {
        const client = getRedis();
        const start = performance.now();
        const pong = await client.ping();
        const latencyMs = Math.round(performance.now() - start);
        return { ok: pong === 'PONG', latencyMs };
    } catch {
        return { ok: false, latencyMs: -1 };
    }
}

/**
 * Gracefully disconnect Redis.
 * Call this on process exit.
 */
export async function closeRedis(): Promise<void> {
    if (redis) {
        log.info('Closing Redis connection...');
        try {
            await redis.quit();
        } catch {
            // If Redis never connected (lazyConnect), quit() fails.
            // Use disconnect() which doesn't send a command over the wire.
            redis.disconnect();
        }
        redis = null;
        log.info('Redis connection closed');
    }
}

export default { getRedis, getRedisOptions, healthCheck, closeRedis };
