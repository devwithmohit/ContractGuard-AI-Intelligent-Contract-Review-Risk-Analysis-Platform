import Fastify from 'fastify';
import { isAppError } from './lib/errors.js';

// Plugins (registered in order per system design)
import sensiblePlugin from './plugins/sensible.plugin.js';
import corsPlugin from './plugins/cors.plugin.js';
import multipartPlugin from './plugins/multipart.plugin.js';
import rateLimitPlugin from './plugins/rateLimit.plugin.js';
import authPlugin from './plugins/auth.plugin.js';
import metricsPlugin from './plugins/metrics.plugin.js';

// Routes
import healthRoute from './routes/health.route.js';
import v1Routes from './routes/v1/index.js';

/**
 * Build and configure the Fastify application instance.
 *
 * Plugin Registration Order (per system design):
 *  1. sensible    → HTTP helpers
 *  2. cors        → Cross-origin headers
 *  3. multipart   → File upload parsing
 *  4. rateLimit   → Redis-backed rate limiter
 *  5. auth        → JWT verification decorator
 *  6. metrics     → Prometheus endpoint
 *  7. routes      → Business logic routes
 */
export async function buildApp() {
    const isDev = process.env.NODE_ENV !== 'production';

    const app = Fastify({
        logger: isDev
            ? {
                level: 'debug',
                transport: {
                    target: 'pino-pretty',
                    options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
                },
            }
            : true,
        requestIdHeader: 'x-request-id',
        requestIdLogLabel: 'requestId',

        // Generate unique request IDs
        genReqId: () => crypto.randomUUID(),

        // Trust proxy for correct IP resolution behind CDN/load balancer
        trustProxy: true,

        // Body size limit (10MB for JSON payloads; files handled by multipart)
        bodyLimit: 10 * 1024 * 1024,
    });

    // ─── 1. Plugins (in order) ──────────────────────────────
    await app.register(sensiblePlugin);
    await app.register(corsPlugin);
    await app.register(multipartPlugin);
    await app.register(rateLimitPlugin);
    await app.register(authPlugin);
    await app.register(metricsPlugin);

    // ─── 2. Global Error Handler ────────────────────────────
    app.setErrorHandler((error, request, reply) => {
        const requestId = request.id;

        // Handle our custom AppError classes (RFC 7807)
        if (isAppError(error)) {
            request.log.warn(
                { err: error, requestId },
                `AppError: ${error.title}`,
            );
            return reply.status(error.statusCode).send(
                error.toResponse(request.url, requestId),
            );
        }

        // Handle Fastify validation errors (Zod / schema)
        if (error.validation) {
            request.log.warn({ err: error, requestId }, 'Validation Error');
            return reply.status(400).send({
                error: {
                    type: 'https://contractguard.app/errors/validation-error',
                    title: 'Validation Error',
                    status: 400,
                    detail: error.message,
                    instance: request.url,
                    requestId,
                },
            });
        }

        // Handle rate limit errors from @fastify/rate-limit
        if (error.statusCode === 429) {
            return reply.status(429).send({
                error: {
                    type: 'https://contractguard.app/errors/rate-limit-exceeded',
                    title: 'Rate Limit Exceeded',
                    status: 429,
                    detail: error.message,
                    instance: request.url,
                    requestId,
                },
            });
        }

        // Handle all other known HTTP errors
        if (error.statusCode && error.statusCode < 500) {
            request.log.warn({ err: error, requestId }, `HTTP ${error.statusCode}`);
            return reply.status(error.statusCode).send({
                error: {
                    type: 'https://contractguard.app/errors/client-error',
                    title: 'Client Error',
                    status: error.statusCode,
                    detail: error.message,
                    instance: request.url,
                    requestId,
                },
            });
        }

        // Unexpected server errors — log full stack, return generic message
        request.log.error(
            { err: error, requestId },
            'Unhandled server error',
        );
        return reply.status(500).send({
            error: {
                type: 'https://contractguard.app/errors/internal-error',
                title: 'Internal Server Error',
                status: 500,
                detail: 'An unexpected error occurred. Please try again later.',
                instance: request.url,
                requestId,
            },
        });
    });

    // ─── 3. Not Found Handler ───────────────────────────────
    app.setNotFoundHandler((_request, reply) => {
        reply.status(404).send({
            error: {
                type: 'https://contractguard.app/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'The requested resource was not found',
                instance: _request.url,
                requestId: _request.id,
            },
        });
    });

    // ─── 4. Routes ──────────────────────────────────────────
    await app.register(healthRoute);

    // API v1 routes (Module B10)
    await app.register(v1Routes, { prefix: '/api/v1' });

    return app;
}
