import { createLogger } from '../lib/logger.js';
import { cacheGetOrSet, cacheInvalidatePattern } from '../lib/cache.js';
import { uploadFile, deleteFile, getSignedUrl } from './storage.service.js';
import { enqueueContractAnalysis } from './queue.service.js';
import { randomUUID } from 'crypto';

import {
    insertContract,
    getContractById,
    listContracts,
    updateContractStatus,
    archiveContract,
    unarchiveContract,
    deleteContract,
    getDashboardStats,
    getContractsByType,
    getRiskDistribution,
    type Contract,
    type ContractInsert,
    type ContractListFilters,
    type ContractType,
} from '../db/queries/contracts.queries.js';

import {
    getClausesByContractId,
    getClausesByRisk,
    getClauseRiskBreakdown,
    type Clause,
} from '../db/queries/clauses.queries.js';

import { computeRiskScore } from '../ai/riskAnalyzer.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';

const log = createLogger('service.contract');

// ─── TTLs ────────────────────────────────────────────────────

const TTL_CONTRACT_DETAIL = 60;    // 1 min — changes on analysis completion
const TTL_CONTRACT_LIST = 30;    // 30s  — changes on upload/archive
const TTL_DASHBOARD = 120;   // 2 min — aggregate stats refresh slowly
const TTL_SIGNED_URL = 3600;  // 1 hr  — matches Supabase signed URL TTL

// ─── Types ───────────────────────────────────────────────────

export interface UploadContractInput {
    orgId: string;
    userId: string;
    fileName: string;
    fileBuffer: Buffer;
    fileType: 'pdf' | 'docx';
    contractType: ContractType;
    counterparty?: string;
}

export interface ContractDetail extends Contract {
    clauses: Clause[];
    signedUrl: string | null;   // The actual URL string (not SignedUrlResult)
    signedUrlExpiresAt: string | null;
    riskBreakdown: Awaited<ReturnType<typeof getClauseRiskBreakdown>>;
}

// ─── Contract Upload ──────────────────────────────────────────

/**
 * Full upload flow:
 *  1. Generate a deterministic contract ID (UUID)
 *  2. Upload file to Supabase Storage
 *  3. Insert DB record (status = 'processing')
 *  4. Enqueue contract analysis job
 *  5. Invalidate org contract list cache
 */
export async function uploadContract(
    input: UploadContractInput,
): Promise<{ contractId: string; jobId: string }> {
    const { orgId, userId, fileName, fileBuffer, fileType, contractType, counterparty } = input;

    log.info({ orgId, userId, fileName, fileType }, 'Starting contract upload');

    const contractId = randomUUID();

    const mimeType = fileType === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // 1. Upload to Supabase Storage
    const uploadResult = await uploadFile(orgId, contractId, fileBuffer, fileName, mimeType);
    log.debug({ orgId, filePath: uploadResult.path }, 'File uploaded to storage');

    // 2. Insert DB record
    const contractData: ContractInsert = {
        org_id: orgId,
        uploaded_by: userId,
        name: fileName.replace(/\.[^.]+$/, ''), // Strip extension for display name
        type: contractType,
        counterparty,
        file_path: uploadResult.path,
        file_size: fileBuffer.length,
        file_type: fileType,
    };

    const contract = await insertContract(contractData);
    log.info({ contractId: contract.id, orgId }, 'Contract record created');

    // 3. Enqueue analysis
    const jobId = await enqueueContractAnalysis({
        contractId: contract.id,
        orgId,
        userId,
        filePath: uploadResult.path,
        fileType,
        contractType,
    });

    log.info({ contractId: contract.id, jobId }, 'Analysis job enqueued');

    // 4. Invalidate contract list cache for this org
    await cacheInvalidatePattern(`contracts:list:${orgId}:*`);

    return { contractId: contract.id, jobId };
}

// ─── Contract List ────────────────────────────────────────────

/**
 * List contracts with caching.
 */
