import { Queue, type JobsOptions } from 'bullmq';
import { getRedisOptions } from '../lib/redis.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('service.queue');

// ═══════════════════════════════════════════════════════════════
// Job Data Interfaces (type-safe payloads for each queue)
// ═══════════════════════════════════════════════════════════════

/** Payload for contract analysis jobs */
export interface ContractAnalysisJobData {
    contractId: string;
    orgId: string;
    userId: string;
    filePath: string;
    fileType: 'pdf' | 'docx';
    contractType: string;
}

/** Payload for embedding generation jobs */
export interface EmbeddingJobData {
    contractId: string;
    orgId: string;
    /** If provided, only embed these specific chunk indexes (for incremental updates) */
    chunkIndexes?: number[];
}

/** Payload for alert check jobs (scheduled cron) */
export interface AlertCheckJobData {
    /** Days before expiration to trigger alert */
    daysBeforeExpiry: number;
    /** Run ID for idempotency / logging */
    runId: string;
}

// ═══════════════════════════════════════════════════════════════
// Queue Names (constants to avoid typos)
// ═══════════════════════════════════════════════════════════════

export const QUEUE_NAMES = {
    CONTRACT_ANALYSIS: 'contract-analysis',
    EMBEDDING: 'embedding-jobs',
    ALERT_CHECK: 'alert-check',
} as const;

// ═══════════════════════════════════════════════════════════════
// Default Job Options
// ═══════════════════════════════════════════════════════════════

const DEFAULT_JOB_OPTIONS: JobsOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 5000, // 5s → 10s → 20s
    },
    removeOnComplete: {
        count: 1000,    // Keep last 1000 completed jobs
        age: 86400,     // Remove completed jobs after 24h
    },
    removeOnFail: {
        count: 5000,    // Keep last 5000 failed jobs for debugging
    },
};

// ═══════════════════════════════════════════════════════════════
// Queue Instances (lazy-initialized singletons)
// ═══════════════════════════════════════════════════════════════

let contractAnalysisQueue: Queue<ContractAnalysisJobData> | null = null;
let embeddingQueue: Queue<EmbeddingJobData> | null = null;
let alertCheckQueue: Queue<AlertCheckJobData> | null = null;

/**
 * Get or create the contract analysis queue.
 */
export function getContractAnalysisQueue(): Queue<ContractAnalysisJobData> {
    if (!contractAnalysisQueue) {
        contractAnalysisQueue = new Queue<ContractAnalysisJobData>(
            QUEUE_NAMES.CONTRACT_ANALYSIS,
            {
                connection: getRedisOptions(),
                defaultJobOptions: {
                    ...DEFAULT_JOB_OPTIONS,
                    // Analysis jobs get higher priority timeout
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 10000 },
                },
            },
        );
        log.info('Contract analysis queue initialized');
    }
    return contractAnalysisQueue;
}

/**
 * Get or create the embedding queue.
 */
export function getEmbeddingQueue(): Queue<EmbeddingJobData> {
    if (!embeddingQueue) {
        embeddingQueue = new Queue<EmbeddingJobData>(
            QUEUE_NAMES.EMBEDDING,
            {
                connection: getRedisOptions(),
                defaultJobOptions: DEFAULT_JOB_OPTIONS,
            },
        );
        log.info('Embedding queue initialized');
    }
    return embeddingQueue;
}

/**
 * Get or create the alert check queue.
 */
export function getAlertCheckQueue(): Queue<AlertCheckJobData> {
    if (!alertCheckQueue) {
        alertCheckQueue = new Queue<AlertCheckJobData>(
            QUEUE_NAMES.ALERT_CHECK,
            {
                connection: getRedisOptions(),
                defaultJobOptions: {
                    ...DEFAULT_JOB_OPTIONS,
                    attempts: 2,   // Cron job — less aggressive retry
                },
            },
        );
        log.info('Alert check queue initialized');
    }
    return alertCheckQueue;
}

// ═══════════════════════════════════════════════════════════════
// Job Dispatch Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Enqueue a contract for AI analysis.
 * Called after file upload completes.
 *
 * @returns The BullMQ job ID
 */
