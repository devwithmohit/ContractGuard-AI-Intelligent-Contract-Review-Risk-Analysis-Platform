import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import client from 'prom-client';

/**
 * Plugin: Prometheus Metrics
 * Exposes a /metrics endpoint for Prometheus scraping.
 * Collects default Node.js/Bun metrics + custom HTTP metrics.
 */
export default fp(
    async function metricsPlugin(fastify: FastifyInstance) {
        // Create a dedicated registry
        const register = new client.Registry();

        // Add default metrics (CPU, memory, event loop, GC)
        client.collectDefaultMetrics({ register, prefix: 'contractguard_' });

        // ─── Custom Metrics ────────────────────────────────────
        const httpRequestDuration = new client.Histogram({
            name: 'contractguard_http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'] as const,
            buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
            registers: [register],
        });

        const httpRequestsTotal = new client.Counter({
            name: 'contractguard_http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code'] as const,
            registers: [register],
        });

        const activeConnections = new client.Gauge({
            name: 'contractguard_active_connections',
            help: 'Number of active HTTP connections',
            registers: [register],
        });

        // ─── Request lifecycle hooks ───────────────────────────
        fastify.addHook('onRequest', async () => {
            activeConnections.inc();
        });

        fastify.addHook('onResponse', async (request, reply) => {
            activeConnections.dec();

            // Use route pattern (e.g. /api/v1/contracts/:id) not actual URL
            const route = request.routeOptions?.url ?? request.url;
            const labels = {
                method: request.method,
                route,
                status_code: reply.statusCode.toString(),
            };

            httpRequestsTotal.inc(labels);

            // Calculate duration from request start
            const duration = reply.elapsedTime / 1000; // convert ms to seconds
            httpRequestDuration.observe(labels, duration);
        });

        // ─── /metrics endpoint ─────────────────────────────────
        fastify.get('/metrics', async (_request, reply) => {
            reply.header('Content-Type', register.contentType);
            const metrics = await register.metrics();
            return reply.send(metrics);
        });
    },
    {
        name: 'metrics-plugin',
    },
);
