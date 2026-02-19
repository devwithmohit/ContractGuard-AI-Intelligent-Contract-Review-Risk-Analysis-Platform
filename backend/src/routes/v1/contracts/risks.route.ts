/**
 * GET /api/v1/contracts/:id/risks
 *
 * Returns the detailed risk breakdown for a contract including:
 *   - Overall risk score (0–100) and label (low/medium/high/critical)
 *   - Per-clause weighted risk scores
 *   - Clauses grouped by risk level
 *   - Missing high-weight clauses (absence-as-risk)
 *
 * Auth: Bearer JWT → authenticate → requireOrg
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { requireOrg } from '../../../middleware/requireOrg.js';
import { getContractRiskBreakdown } from '../../../services/contract.service.js';
import { ValidationError } from '../../../lib/errors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function risksRoute(fastify: FastifyInstance) {
    fastify.get('/contracts/:id/risks', {
        preHandler: [authenticate, requireOrg],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        if (!UUID_REGEX.test(id)) {
            throw new ValidationError('Contract ID must be a valid UUID');
        }

        const breakdown = await getContractRiskBreakdown(id, request.user.orgId!);

        return reply.send(breakdown);
    });
}
