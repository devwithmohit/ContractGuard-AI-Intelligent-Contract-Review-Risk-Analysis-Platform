import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('auth.plugin');

// ─── User type attached to requests ──────────────────────────
export interface AuthUser {
    id: string;
    email: string;
    orgId: string | null;
    tier: string | null;
}

// ─── Extend Fastify types ────────────────────────────────────
declare module 'fastify' {
    interface FastifyRequest {
        user: AuthUser;
    }
}

/**
 * Plugin: Auth
 * Decorates Fastify with a JWT verification function using Supabase Auth.
 * Attaches `request.user` with id, email, org_id, and tier.
 */
export default fp(
    async function authPlugin(fastify: FastifyInstance) {
        // Create a Supabase client for JWT verification (service role for admin access)
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            log.warn('Supabase credentials not set — auth plugin will reject all requests');
        }

        const supabase = supabaseUrl && supabaseServiceKey
            ? createClient(supabaseUrl, supabaseServiceKey, {
                auth: { autoRefreshToken: false, persistSession: false },
            })
            : null;

        // Decorate request with empty user (required by Fastify typing)
        fastify.decorateRequest('user', {
            id: '',
            email: '',
            orgId: null,
            tier: null,
        } as AuthUser);

        // Register the verifyJwt hook as a decorator so routes can opt-in
        fastify.decorate(
            'authenticate',
            async function authenticateHandler(request: FastifyRequest) {
                const authHeader = request.headers.authorization;

                if (!authHeader?.startsWith('Bearer ')) {
                    throw fastify.httpErrors.unauthorized(
                        'Missing or invalid Authorization header. Expected: Bearer <token>',
                    );
                }

                const token = authHeader.slice(7);

                if (!supabase) {
                    throw fastify.httpErrors.serviceUnavailable(
                        'Authentication service is not configured',
                    );
                }

                // Verify the JWT with Supabase
                const {
                    data: { user },
                    error,
                } = await supabase.auth.getUser(token);

                if (error || !user) {
                    log.debug({ error: error?.message }, 'JWT verification failed');
                    throw fastify.httpErrors.unauthorized(
                        'Invalid or expired authentication token',
                    );
                }

                // Extract org_id and tier from app_metadata (set by Supabase or our backend)
                const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;

                request.user = {
                    id: user.id,
                    email: user.email ?? '',
                    orgId: (appMeta.org_id as string) ?? null,
                    tier: (appMeta.tier as string) ?? null,
                };

                log.debug(
                    { userId: user.id, orgId: request.user.orgId },
                    'User authenticated',
                );
            },
        );
    },
    {
        name: 'auth-plugin',
    },
);

// ─── Extend Fastify instance types ──────────────────────────
declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest) => Promise<void>;
    }
}