export async function getContractList(filters: ContractListFilters) {
    const { org_id, page = 1, limit = 20, ...rest } = filters;
    const cacheKey = `contracts:list:${org_id}:${JSON.stringify({ page, limit, ...rest })}`;

    return cacheGetOrSet(
        cacheKey,
        () => listContracts(filters),
        TTL_CONTRACT_LIST,
    );
}

// ─── Contract Detail ──────────────────────────────────────────

/**
 * Get full contract detail including clauses, risk breakdown, and a signed download URL.
 */
export async function getContractDetail(
    contractId: string,
    orgId: string,
): Promise<ContractDetail> {
    const contract = await getContractById(contractId, orgId);

    if (!contract) {
        throw new NotFoundError('Contract', contractId);
    }

    const [clauses, riskBreakdown, signedUrlResult] = await Promise.all([
        cacheGetOrSet(
            `contracts:clauses:${contractId}`,
            () => getClausesByContractId(contractId),
            TTL_CONTRACT_DETAIL,
        ),

        cacheGetOrSet(
            `contracts:risk-breakdown:${contractId}`,
            () => getClauseRiskBreakdown(contractId),
            TTL_CONTRACT_DETAIL,
        ),

        cacheGetOrSet(
            `contracts:signed-url:${contractId}`,
            () => getSignedUrl(contract.file_path, TTL_SIGNED_URL),
            TTL_SIGNED_URL - 300, // Expire 5 min before URL expires
        ).catch(() => null),
    ]);

    return {
        ...contract,
        clauses,
        riskBreakdown,
        signedUrl: signedUrlResult?.url ?? null,
        signedUrlExpiresAt: signedUrlResult?.expiresAt ?? null,
    };
}

// ─── Re-Analysis ──────────────────────────────────────────────

/**
 * Re-trigger AI analysis for an existing contract.
 */
export async function reanalyzeContract(
    contractId: string,
    orgId: string,
    userId: string,
): Promise<{ jobId: string }> {
    const contract = await getContractById(contractId, orgId);

    if (!contract) {
        throw new NotFoundError('Contract', contractId);
    }

    if (contract.status === 'processing') {
        throw new ConflictError('Contract analysis is already in progress');
    }

    await updateContractStatus(contractId, 'processing');

    const jobId = await enqueueContractAnalysis({
        contractId,
        orgId,
        userId,
        filePath: contract.file_path,
        fileType: contract.file_type as 'pdf' | 'docx',
        contractType: contract.type,
    });

    await Promise.all([
        cacheInvalidatePattern(`contracts:clauses:${contractId}`),
        cacheInvalidatePattern(`contracts:risk-breakdown:${contractId}`),
        cacheInvalidatePattern(`contracts:list:${orgId}:*`),
    ]);

    log.info({ contractId, orgId, jobId }, 'Contract re-analysis triggered');

    return { jobId };
}

// ─── Archive ──────────────────────────────────────────────────

/**
 * Soft-delete a contract (sets status = 'archived').
 */
export async function archiveContractById(
    contractId: string,
    orgId: string,
    options: { deleteFile?: boolean } = {},
): Promise<void> {
    const contract = await getContractById(contractId, orgId);

    if (!contract) {
        throw new NotFoundError('Contract', contractId);
    }

    await archiveContract(contractId, orgId);

    if (options.deleteFile) {
        await deleteFile(contract.file_path).catch((err) => {
            log.warn({ err, contractId, filePath: contract.file_path }, 'Failed to delete file from storage');
        });
    }

    await Promise.all([
        cacheInvalidatePattern(`contracts:clauses:${contractId}`),
        cacheInvalidatePattern(`contracts:risk-breakdown:${contractId}`),
        cacheInvalidatePattern(`contracts:signed-url:${contractId}`),
        cacheInvalidatePattern(`contracts:list:${orgId}:*`),
    ]);

    log.info({ contractId, orgId }, 'Contract archived');
}

// ── Unarchive ─────────────────────────────────────────────────────

/**
 * Restore an archived contract back to active status.
 */
