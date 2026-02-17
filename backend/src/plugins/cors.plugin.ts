import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

/**
 * Plugin: @fastify/cors
 * Configures Cross-Origin Resource Sharing.
 * Allowed origins from CORS_ORIGIN env var (comma-separated).
 */
export default fp(
    async function corsPlugin(fastify: FastifyInstance) {
        const originsEnv = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
        const allowedOrigins = originsEnv.split(',').map((o) => o.trim());

        await fastify.register(cors, {
            origin: allowedOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            exposedHeaders: ['X-Request-Id', 'Retry-After'],
            maxAge: 86400, // 24 hours preflight cache
        });
    },
    {
        name: 'cors-plugin',
    },
);
