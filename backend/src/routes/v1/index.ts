/**
 * v1 API Router
 *
 * Registers all Module B10 route handlers under the `/api/v1` prefix.
 * Each route file exports a Fastify plugin (async function with fastify instance).
 *
 * Route tree:
 *   POST   /api/v1/contracts/upload
 *   GET    /api/v1/contracts
 *   GET    /api/v1/contracts/:id
 *   POST   /api/v1/contracts/:id/analyze
 *   PATCH  /api/v1/contracts/:id/archive
 *   GET    /api/v1/contracts/:id/risks
 *
 *   POST   /api/v1/search/semantic
 *
 *   GET    /api/v1/alerts
 *   PATCH  /api/v1/alerts/:id/snooze
 *   POST   /api/v1/alerts/:id/read
 *   POST   /api/v1/alerts/read-all
 *   DELETE /api/v1/alerts/:id
 *
 *   GET    /api/v1/dashboard/stats
 *
 *   POST   /api/v1/webhooks/stripe
 */
import type { FastifyInstance } from 'fastify';

// Contract routes
import uploadRoute from './contracts/upload.route.js';
import listRoute from './contracts/list.route.js';
import detailRoute from './contracts/detail.route.js';
import analyzeRoute from './contracts/analyze.route.js';
import archiveRoute from './contracts/archive.route.js';
import risksRoute from './contracts/risks.route.js';

// Search routes
import semanticRoute from './search/semantic.route.js';

// Alert routes
import alertsListRoute from './alerts/list.route.js';
import alertActionsRoute from './alerts/snooze.route.js';

// Dashboard routes
import dashboardStatsRoute from './dashboard/stats.route.js';

// Webhook routes
import stripeWebhookRoute from './webhooks/stripe.route.js';

// Auth routes
import authSetupRoute from './auth/setup.route.js';
import authSignupRoute from './auth/signup.route.js';

export default async function v1Routes(fastify: FastifyInstance) {
    // ── Auth ───────────────────────────────────────────────
    await fastify.register(authSetupRoute);
    await fastify.register(authSignupRoute);

    // ── Contracts ──────────────────────────────────────────
    await fastify.register(uploadRoute);
    await fastify.register(listRoute);
    await fastify.register(detailRoute);
    await fastify.register(analyzeRoute);
    await fastify.register(archiveRoute);
    await fastify.register(risksRoute);

    // ── Search ─────────────────────────────────────────────
    await fastify.register(semanticRoute);

    // ── Alerts ─────────────────────────────────────────────
    await fastify.register(alertsListRoute);
    await fastify.register(alertActionsRoute);

    // ── Dashboard ──────────────────────────────────────────
    await fastify.register(dashboardStatsRoute);

    // ── Webhooks ───────────────────────────────────────────
    await fastify.register(stripeWebhookRoute);
}
