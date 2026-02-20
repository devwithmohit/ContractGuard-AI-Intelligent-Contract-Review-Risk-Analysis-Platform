import { Worker, type Job } from 'bullmq';
import { getRedisOptions } from '../lib/redis.js';
import { createLogger } from '../lib/logger.js';
import { QUEUE_NAMES, type ContractAnalysisJobData, enqueueEmbeddingGeneration } from '../services/queue.service.js';

// DB queries
import {
    updateContractAnalysis,
    updateContractStatus,
} from '../db/queries/contracts.queries.js';
import { insertClausesBatch, deleteClausesByContractId } from '../db/queries/clauses.queries.js';
import { insertEmbeddingsBatch } from '../db/queries/embeddings.queries.js';

// Storage
import { downloadFile } from '../services/storage.service.js';

// AI pipeline
import { extractText } from '../ai/extractor.js';
import { chunkText } from '../ai/chunker.js';
import { generateEmbeddings } from '../ai/embeddings.js';
import { extractClauses, extractDates, detectContractType } from '../ai/clauseExtractor.js';
import { computeRiskScore, analyzeRiskDeep } from '../ai/riskAnalyzer.js';
import { generateSummary } from '../ai/summarizer.js';

const log = createLogger('worker.contractAnalysis');

// ─── Worker Configuration ─────────────────────────────────────

const CONCURRENCY = 2; // Process 2 contracts simultaneously

// ─── 9-Step Pipeline ─────────────────────────────────────────

/**
 * Contract Analysis Worker
 *
 * Implements the full 9-step analysis pipeline:
 *  1. Mark contract as processing
 *  2. Download file from Supabase Storage
 *  3. Extract text (PDF digital → OCR fallback, DOCX)
 *  4. Chunk text (1000 tokens, 200 overlap)
 *  5. Generate embeddings (Jina v2 768-dim)
 *  6. Extract clauses (LLaMA 3.1 via Groq → Mistral fallback)
 *  7. Compute risk score (weighted algorithm)
 *  8. Generate executive summary
 *  9. Persist results + mark active, emit realtime event
 */
