/**
 * GET /api/v1/dashboard/stats
 *
 * Returns aggregated dashboard metrics for the authenticated org:
 *   - totalContracts, activeContracts, processingContracts, archivedContracts
 *   - averageRiskScore, highRiskCount, criticalRiskCount
 *   - expiringIn30Days, expiringIn90Days
 *   - typeDistribution: { [type]: count }
 *   - riskDistribution: { low, medium, high, critical }
 *
 * Results are cached 2 minutes (TTL). Cache is invalidated on upload/analyze/archive.
 *
 * Auth: Bearer JWT → authenticate → requireOrg
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { requireOrg } from '../../../middleware/requireOrg.js';
import { getDashboardData } from '../../../services/contract.service.js';

export default async function dashboardStatsRoute(fastify: FastifyInstance) {
    fastify.get('/dashboard/stats', {
        preHandler: [authenticate, requireOrg],
    }, async (request, reply) => {
        const stats = await getDashboardData(request.user.orgId!);

        // Cache-Control for CDN / browser caching (2 min)
        reply.header('Cache-Control', 'private, max-age=120');

        return reply.send(stats);
    });
}
