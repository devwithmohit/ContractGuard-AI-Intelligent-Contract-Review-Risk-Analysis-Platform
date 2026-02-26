/**
 * DELETE /api/v1/contracts/:id
 *
 * Permanently deletes a contract and all related data (clauses, embeddings, alerts).
 * Also removes the file from Supabase Storage.
 *
 * Auth: Bearer JWT → authenticate → requireOrg
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { requireOrg } from '../../../middleware/requireOrg.js';
import { deleteContractById } from '../../../services/contract.service.js';
import { ValidationError } from '../../../lib/errors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function deleteRoute(fastify: FastifyInstance) {
    fastify.delete('/contracts/:id', {
        preHandler: [authenticate, requireOrg],
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        if (!UUID_REGEX.test(id)) {
            throw new ValidationError('Contract ID must be a valid UUID');
        }

        await deleteContractById(id, request.user.orgId!);

        return reply.code(204).send();
    });
}
