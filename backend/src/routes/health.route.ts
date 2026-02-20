import type { FastifyInstance } from 'fastify';
import { healthCheck as dbHealthCheck } from '../db/client.js';
import { healthCheck as redisHealthCheck } from '../lib/redis.js';

/**
 * Health check route: GET /health
 *
 * Returns the status of all service dependencies:
 *  - database (PostgreSQL)
 *  - redis (Upstash)
 *  - storage (Supabase Storage)
 *  - groqApi (LLM provider)
 *
 * Returns 200 if all critical services are healthy, 503 otherwise.
 */
export default async function healthRoute(fastify: FastifyInstance) {
    fastify.get(
        '/health',
        {
            config: {
                rateLimit: {
                    max: 30,
                    timeWindow: '1 minute',
                },
            },
        },
        async (_request, reply) => {
            const startTime = Date.now();

            // Run health checks in parallel
            const [dbCheck, redisCheck] = await Promise.all([
                dbHealthCheck(),
                redisHealthCheck(),
            ]);

            // Storage check: simple Supabase URL availability
            let storageCheck = { ok: false, latencyMs: -1 };
            try {
                const storageUrl = process.env.SUPABASE_URL;
                if (storageUrl) {
                    const start = performance.now();
                    const res = await fetch(`${storageUrl}/storage/v1/`, {
                        method: 'HEAD',
                        signal: AbortSignal.timeout(3000),
                    });
                    storageCheck = {
                        ok: res.ok || res.status === 400, // 400 = endpoint exists but no auth
                        latencyMs: Math.round(performance.now() - start),
                    };
                }
            } catch {
                storageCheck = { ok: false, latencyMs: -1 };
            }

            // Groq API check — test with risk model via chat completion
            let groqCheck = { ok: false, latencyMs: -1 };
            try {
                const groqKey = process.env.GROQ_API_KEY;
                if (groqKey) {
                    const start = performance.now();
                    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${groqKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: process.env.GROQ_RISK_MODEL || 'openai/gpt-oss-120b',
                            messages: [{ role: 'user', content: 'test' }],
                            max_tokens: 5,
                        }),
                        signal: AbortSignal.timeout(10_000),
                    });
                    groqCheck = {
                        ok: res.ok,
                        latencyMs: Math.round(performance.now() - start),
                    };
                }
            } catch {
                groqCheck = { ok: false, latencyMs: -1 };
            }

            const checks = {
                database: dbCheck,
                redis: redisCheck,
                storage: storageCheck,
                groqApi: groqCheck,
            };

            // Overall health: DB and Redis are critical
            const isHealthy = dbCheck.ok && redisCheck.ok;
            const statusCode = isHealthy ? 200 : 503;

            const response = {
                status: isHealthy ? 'healthy' : 'degraded',
                timestamp: new Date().toISOString(),
                checks,
                version: process.env.npm_package_version ?? '1.0.0',
                uptime: Math.round(process.uptime()),
                responseTimeMs: Date.now() - startTime,
            };

            return reply.status(statusCode).send(response);
        },
    );
}
