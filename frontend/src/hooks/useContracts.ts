/**
 * useContracts.ts
 *
 * TanStack Query hooks for the Contracts module.
 *
 * Hooks:
 *  - useContractList(filters)        → paginated + filtered list
 *  - useContractDetail(id)           → full contract with clauses + signed URL
 *  - useContractRisks(id)            → risk breakdown
 *  - useReanalyzeContract()          → mutation — triggers AI re-analysis
 *  - useArchiveContract()            → mutation — archives a contract
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { queryKeys } from '@/lib/queryKeys';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api';
import type {
    ContractListFilters,
    ContractListResponse,
    ContractDetail,
    ContractRiskBreakdown,
    AnalyzeResponse,
} from '@/types/contract.types';

// ─── List ──────────────────────────────────────────────────────

export function useContractList(filters: ContractListFilters = {}) {
    return useQuery({
        queryKey: queryKeys.contracts.list(filters),
        queryFn: () =>
            apiGet<ContractListResponse>('api/v1/contracts', {
                ...filters,
                // Coerce booleans / numbers to string-safe values for query params
                risk_min: filters.risk_min,
                risk_max: filters.risk_max,
                page: filters.page ?? 1,
                limit: filters.limit ?? 20,
            }),
        placeholderData: (prev) => prev, // Keep previous page data visible while fetching next
    });
}

// ─── Detail ────────────────────────────────────────────────────

export function useContractDetail(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.contracts.detail(id ?? ''),
        queryFn: () => apiGet<ContractDetail>(`api/v1/contracts/${id}`),
        enabled: !!id,
        staleTime: 30 * 1000,
    });
}

// ─── Risk breakdown ────────────────────────────────────────────

export function useContractRisks(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.contracts.risks(id ?? ''),
        queryFn: () => apiGet<ContractRiskBreakdown>(`api/v1/contracts/${id}/risks`),
        enabled: !!id,
        staleTime: 30 * 1000,
    });
}

// ─── Re-analyze mutation ───────────────────────────────────────

export function useReanalyzeContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (contractId: string) =>
            apiPost<AnalyzeResponse>(`api/v1/contracts/${contractId}/analyze`),

        onSuccess: (data) => {
            toast.success('Re-analysis started — results will appear shortly.');
            // Invalidate detail + risks so they refetch when analysis completes
            void queryClient.invalidateQueries({
                queryKey: queryKeys.contracts.detail(data.contractId),
            });
            void queryClient.invalidateQueries({
                queryKey: queryKeys.contracts.risks(data.contractId),
            });
            void queryClient.invalidateQueries({
                queryKey: queryKeys.dashboard.stats(),
            });
        },

        onError: (error: unknown) => {
            const msg =
                error instanceof ApiError
                    ? error.detail
                    : 'Failed to start re-analysis. Please try again.';
            toast.error(msg);
        },
    });
}

// ─── Archive mutation ──────────────────────────────────────────

export function useArchiveContract() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    return useMutation({
        mutationFn: (contractId: string) =>
            apiPatch<{ message: string }>(`api/v1/contracts/${contractId}/archive`),

        onSuccess: (_data, contractId) => {
            toast.success('Contract archived.');
            // Remove detail from cache, invalidate list + dashboard
            queryClient.removeQueries({
                queryKey: queryKeys.contracts.detail(contractId),
            });
            void queryClient.invalidateQueries({
                queryKey: queryKeys.contracts.lists(),
            });
            void queryClient.invalidateQueries({
                queryKey: queryKeys.dashboard.stats(),
            });
            navigate('/contracts', { replace: true });
        },

        onError: (error: unknown) => {
            const msg =
                error instanceof ApiError
                    ? error.detail
                    : 'Failed to archive contract. Please try again.';
            toast.error(msg);
        },
    });
}

// ── Delete mutation ────────────────────────────────────────────

export function useDeleteContract() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    return useMutation({
        mutationFn: (contractId: string) =>
            apiDelete(`api/v1/contracts/${contractId}`),

        onSuccess: (_data, contractId) => {
            toast.success('Contract permanently deleted.');
            queryClient.removeQueries({
                queryKey: queryKeys.contracts.detail(contractId),
            });
            void queryClient.invalidateQueries({
                queryKey: queryKeys.contracts.lists(),
            });
            void queryClient.invalidateQueries({
                queryKey: queryKeys.dashboard.stats(),
            });
            navigate('/contracts', { replace: true });
        },

        onError: (error: unknown) => {
            const msg =
                error instanceof ApiError
                    ? error.detail
                    : 'Failed to delete contract. Please try again.';
            toast.error(msg);
        },
    });
}