export async function enqueueContractAnalysis(
    data: ContractAnalysisJobData,
): Promise<string> {
    const queue = getContractAnalysisQueue();

    const job = await queue.add(
        'analyze', // Job name (for filtering in admin UI)
        data,
        {
            // Use contractId as job ID for idempotency:
            // Re-uploading the same contract replaces the pending job
            jobId: `analysis:${data.contractId}`,
            priority: 1, // High priority
        },
    );

    log.info(
        { jobId: job.id, contractId: data.contractId, orgId: data.orgId },
        'Contract analysis job enqueued',
    );

    return job.id!;
}

/**
 * Enqueue embedding generation for a contract.
 * May be called after analysis or on-demand for re-embedding.
 *
 * @returns The BullMQ job ID
 */
export async function enqueueEmbeddingGeneration(
    data: EmbeddingJobData,
): Promise<string> {
    const queue = getEmbeddingQueue();

    const job = await queue.add(
        'embed',
        data,
        {
            jobId: `embed:${data.contractId}`,
            priority: 2, // Lower priority than analysis
        },
    );

    log.info(
        { jobId: job.id, contractId: data.contractId },
        'Embedding job enqueued',
    );

    return job.id!;
}

/**
 * Schedule the daily alert check job.
 * Uses a repeatable job so BullMQ handles cron scheduling.
 *
 * Call this once at server startup.
 */
export async function scheduleAlertCheck(): Promise<void> {
    const queue = getAlertCheckQueue();

    // Remove any existing repeatable job to avoid duplicates
    const existingRepeatables = await queue.getRepeatableJobs();
    for (const job of existingRepeatables) {
        await queue.removeRepeatableByKey(job.key);
    }

    // Schedule: run daily at 08:00 UTC
    await queue.add(
        'daily-alert-check',
        {
            daysBeforeExpiry: 90,
            runId: `daily-${new Date().toISOString().slice(0, 10)}`,
        },
        {
            repeat: {
                pattern: '0 8 * * *', // Every day at 08:00 UTC
            },
        },
    );

    log.info('Daily alert check scheduled (08:00 UTC)');
}

/**
 * Trigger an immediate alert check (manual / on-demand).
 */
export async function triggerAlertCheckNow(
    daysBeforeExpiry = 90,
): Promise<string> {
    const queue = getAlertCheckQueue();

    const job = await queue.add(
        'manual-alert-check',
        {
            daysBeforeExpiry,
            runId: `manual-${Date.now()}`,
        },
    );

    log.info({ jobId: job.id }, 'Manual alert check triggered');
    return job.id!;
}

// ═══════════════════════════════════════════════════════════════
// Queue Health & Cleanup
// ═══════════════════════════════════════════════════════════════

/**
 * Get queue health stats for the /health endpoint.
 */
export async function getQueueStats() {
    const queues = [
        { name: QUEUE_NAMES.CONTRACT_ANALYSIS, queue: getContractAnalysisQueue() },
        { name: QUEUE_NAMES.EMBEDDING, queue: getEmbeddingQueue() },
        { name: QUEUE_NAMES.ALERT_CHECK, queue: getAlertCheckQueue() },
    ];

    const stats = await Promise.all(
        queues.map(async ({ name, queue }) => {
            const [waiting, active, completed, failed] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getCompletedCount(),
                queue.getFailedCount(),
            ]);
            return { name, waiting, active, completed, failed };
        }),
    );

    return stats;
}

/**
 * Gracefully close all queues.
 * Call this on process shutdown.
 */
export async function closeQueues(): Promise<void> {
    const queues = [contractAnalysisQueue, embeddingQueue, alertCheckQueue];

    await Promise.all(
        queues
            .filter((q): q is Queue => q !== null)
            .map((q) => q.close()),
    );

    contractAnalysisQueue = null;
    embeddingQueue = null;
    alertCheckQueue = null;

    log.info('All queues closed');
}

export default {
    getContractAnalysisQueue,
    getEmbeddingQueue,
    getAlertCheckQueue,
    enqueueContractAnalysis,
    enqueueEmbeddingGeneration,
    scheduleAlertCheck,
    triggerAlertCheckNow,
    getQueueStats,
    closeQueues,
    QUEUE_NAMES,
};
