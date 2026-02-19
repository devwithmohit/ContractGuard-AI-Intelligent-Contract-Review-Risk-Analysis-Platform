/**
 * POST /api/v1/contracts/upload
 *
 * Accepts a multipart form upload containing:
 *   - file: PDF or DOCX (max 50 MB)
 *   - type: ContractType enum string
 *   - counterparty?: optional string
 *
 * Auth: Bearer JWT → authenticate → requireOrg → checkTierLimit
 * Returns: { contractId, jobId, status: 'processing' }
 */
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { requireOrg } from '../../../middleware/requireOrg.js';
import { checkTierLimit } from '../../../middleware/checkTierLimit.js';
import { uploadContract } from '../../../services/contract.service.js';
import { PayloadTooLargeError, ValidationError } from '../../../lib/errors.js';
import type { ContractType } from '../../../db/queries/contracts.queries.js';

const CONTRACT_TYPES: ContractType[] = ['NDA', 'MSA', 'SaaS', 'Vendor', 'Employment', 'Other'];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default async function uploadRoute(fastify: FastifyInstance) {
    fastify.post('/contracts/upload', {
        preHandler: [authenticate, requireOrg, checkTierLimit],
        config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    }, async (request, reply) => {
        // Parse multipart — @fastify/multipart is registered globally
        const data = await request.file();

        if (!data) {
            throw new ValidationError('No file provided. Send a multipart/form-data request with a "file" field.');
        }

        // ── Validate MIME type ────────────────────────────────
        if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
            throw new ValidationError(
                `Unsupported file type "${data.mimetype}". Only PDF and DOCX files are accepted.`,
            );
        }

        // ── Buffer the file (enforces size limit) ─────────────
        const fileBuffer = await data.toBuffer();
        if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
            throw new PayloadTooLargeError(50);
        }
        if (fileBuffer.length === 0) {
            throw new ValidationError('Uploaded file is empty.');
        }

        // ── Extract form fields ────────────────────────────────
        const fields = data.fields as Record<string, { value: string }>;
        const rawType = fields['type']?.value ?? '';
        const counterparty = fields['counterparty']?.value?.trim() || undefined;

        if (!CONTRACT_TYPES.includes(rawType as ContractType)) {
            throw new ValidationError(
                `Invalid contract type "${rawType}". Must be one of: ${CONTRACT_TYPES.join(', ')}`,
            );
        }

        const fileType = data.mimetype === 'application/pdf' ? 'pdf' : 'docx';

        // ── Upload + enqueue ──────────────────────────────────
        const { contractId, jobId } = await uploadContract({
            orgId: request.user.orgId!,
            userId: request.user.id,
            fileName: data.filename,
            fileBuffer,
            fileType,
            contractType: rawType as ContractType,
            counterparty,
        });

        return reply.status(201).send({
            contractId,
            jobId,
            status: 'processing',
            message: 'Contract uploaded successfully. Analysis has been queued.',
        });
    });
}
