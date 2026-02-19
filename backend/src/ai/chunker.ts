import { createHash } from 'crypto';
import { createLogger } from '../lib/logger.js';

const log = createLogger('ai.chunker');

// ─── Configuration ────────────────────────────────────────────

const CHUNK_TOKEN_SIZE = 1000;    // Target tokens per chunk
const OVERLAP_TOKENS = 200;       // Overlap between consecutive chunks
const ENCODING_MODEL = 'cl100k_base';  // GPT-4 / embedding-compatible tokenizer

// ─── Types ───────────────────────────────────────────────────

export interface TextChunk {
    text: string;
    index: number;          // Position in document (0-based)
    tokenCount: number;     // Token count for this chunk
    hash: string;           // SHA-256 of chunk text (for deduplication)
}

// ─── Main Entry Point ─────────────────────────────────────────

/**
 * Split contract text into overlapping token-aware chunks.
 *
 * Strategy:
 * 1. Split text at sentence boundaries
 * 2. Accumulate sentences until we reach CHUNK_TOKEN_SIZE tokens
 * 3. Start next chunk with OVERLAP_TOKENS worth of content from end of previous
 * 4. Compute SHA-256 hash for each chunk for deduplication in the DB
 *
 * @param text - Full contract text
 * @returns Array of chunks ready for embedding
 */
export async function chunkText(text: string): Promise<TextChunk[]> {
    if (!text.trim()) return [];

    log.debug({ textLength: text.length }, 'Starting text chunking');

    // Load tiktoken lazily
    const { Tiktoken } = await import('tiktoken').catch(() => {
        throw new Error('tiktoken is required. Run: bun add tiktoken');
    });

    // Load cl100k_base encoding (used by GPT-4 and Jina v2)
    const { getEncoding } = await import('tiktoken');
    const enc = getEncoding(ENCODING_MODEL);

    try {
        const sentences = splitIntoSentences(text);
        const chunks: TextChunk[] = [];

        let currentSentences: string[] = [];
        let currentTokens: number[] = [];
        let chunkIndex = 0;

        const getTokens = (s: string) => Array.from(enc.encode(s));
        const tokenCount = (toks: number[]) => toks.length;

        for (const sentence of sentences) {
            const sentenceTokens = getTokens(sentence);

            // If adding this sentence would exceed limit, flush current chunk
            if (
                currentTokens.length > 0 &&
                tokenCount(currentTokens) + sentenceTokens.length > CHUNK_TOKEN_SIZE
            ) {
                // Create chunk from current accumulation
                const chunkText = currentSentences.join(' ').trim();
                if (chunkText) {
                    chunks.push(makeChunk(chunkText, chunkIndex++, tokenCount(currentTokens)));
                }

                // Build overlap: take last N tokens worth of sentences
                const { sentences: overlapSentences, tokens: overlapTokens } =
                    buildOverlap(currentSentences, enc, OVERLAP_TOKENS);

                currentSentences = [...overlapSentences, sentence];
                currentTokens = [...overlapTokens, ...sentenceTokens];
            } else {
                currentSentences.push(sentence);
                currentTokens.push(...sentenceTokens);
            }
        }

        // Flush the last chunk
        if (currentSentences.length > 0) {
            const chunkText = currentSentences.join(' ').trim();
            if (chunkText) {
                chunks.push(makeChunk(chunkText, chunkIndex++, tokenCount(currentTokens)));
            }
        }

        log.info(
            { chunkCount: chunks.length, avgTokens: Math.round(currentTokens.length / Math.max(chunks.length, 1)) },
            'Chunking complete',
        );

        return chunks;
    } finally {
        enc.free();
    }
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Split text into sentences using regex.
 * Preserves sentence-ending punctuation and handles common abbreviations.
 */
function splitIntoSentences(text: string): string[] {
    // Split on sentence boundaries: period/!/? followed by space + capital letter
    // Also split on paragraph breaks (double newlines)
    const raw = text
        .replace(/\n\n+/g, ' ¶ ') // Preserve paragraph breaks as markers
        .split(/(?<=[.!?])\s+(?=[A-Z"'])|(?= ¶ )/)
        .map((s) => s.replace(/ ¶ /g, '\n\n').trim())
        .filter((s) => s.length > 0);

    return raw;
}

/**
 * Build overlap content for the next chunk.
 * Returns the last N sentences that fit within overlapTokens.
 */
function buildOverlap(
    sentences: string[],
    enc: { encode: (s: string) => Uint32Array },
    maxOverlapTokens: number,
): { sentences: string[]; tokens: number[] } {
    const overlapSentences: string[] = [];
    const overlapTokens: number[] = [];

    // Walk backwards through sentences until we fill the overlap budget
    for (let i = sentences.length - 1; i >= 0; i--) {
        const s = sentences[i]!;
        const toks = Array.from(enc.encode(s));

        if (overlapTokens.length + toks.length > maxOverlapTokens) break;

        overlapSentences.unshift(s);
        overlapTokens.unshift(...toks);
    }

    return { sentences: overlapSentences, tokens: overlapTokens };
}

/**
 * Create a TextChunk with SHA-256 hash.
 */
function makeChunk(text: string, index: number, tokenCount: number): TextChunk {
    const hash = createHash('sha256').update(text).digest('hex');
    return { text, index, tokenCount, hash };
}

/**
 * Count tokens in a string without full chunking.
 * Useful for checking if text fits within a model's context window.
 */
export async function countTokens(text: string): Promise<number> {
    const { getEncoding } = await import('tiktoken');
    const enc = getEncoding(ENCODING_MODEL);
    try {
        return enc.encode(text).length;
    } finally {
        enc.free();
    }
}
