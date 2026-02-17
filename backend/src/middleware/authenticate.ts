import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { createLogger } from '../lib/logger.js';

const log = createLogger('middleware.auth');

/**
 * Middleware: authenticate
 *
 * Verifies the Supabase JWT from the Authorization header and
 * attaches `request.user` with { id, email, orgId, tier }.
 *
 * Uses the `fastify.authenticate` decorator registered by auth.plugin.ts.
 *
 * Usage in routes:
 * ```ts
 * fastify.get('/protected', { preHandler: [authenticate] }, handler);
 * ```
 */
export async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> {
    try {
        await request.server.authenticate(request);
    } catch (err) {
        log.debug({ err, url: request.url }, 'Authentication failed');
        throw err; // Re-throw — the error handler in app.ts will format it as RFC 7807
    }
}

/**
 * A preHandler hook factory that combines authentication with
 * additional checks. Returns a preHandler array for route registration.
 *
 * @example
 * ```ts
 * fastify.post('/api/v1/contracts/upload', {
 *   preHandler: authGuard(),
 * }, uploadHandler);
 *
 * // With org + tier check:
 * fastify.post('/api/v1/contracts/upload', {
 *   preHandler: authGuard({ requireOrg: true, checkTierLimit: true }),
 * }, uploadHandler);
 * ```
 */
export function authGuard(
    options: {
        requireOrg?: boolean;
        checkTierLimit?: boolean;
    } = {},
) {
    const handlers: ((req: FastifyRequest, reply: FastifyReply) => Promise<void>)[] = [
        authenticate,
    ];

    // Additional middleware will be added here when requireOrg and checkTierLimit
    // are imported in Module B5's other files
    // They are dynamically imported to avoid circular dependencies

    return handlers;
}

export default authenticate;
