/**
 * POST /api/v1/search/semantic
 *
 * Performs vector similarity search across all contracts in the org.
 *
 * Request body (JSON):
 *   {
 *     query: string           // Natural language query (max 2000 chars)
 *     limit?: number          // Max results (default: 10, max: 50)
 *     minScore?: number       // Min cosine similarity threshold (default: 0.6)
 *     contractTypes?: string[] // Filter by contract type(s)
 *   }
 *
 * Auth: Bearer JWT → authenticate → requireOrg
 * Rate limit: 30 per minute (embedding API calls are metered)
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { requireOrg } from '../../../middleware/requireOrg.js';
import { semanticSearch } from '../../../services/search.service.js';
import { ValidationError } from '../../../lib/errors.js';

export default async function semanticSearchRoute(fastify: FastifyInstance) {
    fastify.post('/search/semantic', {
        preHandler: [authenticate, requireOrg],
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (request, reply) => {
        const body = request.body as Record<string, unknown>;

        // ── Validate body ────────────────────────────────────
        const query = body['query'];
        if (typeof query !== 'string') {
            throw new ValidationError('"query" field is required and must be a string');
        }
        if (!query.trim()) {
            throw new ValidationError('"query" must not be empty');
        }
        if (query.length > 2000) {
            throw new ValidationError('"query" must be 2000 characters or fewer');
        }

        const limit = body['limit'] !== undefined ? Number(body['limit']) : 10;
        if (isNaN(limit) || limit < 1 || limit > 50) {
            throw new ValidationError('"limit" must be a number between 1 and 50');
        }

        const minScore = body['minScore'] !== undefined ? Number(body['minScore']) : 0.6;
        if (isNaN(minScore) || minScore < 0 || minScore > 1) {
            throw new ValidationError('"minScore" must be a number between 0 and 1');
        }

        // Parse optional contractTypes filter
        const contractTypes = Array.isArray(body['contractTypes'])
            ? (body['contractTypes'] as string[]).filter((t) => typeof t === 'string')
            : undefined;

        // ── Search ──────────────────────────────────────────
        const results = await semanticSearch({
            query: query.trim(),
            orgId: request.user.orgId!,
            limit: Math.floor(limit),
            minScore,
            contractTypes,
        });

        return reply.send(results);
    });
}
