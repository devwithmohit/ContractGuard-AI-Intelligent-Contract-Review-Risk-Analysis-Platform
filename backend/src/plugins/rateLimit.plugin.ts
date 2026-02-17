import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { getRedis } from '../lib/redis.js';

/**
 * Plugin: @fastify/rate-limit
 * Redis-backed rate limiting with per-user tier awareness.
 *
 * Default: 100 req/min globally.
 * Per-route overrides can be applied via route config.
 */
export default fp(
    async function rateLimitPlugin(fastify: FastifyInstance) {
        await fastify.register(rateLimit, {
            global: true,
            max: 100,              // Default: 100 requests per window
            timeWindow: '1 minute',

            // Use Redis for distributed rate limiting across API pods
            redis: getRedis(),

            // Key generator: use user ID if authenticated, else IP
            keyGenerator: (request) => {
                const user = 'user' in request
                    ? (request.user as { id?: string } | undefined)
                    : undefined;
                return user?.id ?? request.ip;
            },

            // Custom error response matching RFC 7807
            errorResponseBuilder: (_request, context) => ({
                error: {
                    type: 'https://contractguard.app/errors/rate-limit-exceeded',
                    title: 'Rate Limit Exceeded',
                    status: 429,
                    detail: `Rate limit exceeded. Max ${context.max} requests per ${context.after}. Please retry after ${context.after}.`,
                },
            }),

            // Add standard rate limit headers
            addHeadersOnExceeding: {
                'x-ratelimit-limit': true,
                'x-ratelimit-remaining': true,
                'x-ratelimit-reset': true,
            },
            addHeaders: {
                'x-ratelimit-limit': true,
                'x-ratelimit-remaining': true,
                'x-ratelimit-reset': true,
                'retry-after': true,
            },
        });
    },
    {
        name: 'rate-limit-plugin',
        dependencies: ['sensible-plugin'],
    },
);
