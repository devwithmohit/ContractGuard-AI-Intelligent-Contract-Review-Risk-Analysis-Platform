/**
 * PATCH /api/v1/contracts/:id/unarchive
 *
 * Restores an archived contract to active status.
 *
 * Auth: Bearer JWT → authenticate → requireOrg
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { requireOrg } from '../../../middleware/requireOrg.js';
import { unarchiveContractById } from '../../../services/contract.service.js';
import { ValidationError } from '../../../lib/errors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function unarchiveRoute(fastify: FastifyInstance) {
    fastify.patch('/contracts/:id/unarchive', {
        preHandler: [authenticate, requireOrg],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        if (!UUID_REGEX.test(id)) {
            throw new ValidationError('Contract ID must be a valid UUID');
        }

        await unarchiveContractById(id, request.user.orgId!);

        return reply.send({ message: 'Contract restored successfully.' });
    });
}
