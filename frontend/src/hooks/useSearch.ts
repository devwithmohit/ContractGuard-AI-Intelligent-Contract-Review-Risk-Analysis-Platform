/**
 * useSearch.ts
 *
 * TanStack Query hook for semantic search.
 *
 * Uses useMutation instead of useQuery so the search is explicitly triggered
 * by the user pressing Enter / clicking Search — not on mount.
 *
 * Also provides a useQuery-based variant for debounced live-search if needed.
 *
 * API: POST /api/v1/search/semantic
 * Body: { query, limit?, minScore?, contractTypes? }
 * Response: { query, results[], totalResults, cached, embeddingMs, searchMs }
 */
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiPost, ApiError } from '@/lib/api';
import type { ContractType } from '@/types/contract.types';

// ─── Types ────────────────────────────────────────────────────

export interface SearchInput {
    query: string;
    limit?: number;
    minScore?: number;
    contractTypes?: ContractType[];
}

export type Relevance = 'very_high' | 'high' | 'medium' | 'low';

export interface SearchResultItem {
    id: string;
    contract_id: string;
    chunk_text: string;
    chunk_index: number;
    similarity_score: number;
    contract_name: string;
    contract_type: string;
    risk_score: number | null;
    relevance: Relevance;
}

export interface SemanticSearchResponse {
    query: string;
    results: SearchResultItem[];
    totalResults: number;
    cached: boolean;
    embeddingMs: number;
    searchMs: number;
}

// ─── Mutation hook ────────────────────────────────────────────

export function useSemanticSearch() {
    return useMutation({
        mutationFn: (input: SearchInput) =>
            apiPost<SemanticSearchResponse>('api/v1/search/semantic', {
                query: input.query.trim(),
                limit: input.limit ?? 20,
                minScore: input.minScore ?? 0.5,
                ...(input.contractTypes?.length && { contractTypes: input.contractTypes }),
            }),

        onError: (error: unknown) => {
            const msg =
                error instanceof ApiError
                    ? error.detail
                    : 'Search failed. Please try again.';
            toast.error(msg);
        },
    });
}
