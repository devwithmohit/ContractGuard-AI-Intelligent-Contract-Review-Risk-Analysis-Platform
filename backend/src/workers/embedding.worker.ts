import { Worker, type Job } from 'bullmq';
import { getRedisOptions } from '../lib/redis.js';
import { createLogger } from '../lib/logger.js';
import { QUEUE_NAMES, type EmbeddingJobData } from '../services/queue.service.js';

// DB queries
import { getContractById } from '../db/queries/contracts.queries.js';
import {
    insertEmbeddingsBatch,
    deleteEmbeddingsByContractId,
    getExistingChunkHashes,
} from '../db/queries/embeddings.queries.js';

// AI pipeline
import { chunkText } from '../ai/chunker.js';
import { generateEmbeddings } from '../ai/embeddings.js';

const log = createLogger('worker.embedding');

// ─── Worker Configuration ─────────────────────────────────────

const CONCURRENCY = 3; // Embedding is cheaper — allow more parallelism

// ─── Processor ───────────────────────────────────────────────

/**
 * Embedding Worker
 *
 * Generates or refreshes semantic embeddings for a contract.
 * Supports two modes:
 *
 * 1. Full re-embedding: deletes all existing embeddings, re-embeds from raw_text
 * 2. Incremental: only embeds chunks whose hash doesn't already exist in the DB
 *    (deduplication via chunk_hash index in contract_embeddings table)
 *
 * This worker is triggered:
 * - By the analysis worker after clause extraction (Mode 1)
 * - On-demand via POST /api/v1/contracts/:id/analyze (Mode 1)
 * - Scheduled batch update if embedding model changes (Mode 2)
 */
async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<void> {
    const { contractId, orgId, chunkIndexes } = job.data;
    const isIncremental = Array.isArray(chunkIndexes) && chunkIndexes.length > 0;

    log.info(
        { jobId: job.id, contractId, mode: isIncremental ? 'incremental' : 'full' },
        '▶ Starting embedding job',
    );

    // ── Fetch contract raw text ───────────────────────────────
    await job.updateProgress({ step: 1, label: 'Fetching contract text', total: 4 });

    // We use orgId = '' as a bypass here since this worker runs server-side
    // and doesn't need org-level RLS (it already verified auth when enqueueing)
    const contract = await getContractById(contractId, orgId);
    if (!contract) {
        throw new Error(`Contract ${contractId} not found (org: ${orgId})`);
    }

    if (!contract.raw_text) {
        throw new Error(
            `Contract ${contractId} has no raw_text. Run full analysis first.`,
        );
    }

    // ── Chunk the text ────────────────────────────────────────
    await job.updateProgress({ step: 2, label: 'Chunking contract text', total: 4 });
    let chunks = await chunkText(contract.raw_text);

    // In incremental mode, only process the requested chunk indexes
    if (isIncremental) {
        const indexSet = new Set(chunkIndexes);
        chunks = chunks.filter((c) => indexSet.has(c.index));
        log.debug(
            { contractId, requestedIndexes: chunkIndexes.length, filtered: chunks.length },
            'Incremental embedding: filtered to requested chunks',
        );
    }

    if (chunks.length === 0) {
        log.info({ contractId }, 'No chunks to embed — job complete');
        return;
    }

    // ── Deduplication (skip already-embedded chunks by hash) ─
    const existingHashes = await getExistingChunkHashes(contractId);
    const newChunks = chunks.filter((c) => !existingHashes.has(c.hash));

    log.debug(
        {
            contractId,
            totalChunks: chunks.length,
            existingChunks: existingHashes.size,
            newChunks: newChunks.length,
        },
        'Chunk deduplication complete',
    );

    if (newChunks.length === 0) {
        log.info({ contractId }, 'All chunks already embedded — skipping');
        return;
    }

    // ── If full re-embedding, delete existing first ───────────
    if (!isIncremental) {
        await deleteEmbeddingsByContractId(contractId);
        log.debug({ contractId }, 'Deleted existing embeddings for full re-embed');
    }

    // ── Generate embeddings ───────────────────────────────────
    await job.updateProgress({ step: 3, label: 'Generating embeddings', total: 4 });
    const embeddingResults = await generateEmbeddings(newChunks);

    // ── Persist to DB ─────────────────────────────────────────
    await job.updateProgress({ step: 4, label: 'Persisting embeddings', total: 4 });
    const rows = embeddingResults.map((e) => ({
        contract_id: contractId,
        chunk_text: newChunks[e.chunkIndex - (isIncremental ? (chunkIndexes![0] ?? 0) : 0)]?.text
            ?? newChunks.find((c) => c.index === e.chunkIndex)?.text
            ?? '',
        chunk_index: e.chunkIndex,
        chunk_hash: e.chunkHash,
        embedding: e.embedding,
    }));

    const insertedCount = await insertEmbeddingsBatch(rows);

    log.info(
        {
            jobId: job.id,
            contractId,
            insertedCount,
            skippedCount: chunks.length - newChunks.length,
            duration: `${((Date.now() - job.timestamp) / 1000).toFixed(1)}s`,
        },
        '✅ Embedding job complete',
    );
}

// ─── Worker Factory ───────────────────────────────────────────

/**
 * Create and start the embedding worker.
 * Call this once at startup.
 */
export function startEmbeddingWorker(): Worker<EmbeddingJobData> {
    const worker = new Worker<EmbeddingJobData>(
        QUEUE_NAMES.EMBEDDING,
        processEmbeddingJob,
        {
            connection: getRedisOptions(),
            concurrency: CONCURRENCY,
            stalledInterval: 30_000,
            maxStalledCount: 2,
            lockDuration: 60_000,
            lockRenewTime: 15_000,
        },
    );

    worker.on('completed', (job) => {
        log.info({ jobId: job.id, contractId: job.data.contractId }, 'Embedding job completed');
    });

    worker.on('failed', (job, err) => {
        log.error(
            { jobId: job?.id, contractId: job?.data.contractId, err },
            `Embedding job failed (attempt ${job?.attemptsMade})`,
        );
    });

    worker.on('error', (err) => {
        log.error({ err }, 'Embedding worker error');
    });

    log.info(
        { queue: QUEUE_NAMES.EMBEDDING, concurrency: CONCURRENCY },
        '🚀 Embedding worker started',
    );

    return worker;
}

export default startEmbeddingWorker;
