import pg from 'pg';
import { createLogger } from '../lib/logger.js';

const log = createLogger('db.client');

// ─── Pool Configuration ─────────────────────────────────────────
const poolConfig: pg.PoolConfig = {
    connectionString: process.env.DATABASE_URL,

    // Connection pool sizing
    min: 2,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,

    // Parse timestamps as strings to avoid timezone issues
    types: {
        getTypeParser: (oid: number, format?: string) => {
            // TIMESTAMPTZ (OID 1184) and TIMESTAMP (OID 1114) — return as ISO strings
            if (oid === 1184 || oid === 1114) {
                return (val: string) => val;
            }
            // Use default parser for everything else
            return pg.types.getTypeParser(oid, format as 'text');
        },
    },
};

// ─── Singleton Pool Instance ─────────────────────────────────────
let pool: pg.Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool.
 * Uses lazy initialization — pool is created on first call.
 */
export function getPool(): pg.Pool {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        pool = new pg.Pool(poolConfig);

        // Log pool lifecycle events
        pool.on('connect', () => {
            log.debug('New client connected to PostgreSQL');
        });

        pool.on('error', (err) => {
            log.error({ err }, 'Unexpected PostgreSQL pool error');
        });

        pool.on('remove', () => {
            log.debug('Client removed from pool');
        });

        log.info('PostgreSQL connection pool initialized');
    }

    return pool;
}

/**
 * Execute a parameterized SQL query.
 *
 * @example
 * ```ts
 * const result = await query<Contract>(
 *   'SELECT * FROM contracts WHERE org_id = $1 AND status = $2',
 *   [orgId, 'active']
 * );
 * ```
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
): Promise<pg.QueryResult<T>> {
    const start = performance.now();
    const result = await getPool().query<T>(text, params);
    const duration = Math.round(performance.now() - start);

    log.debug(
        {
            query: text.substring(0, 100),
            params: params?.length,
            rows: result.rowCount,
            durationMs: duration,
        },
        'Query executed',
    );

    return result;
}

/**
 * Get a client from the pool for transaction support.
 *
 * @example
 * ```ts
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT INTO ...', [...]);
 *   await client.query('UPDATE ...', [...]);
 *   await client.query('COMMIT');
 * } catch (err) {
 *   await client.query('ROLLBACK');
 *   throw err;
 * } finally {
 *   client.release();
 * }
 * ```
 */
export async function getClient(): Promise<pg.PoolClient> {
    return getPool().connect();
}

/**
 * Execute multiple statements inside a transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 *
 * @example
 * ```ts
 * const [contract, clause] = await transaction(async (client) => {
 *   const c = await client.query('INSERT INTO contracts ...');
 *   const cl = await client.query('INSERT INTO contract_clauses ...');
 *   return [c.rows[0], cl.rows[0]];
 * });
 * ```
 */
export async function transaction<T>(
    fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        log.error({ err }, 'Transaction rolled back');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Health check — tests database connectivity.
 * Returns latency in milliseconds.
 */
export async function healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    try {
        const start = performance.now();
        await query('SELECT 1');
        const latencyMs = Math.round(performance.now() - start);
        return { ok: true, latencyMs };
    } catch {
        return { ok: false, latencyMs: -1 };
    }
}

/**
 * Gracefully shut down the connection pool.
 * Call this on process exit.
 */
export async function closePool(): Promise<void> {
    if (pool) {
        log.info('Closing PostgreSQL connection pool...');
        await pool.end();
        pool = null;
        log.info('PostgreSQL connection pool closed');
    }
}

export default { getPool, query, getClient, transaction, healthCheck, closePool };
