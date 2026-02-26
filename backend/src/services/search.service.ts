import { createLogger } from '../lib/logger.js';
import { cacheGetOrSet } from '../lib/cache.js';
import { listContracts } from '../db/queries/contracts.queries.js';
import {
    semanticSearchEnriched,
    type EnrichedSearchResult,
} from '../db/queries/embeddings.queries.js';
import { embedQuery } from '../ai/embeddings.js';
import { ValidationError, ServiceUnavailableError } from '../lib/errors.js';

const log = createLogger('service.search');

// ─── Configuration ────────────────────────────────────────────

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MIN_SCORE = 0.4;  // Cosine similarity threshold (0–1); below = noise
const CACHE_TTL = 300;  // 5 min — search results are stable short-term
const MAX_QUERY_LENGTH = 1000; // Characters

// ─── Types ───────────────────────────────────────────────────

export interface SemanticSearchInput {
    orgId: string;
    query: string;
    limit?: number;
    minScore?: number;
    /** Optional: restrict search to a subset of contract IDs */
    contractIds?: string[];
    /** Optional: restrict search to specific contract types */
    contractTypes?: string[];
}

export interface SearchResult extends EnrichedSearchResult {
    /** Human-readable relevance label */
    relevance: 'very_high' | 'high' | 'medium' | 'low';
}

export interface SemanticSearchResponse {
    query: string;
    results: SearchResult[];
    totalResults: number;
    cached: boolean;
    embeddingMs: number;
    searchMs: number;
}

// ─── Main Search Function ─────────────────────────────────────

/**
 * Semantic Search Orchestration
 *
 * Flow:
 *  1. Validate query
 *  2. Get all active contract IDs for the org (scoped search)
 *  3. Check Redis cache (keyed by query hash + orgId + limit)
 *  4. Cache miss: generate query embedding via Jina AI
 *  5. Run pgvector ANN search with cosine distance
 *  6. Filter by minimum similarity score
 *  7. Enrich results with relevance labels
 *  8. Cache results
 */
export async function semanticSearch(
    input: SemanticSearchInput,
): Promise<SemanticSearchResponse> {
    const {
        orgId,
        query,
        limit = DEFAULT_LIMIT,
        minScore = MIN_SCORE,
        contractIds: restrictToIds,
        contractTypes,
    } = input;

    // ── Validate ──────────────────────────────────────────────
    if (!query.trim()) {
        throw new ValidationError('Search query cannot be empty');
    }

    if (query.length > MAX_QUERY_LENGTH) {
        throw new ValidationError(`Search query too long (max ${MAX_QUERY_LENGTH} characters)`);
    }

    const effectiveLimit = Math.min(limit, MAX_LIMIT);
    const normalizedQuery = query.trim().toLowerCase();

    log.info({ orgId, query: normalizedQuery.slice(0, 80), limit: effectiveLimit }, 'Starting semantic search');

    // ── Determine search scope ────────────────────────────────
    // If specific IDs provided, use those; otherwise get all active org contracts
    let searchContractIds: string[];

    if (restrictToIds && restrictToIds.length > 0) {
        searchContractIds = restrictToIds;
    } else {
        const { data: contracts } = await listContracts({
            org_id: orgId,
            status: 'active',
            limit: 1000,
        });

        // Filter by contract type if requested
        const filtered = contractTypes && contractTypes.length > 0
            ? contracts.filter((c) => contractTypes.includes(c.type))
            : contracts;

        searchContractIds = filtered.map((c) => c.id);
    }

    if (searchContractIds.length === 0) {
        log.info({ orgId }, 'No active contracts to search');
        return {
            query,
            results: [],
            totalResults: 0,
            cached: false,
            embeddingMs: 0,
            searchMs: 0,
        };
    }

    // ── Cache key ─────────────────────────────────────────────
    // Key: org + normalized query + limit + minScore + contract scope
    const scopeHash = restrictToIds
        ? restrictToIds.sort().join(',').slice(0, 64)
        : 'all';
    const cacheKey = `search:${orgId}:${Buffer.from(normalizedQuery).toString('base64').slice(0, 64)}:${effectiveLimit}:${minScore}:${scopeHash}`;

    let cached = false;
    let embeddingMs = 0;
    let searchMs = 0;

    const results = await cacheGetOrSet<SearchResult[]>(
        cacheKey,
        async () => {
            // ── Generate query embedding ───────────────────────
            const embeddingStart = Date.now();
            let queryEmbedding: number[];

            try {
                queryEmbedding = await embedQuery(query);
            } catch (err) {
                log.error({ err }, 'Failed to generate query embedding');
                throw new ServiceUnavailableError('embedding', 'Embedding service unavailable. Please try again.');
            }

            embeddingMs = Date.now() - embeddingStart;
            log.debug({ embeddingMs }, 'Query embedding generated');

            // ── pgvector ANN search ────────────────────────────
            const searchStart = Date.now();

            // Fetch more than needed so we can filter by minScore and still return `limit` results
            const rawResults = await semanticSearchEnriched(
                queryEmbedding,
                searchContractIds,
                effectiveLimit * 3, // Over-fetch to compensate for score filtering
            );

            searchMs = Date.now() - searchStart;

            log.debug(
                { rawCount: rawResults.length, searchMs, embeddingMs },
                'pgvector search complete',
            );

            // ── Filter by minimum score ────────────────────────
            const filtered = rawResults
                .filter((r) => r.similarity_score >= minScore)
                .slice(0, effectiveLimit);

            // ── Enrich with relevance label ────────────────────
            return filtered.map((r) => ({
                ...r,
                relevance: getRelevanceLabel(r.similarity_score),
            }));
        },
        CACHE_TTL,
    ).then((r) => {
        // If the value came from cache we won't have set embeddingMs/searchMs
        // Check by seeing if those are still 0 and results aren't empty
        if (embeddingMs === 0 && r.length > 0) cached = true;
        return r;
    });

    log.info(
        {
            orgId,
            resultCount: results.length,
            cached,
            embeddingMs,
            searchMs,
        },
        'Semantic search complete',
    );

    return {
        query,
        results,
        totalResults: results.length,
        cached,
        embeddingMs,
        searchMs,
    };
}

// ─── Helpers ─────────────────────────────────────────────────

function getRelevanceLabel(score: number): SearchResult['relevance'] {
    if (score >= 0.85) return 'very_high';
    if (score >= 0.70) return 'high';
    if (score >= 0.55) return 'medium';
    return 'low';
}

export default { semanticSearch };
