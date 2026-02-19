/**
 * POST /api/v1/contracts/:id/analyze
 *
 * Re-triggers AI analysis for an existing contract.
 * Returns 409 if analysis is already in progress.
 *
 * Auth: Bearer JWT → authenticate → requireOrg
 * Rate limit: 5 per hour (re-analysis is expensive)
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { requireOrg } from '../../../middleware/requireOrg.js';
import { reanalyzeContract } from '../../../services/contract.service.js';
import { ValidationError } from '../../../lib/errors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function analyzeRoute(fastify: FastifyInstance) {
    fastify.post('/contracts/:id/analyze', {
        preHandler: [authenticate, requireOrg],
        config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        if (!UUID_REGEX.test(id)) {
            throw new ValidationError('Contract ID must be a valid UUID');
        }

        const { jobId } = await reanalyzeContract(
            id,
            request.user.orgId!,
            request.user.id,
        );

        return reply.status(202).send({
            contractId: id,
            jobId,
            status: 'processing',
            message: 'Re-analysis queued successfully.',
        });
    });
}
