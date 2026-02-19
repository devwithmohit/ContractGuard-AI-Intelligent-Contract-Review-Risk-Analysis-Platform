/**
 * GET /api/v1/contracts
 *
 * Returns a paginated, filtered list of contracts for the authenticated org.
 *
 * Query params:
 *   status?:    'processing' | 'active' | 'error' | 'archived'
 *   type?:      'NDA' | 'MSA' | 'SaaS' | 'Vendor' | 'Employment' | 'Other'
 *   risk_min?:  number (0–100)
 *   risk_max?:  number (0–100)
 *   search?:    string (full-text search on name + counterparty)
 *   sort?:      'created_at' | 'risk_score' | 'expiration_date'
 *   order?:     'asc' | 'desc'
 *   page?:      number (default: 1)
 *   limit?:     number (max: 100, default: 20)
 *
 * Auth: Bearer JWT → authenticate → requireOrg
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { requireOrg } from '../../../middleware/requireOrg.js';
import { getContractList } from '../../../services/contract.service.js';
import { ValidationError } from '../../../lib/errors.js';
import type { ContractStatus, ContractType } from '../../../db/queries/contracts.queries.js';

const VALID_STATUSES: ContractStatus[] = ['processing', 'active', 'error', 'archived'];
const VALID_TYPES: ContractType[] = ['NDA', 'MSA', 'SaaS', 'Vendor', 'Employment', 'Other'];
const VALID_SORTS = ['created_at', 'risk_score', 'expiration_date'] as const;
const MAX_LIMIT = 100;

export default async function listRoute(fastify: FastifyInstance) {
    fastify.get('/contracts', {
        preHandler: [authenticate, requireOrg],
    }, async (request, reply) => {
        const q = request.query as Record<string, string | undefined>;

        // ── Parse & validate query params ─────────────────────
        const status = q['status'] as ContractStatus | undefined;
        if (status && !VALID_STATUSES.includes(status)) {
            throw new ValidationError(`Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
        }

        const type = q['type'] as ContractType | undefined;
        if (type && !VALID_TYPES.includes(type)) {
            throw new ValidationError(`Invalid contract type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
        }

        const sort = (q['sort'] as typeof VALID_SORTS[number] | undefined) ?? 'created_at';
        if (!VALID_SORTS.includes(sort as typeof VALID_SORTS[number])) {
            throw new ValidationError(`Invalid sort "${sort}". Must be one of: ${VALID_SORTS.join(', ')}`);
        }

        const order = q['order'] === 'asc' ? 'asc' : 'desc';
        const page = Math.max(1, parseInt(q['page'] ?? '1', 10) || 1);
        const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(q['limit'] ?? '20', 10) || 20));

        const risk_min = q['risk_min'] !== undefined ? parseFloat(q['risk_min']) : undefined;
        const risk_max = q['risk_max'] !== undefined ? parseFloat(q['risk_max']) : undefined;

        if (risk_min !== undefined && (isNaN(risk_min) || risk_min < 0 || risk_min > 100)) {
            throw new ValidationError('risk_min must be a number between 0 and 100');
        }
        if (risk_max !== undefined && (isNaN(risk_max) || risk_max < 0 || risk_max > 100)) {
            throw new ValidationError('risk_max must be a number between 0 and 100');
        }
        if (risk_min !== undefined && risk_max !== undefined && risk_min > risk_max) {
            throw new ValidationError('risk_min must be less than or equal to risk_max');
        }

        const search = q['search']?.trim() || undefined;
        if (search && search.length > 200) {
            throw new ValidationError('search query too long (max 200 characters)');
        }

        // ── Fetch ────────────────────────────────────────────
        const result = await getContractList({
            org_id: request.user.orgId!,
            status,
            type,
            risk_min,
            risk_max,
            search,
            sort,
            order,
            page,
            limit,
        });

        return reply.send(result);
    });
}
