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

// ─── tiktoken import type ────────────────────────────────────
// tiktoken exports get_encoding (underscore), not getEncoding.
// We use a minimal interface here to avoid import issues.
interface TiktokenEncoder {
    encode: (text: string) => Uint32Array;
    free: () => void;
}

// Singleton cache — avoids reloading tiktoken on every call
let _cachedEncoder: TiktokenEncoder | null = null;

async function loadEncoder(): Promise<TiktokenEncoder> {
    if (_cachedEncoder) return _cachedEncoder;

    // tiktoken v1.x exports get_encoding (not getEncoding)
    const tiktoken = await import('tiktoken').catch(() => {
        throw new Error('tiktoken is required. Run: bun add tiktoken');
    });

    // Handle both naming conventions across tiktoken versions
    const getEnc = (tiktoken as unknown as Record<string, unknown>)['get_encoding']
        ?? (tiktoken as unknown as Record<string, unknown>)['getEncoding'];

    if (typeof getEnc !== 'function') {
        throw new Error('tiktoken: could not find get_encoding or getEncoding export');
    }

    _cachedEncoder = (getEnc as (enc: string) => TiktokenEncoder)(ENCODING_MODEL);
    return _cachedEncoder;
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

    const enc = await loadEncoder();

    // No try/finally with enc.free() — encoder is cached as singleton
    const sentences = splitIntoSentences(text);
    const chunks: TextChunk[] = [];

    let currentSentences: string[] = [];
    let currentTokens: number[] = [];
    let chunkIndex = 0;

    // encode() returns Uint32Array — convert to number[] for consistent typing
    const getTokens = (s: string): number[] => Array.from(enc.encode(s)) as number[];
    const tokenCount = (toks: number[]): number => toks.length;

    for (const sentence of sentences) {
        const sentenceTokens: number[] = getTokens(sentence);

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
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Split text into sentences using regex.
 * Preserves sentence-ending punctuation and handles common abbreviations.
 */
function splitIntoSentences(text: string): string[] {
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
    enc: TiktokenEncoder,
    maxOverlapTokens: number,
): { sentences: string[]; tokens: number[] } {
    const overlapSentences: string[] = [];
    const overlapTokens: number[] = [];

    // Walk backwards through sentences until we fill the overlap budget
    for (let i = sentences.length - 1; i >= 0; i--) {
        const s = sentences[i]!;
        const toks: number[] = Array.from(enc.encode(s)) as number[];

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
    const enc = await loadEncoder();
    return enc.encode(text).length;
}