async function processContractAnalysis(
    job: Job<ContractAnalysisJobData>,
): Promise<void> {
    const { contractId, orgId, filePath, fileType, contractType } = job.data;

    log.info({ jobId: job.id, contractId, orgId }, '▶ Starting contract analysis pipeline');

    const updateProgress = async (step: number, label: string) => {
        await job.updateProgress({ step, label, total: 9 });
        log.info({ jobId: job.id, contractId, step: `${step}/9`, label }, `Pipeline step`);
    };

    // ── Step 1: Mark as processing ────────────────────────────
    await updateProgress(1, 'Initializing analysis');
    await updateContractStatus(contractId, 'processing');

    try {
        // ── Step 2: Download file ─────────────────────────────
        await updateProgress(2, 'Downloading contract file');
        const fileBuffer = await downloadFile(filePath);

        log.debug({ contractId, filePath, size: fileBuffer.length }, 'File downloaded');

        // ── Step 3: Extract text ──────────────────────────────
        await updateProgress(3, 'Extracting text content');
        const extraction = await extractText(fileBuffer, fileType);

        if (!extraction.text || extraction.wordCount < 20) {
            throw new Error(
                `Text extraction yielded too little content (${extraction.wordCount} words). File may be corrupted or a scanned image that OCR could not read.`,
            );
        }

        log.debug(
            { contractId, method: extraction.method, wordCount: extraction.wordCount, pageCount: extraction.pageCount },
            'Text extracted',
        );

        // ── Step 4: Chunk text ────────────────────────────────
        await updateProgress(4, 'Chunking document into segments');
        const chunks = await chunkText(extraction.text);

        log.debug({ contractId, chunkCount: chunks.length }, 'Text chunked');

        // ── Step 5: Generate embeddings ───────────────────────
        await updateProgress(5, 'Generating semantic embeddings');
        const embeddingResults = await generateEmbeddings(chunks);

        // Persist embeddings to DB
        const embeddingRows = embeddingResults.map((e) => ({
            contract_id: contractId,
            chunk_text: chunks[e.chunkIndex]!.text,
            chunk_index: e.chunkIndex,
            chunk_hash: e.chunkHash,
            embedding: e.embedding,
        }));

        const insertedCount = await insertEmbeddingsBatch(embeddingRows);
        log.debug({ contractId, insertedCount }, 'Embeddings persisted');

        // ── Step 6: Extract clauses ───────────────────────────
        await updateProgress(6, 'Analyzing contract clauses');

        // Clear any previous clause analysis (for re-analysis)
        await deleteClausesByContractId(contractId);

        const clauses = await extractClauses(extraction.text);
        log.debug({ contractId, clauseCount: clauses.length }, 'Clauses extracted');

        // Detect dates + verify/override contract type if 'Other'
        const [dates, detectedType] = await Promise.all([
            extractDates(extraction.text),
            contractType === 'Other' ? detectContractType(extraction.text) : null,
        ]);

        // Persist clauses
        if (clauses.length > 0) {
            await insertClausesBatch(
                clauses.map((c) => ({
                    contract_id: contractId,
                    clause_type: c.clause_type,
                    text: c.text,
                    page_number: c.page_number,
                    risk_level: c.risk_level,
                    risk_explanation: c.risk_explanation,
                })),
            );
        }

        // ── Step 7: Compute risk score ────────────────────────
        await updateProgress(7, 'Computing risk score');

        // Algorithmic score from clause weights
        const risk = computeRiskScore(clauses);
        let finalRiskScore = risk.overallScore;

        // Deep LLM risk analysis — blend 70% algo, 30% LLM
        try {
            log.info({ contractId }, 'Starting deep risk analysis via Groq');
            const deepRisk = await analyzeRiskDeep(clauses);

            finalRiskScore = Math.round(risk.overallScore * 0.7 + deepRisk.risk_score * 0.3);

            log.info(
                {
                    contractId,
                    algoScore: risk.overallScore,
                    llmScore: deepRisk.risk_score,
                    finalScore: finalRiskScore,
                    model: process.env.GROQ_RISK_MODEL || 'openai/gpt-oss-120b',
                    topRisks: deepRisk.top_risks,
                },
                'Blended risk score computed (70% algo + 30% LLM)',
            );
        } catch (riskErr) {
            log.error(
                { contractId, err: riskErr },
                'Deep risk analysis failed — using algorithmic score only',
            );
            // Fall through with algo-only score
        }

        // ── Step 8: Generate summary ──────────────────────────
        await updateProgress(8, 'Generating executive summary');
        const summary = await generateSummary({
            contractText: extraction.text,
            contractType: detectedType?.type ?? contractType,
            clauses,
            effectiveDate: dates.effective_date ?? undefined,
            expirationDate: dates.expiration_date ?? undefined,
        });

        // ── Step 9: Persist final results & mark active ───────
        await updateProgress(9, 'Finalizing analysis');
        await updateContractAnalysis(contractId, {
            raw_text: extraction.text,
            effective_date: dates.effective_date,
            expiration_date: dates.expiration_date,
            auto_renewal: dates.auto_renewal,
            risk_score: finalRiskScore,
            summary,
            status: 'active',
            last_analyzed_at: new Date().toISOString(),
        });

        log.info(
            {
                jobId: job.id,
                contractId,
                orgId,
                riskScore: finalRiskScore,
                clauseCount: clauses.length,
                embeddingCount: insertedCount,
                duration: `${((Date.now() - job.timestamp) / 1000).toFixed(1)}s`,
            },
            '✅ Contract analysis pipeline complete',
        );
    } catch (err) {
        // Mark contract as errored so UI can show failure state
        log.error({ err, contractId, jobId: job.id }, '❌ Contract analysis pipeline failed');

        await updateContractStatus(contractId, 'error').catch((updateErr) => {
            log.error({ err: updateErr }, 'Failed to update contract status to error');
        });

        throw err; // Re-throw so BullMQ marks the job as failed and can retry
    }
}

// ─── Worker Factory ───────────────────────────────────────────

/**
 * Create and start the contract analysis worker.
 * Call this once at startup.
 */
export function startContractAnalysisWorker(): Worker<ContractAnalysisJobData> {
    const worker = new Worker<ContractAnalysisJobData>(
        QUEUE_NAMES.CONTRACT_ANALYSIS,
        processContractAnalysis,
        {
            connection: getRedisOptions(),
            concurrency: CONCURRENCY,

            // Stall detection: if job hasn't updated in 5 min, consider it stalled
            stalledInterval: 30_000,
            maxStalledCount: 2,

            // Lock renewal: renew lock every 15s
            lockDuration: 60_000,
            lockRenewTime: 15_000,
        },
    );

    // Worker lifecycle events
    worker.on('completed', (job) => {
        log.info(
            { jobId: job.id, contractId: job.data.contractId },
            'Job completed successfully',
        );
    });

    worker.on('failed', (job, err) => {
        log.error(
            { jobId: job?.id, contractId: job?.data.contractId, err },
            `Job failed (attempt ${job?.attemptsMade}/${job?.opts.attempts ?? 3})`,
        );
    });

    worker.on('stalled', (jobId) => {
        log.warn({ jobId }, 'Job stalled — will be re-queued');
    });

    worker.on('error', (err) => {
        log.error({ err }, 'Worker error');
    });

    log.info(
        { queue: QUEUE_NAMES.CONTRACT_ANALYSIS, concurrency: CONCURRENCY },
        '🚀 Contract analysis worker started',
    );

    return worker;
}

export default startContractAnalysisWorker;
