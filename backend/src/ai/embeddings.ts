import { createLogger } from '../lib/logger.js';
import type { TextChunk } from './chunker.js';

const log = createLogger('ai.embeddings');

// ─── Configuration ────────────────────────────────────────────

const JINA_API_URL = 'https://api.jina.ai/v1/embeddings';
const JINA_MODEL = 'jina-embeddings-v2-base-en';
const EMBEDDING_DIMENSIONS = 768;

// Max chunks per API request (Jina allows up to 8 inputs)
const BATCH_SIZE = 8;

// Retry configuration
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

// ─── Types ───────────────────────────────────────────────────

export interface EmbeddingResult {
    chunkIndex: number;
    chunkHash: string;
    embedding: number[];   // 768-dim float array
    tokenCount: number;
}

interface JinaResponse {
    data: Array<{
        index: number;
        embedding: number[];
    }>;
    usage: {
        total_tokens: number;
    };
}

// ─── Main Entry Point ─────────────────────────────────────────

/**
 * Generate embeddings for a batch of text chunks using Jina AI v2.
 *
 * Processes chunks in batches of up to 8 (Jina API limit).
 * Implements exponential backoff on rate limit errors.
 *
 * @param chunks - Text chunks from the chunker
 * @returns Embedding results with 768-dim vectors
 */
export async function generateEmbeddings(chunks: TextChunk[]): Promise<EmbeddingResult[]> {
    if (chunks.length === 0) return [];

    const apiKey = process.env.JINA_API_KEY;
    if (!apiKey) {
        throw new Error('JINA_API_KEY environment variable is not set');
    }

    log.info({ chunkCount: chunks.length, batchSize: BATCH_SIZE }, 'Generating embeddings');

    const results: EmbeddingResult[] = [];

    // Process in batches
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

        log.debug({ batchNum, totalBatches, batchSize: batch.length }, 'Processing embedding batch');

        const batchResults = await embedBatch(batch, apiKey);
        results.push(...batchResults);

        // Small delay between batches to be polite to the API
        if (i + BATCH_SIZE < chunks.length) {
            await sleep(50);
        }
    }

    log.info({ chunkCount: chunks.length, embeddingCount: results.length }, 'Embeddings generated');
    return results;
}

/**
 * Generate embedding for a single query string.
 * Used for semantic search — embed the user's query before ANN lookup.
 */
export async function embedQuery(queryText: string): Promise<number[]> {
    const apiKey = process.env.JINA_API_KEY;
    if (!apiKey) {
        throw new Error('JINA_API_KEY environment variable is not set');
    }

    const response = await callJinaApi([queryText], apiKey);
    const embedding = response.data[0]?.embedding;

    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Invalid embedding returned for query: expected ${EMBEDDING_DIMENSIONS} dims`);
    }

    return embedding;
}

// ─── Internal Helpers ────────────────────────────────────────

async function embedBatch(
    chunks: TextChunk[],
    apiKey: string,
): Promise<EmbeddingResult[]> {
    const texts = chunks.map((c) => c.text);
    const response = await callJinaApi(texts, apiKey);

    return response.data.map((item, idx) => {
        const chunk = chunks[idx]!;
        return {
            chunkIndex: chunk.index,
            chunkHash: chunk.hash,
            embedding: item.embedding,
            tokenCount: chunk.tokenCount,
        };
    });
}

async function callJinaApi(
    inputs: string[],
    apiKey: string,
    retryCount = 0,
): Promise<JinaResponse> {
    try {
        const response = await fetch(JINA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: JINA_MODEL,
                input: inputs,
                normalized: true,  // L2-normalize for cosine similarity
            }),
            signal: AbortSignal.timeout(30_000), // 30s timeout
        });

        // Handle rate limits
        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') ?? '5', 10);
            if (retryCount < MAX_RETRIES) {
                log.warn({ retryCount, retryAfter }, 'Jina rate limit hit — retrying');
                await sleep(retryAfter * 1000);
                return callJinaApi(inputs, apiKey, retryCount + 1);
            }
            throw new Error('Jina API rate limit exceeded after max retries');
        }

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Jina API error ${response.status}: ${body}`);
        }

        const data = await response.json() as JinaResponse;

        // Validate response shape
        if (!Array.isArray(data.data) || data.data.length !== inputs.length) {
            throw new Error(`Jina API returned unexpected response shape`);
        }

        return data;
    } catch (err) {
        if (retryCount < MAX_RETRIES && isRetryableError(err)) {
            const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount);
            log.warn({ err, retryCount, delayMs: delay }, 'Jina API call failed — retrying');
            await sleep(delay);
            return callJinaApi(inputs, apiKey, retryCount + 1);
        }
        throw err;
    }
}

function isRetryableError(err: unknown): boolean {
    if (err instanceof Error) {
        return (
            err.name === 'AbortError' ||
            err.message.includes('fetch') ||
            err.message.includes('network') ||
            err.message.includes('ECONNRESET')
        );
    }
    return false;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