export async function unarchiveContractById(
    contractId: string,
    orgId: string,
): Promise<void> {
    const contract = await getContractById(contractId, orgId);

    if (!contract) {
        throw new NotFoundError('Contract', contractId);
    }

    if (contract.status !== 'archived') {
        throw new ConflictError('Only archived contracts can be restored');
    }

    await unarchiveContract(contractId, orgId);

    await Promise.all([
        cacheInvalidatePattern(`contracts:list:${orgId}:*`),
        cacheInvalidatePattern(`dashboard:*:${orgId}`),
    ]);

    log.info({ contractId, orgId }, 'Contract unarchived');
}

// ── Delete ───────────────────────────────────────────────────────

/**
 * Permanently delete a contract and all related data.
 */
export async function deleteContractById(
    contractId: string,
    orgId: string,
): Promise<void> {
    const deleted = await deleteContract(contractId, orgId);

    if (!deleted) {
        throw new NotFoundError('Contract', contractId);
    }

    // Delete file from Supabase Storage
    await deleteFile(deleted.file_path).catch((err) => {
        log.warn({ err, contractId, filePath: deleted.file_path }, 'Failed to delete file from storage');
    });

    await Promise.all([
        cacheInvalidatePattern(`contracts:clauses:${contractId}`),
        cacheInvalidatePattern(`contracts:risk-breakdown:${contractId}`),
        cacheInvalidatePattern(`contracts:signed-url:${contractId}`),
        cacheInvalidatePattern(`contracts:list:${orgId}:*`),
        cacheInvalidatePattern(`dashboard:*:${orgId}`),
    ]);

    log.info({ contractId, orgId }, 'Contract permanently deleted');
}

// ─── Risk Breakdown ───────────────────────────────────────────

/**
 * Get detailed risk breakdown combining DB clause data with the weighted algorithm.
 */
export async function getContractRiskBreakdown(
    contractId: string,
    orgId: string,
) {
    const contract = await getContractById(contractId, orgId);

    if (!contract) {
        throw new NotFoundError('Contract', contractId);
    }

    const [clausesByRisk, clauseRiskBreakdown, allClauses] = await Promise.all([
        getClausesByRisk(contractId),
        getClauseRiskBreakdown(contractId),
        getClausesByContractId(contractId),
    ]);

    // Run risk algorithm against stored clauses to get factor details
    const riskDetails = computeRiskScore(
        allClauses.map((c) => ({
            clause_type: c.clause_type,
            text: c.text,
            risk_level: c.risk_level,
            risk_explanation: c.risk_explanation ?? '',
            page_number: c.page_number ?? undefined,
        })),
    );

    return {
        overallScore: contract.risk_score ?? riskDetails.overallScore,
        riskLabel: riskDetails.riskLabel,
        clausesByRisk,
        clauseBreakdown: clauseRiskBreakdown,
        riskBreakdown: riskDetails.breakdown,         // Per-clause weighted scores
        missingClauses: riskDetails.missingHighWeightClauses,
    };
}

// ─── Dashboard ────────────────────────────────────────────────

/**
 * Get aggregated dashboard stats for an org.
 */
export async function getDashboardData(orgId: string) {
    const [stats, typeDistribution, riskDistribution] = await Promise.all([
        cacheGetOrSet(
            `dashboard:stats:${orgId}`,
            () => getDashboardStats(orgId),
            TTL_DASHBOARD,
        ),
        cacheGetOrSet(
            `dashboard:by-type:${orgId}`,
            () => getContractsByType(orgId),
            TTL_DASHBOARD,
        ),
        cacheGetOrSet(
            `dashboard:risk-dist:${orgId}`,
            () => getRiskDistribution(orgId),
            TTL_DASHBOARD,
        ),
    ]);

    return {
        ...stats,
        typeDistribution,
        riskDistribution,
    };
}

export default {
    uploadContract,
    getContractList,
    getContractDetail,
    reanalyzeContract,
    archiveContractById,
    unarchiveContractById,
    deleteContractById,
    getContractRiskBreakdown,
    getDashboardData,
};
