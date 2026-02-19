/**
 * GET /api/v1/contracts/:id
 *
 * Returns full contract detail including:
 *   - Contract metadata
 *   - All extracted clauses (sorted by risk)
 *   - Risk breakdown
 *   - Signed download URL (1 hour TTL)
 *
 * Auth: Bearer JWT → authenticate → requireOrg
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { requireOrg } from '../../../middleware/requireOrg.js';
import { getContractDetail } from '../../../services/contract.service.js';
import { ValidationError } from '../../../lib/errors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function detailRoute(fastify: FastifyInstance) {
    fastify.get('/contracts/:id', {
        preHandler: [authenticate, requireOrg],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        if (!UUID_REGEX.test(id)) {
            throw new ValidationError('Contract ID must be a valid UUID');
        }

        const detail = await getContractDetail(id, request.user.orgId!);

        return reply.send(detail);
    });
}
