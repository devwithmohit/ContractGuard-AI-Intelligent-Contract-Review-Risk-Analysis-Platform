/**
 * useAlerts.ts
 *
 * TanStack Query hooks for the alerts system.
 *
 * Hooks:
 *  - useAlertList       — GET /api/v1/alerts (paginated, filterable)
 *  - useSnoozeAlert     — PATCH /api/v1/alerts/:id/snooze (mutation)
 *  - useMarkRead        — POST /api/v1/alerts/:id/read (mutation)
 *  - useMarkAllRead     — POST /api/v1/alerts/read-all (mutation)
 *  - useDismissAlert    — DELETE /api/v1/alerts/:id (mutation)
 *  - useAlertsRealtime  — Supabase Realtime subscription (invalidates cache)
 */
import { useEffect } from 'react';
import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseQueryResult,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type {
    AlertListFilters,
    AlertListResponse,
    SnoozeAlertResponse,
    MarkReadResponse,
} from '@/types/alert.types';

// ─── List hook ────────────────────────────────────────────────

export function useAlertList(
    filters: AlertListFilters = {},
): UseQueryResult<AlertListResponse> {
    // Build search params — only send defined values
    const params: Record<string, string | number | boolean | undefined> = {};

    if (filters.alert_type) params['alert_type'] = filters.alert_type;
    if (filters.is_read !== undefined) params['is_read'] = String(filters.is_read);
    if (filters.contract_id) params['contract_id'] = filters.contract_id;
    if (filters.include_snoozed) params['include_snoozed'] = 'true';
    if (filters.page) params['page'] = filters.page;
    if (filters.limit) params['limit'] = filters.limit;

    return useQuery({
        queryKey: queryKeys.alerts.list(filters),
        queryFn: () => apiGet<AlertListResponse>('api/v1/alerts', params),
        staleTime: 30_000,          // 30s — alerts change frequently
        refetchOnWindowFocus: true, // Re-fetch when user tabs back
    });
}

// ─── Snooze mutation ──────────────────────────────────────────

export function useSnoozeAlert() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ alertId, snoozedUntil }: { alertId: string; snoozedUntil: string }) =>
            apiPatch<SnoozeAlertResponse>(`api/v1/alerts/${alertId}/snooze`, { snoozedUntil }),

        onSuccess: (_data, { snoozedUntil }) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all() });
            const until = new Date(snoozedUntil).toLocaleDateString();
            toast.success(`Alert snoozed until ${until}`);
        },

        onError: (error: unknown) => {
            const msg = error instanceof ApiError ? error.detail : 'Failed to snooze alert';
            toast.error(msg);
        },
    });
}

// ─── Mark-read mutation ───────────────────────────────────────

export function useMarkRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (alertId: string) =>
            apiPost<MarkReadResponse>(`api/v1/alerts/${alertId}/read`),

        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all() });
        },

        onError: (error: unknown) => {
            const msg = error instanceof ApiError ? error.detail : 'Failed to mark alert as read';
            toast.error(msg);
        },
    });
}

// ─── Mark-all-read mutation ───────────────────────────────────

export function useMarkAllRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => apiPost<MarkReadResponse>('api/v1/alerts/read-all'),

        onSuccess: (data) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all() });
            toast.success(`${data.updated} alert(s) marked as read`);
        },

        onError: (error: unknown) => {
            const msg = error instanceof ApiError ? error.detail : 'Failed to mark all as read';
            toast.error(msg);
        },
    });
}

// ─── Dismiss mutation ─────────────────────────────────────────

export function useDismissAlert() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (alertId: string) => apiDelete(`api/v1/alerts/${alertId}`),

        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all() });
            toast.success('Alert dismissed');
        },

        onError: (error: unknown) => {
            const msg = error instanceof ApiError ? error.detail : 'Failed to dismiss alert';
            toast.error(msg);
        },
    });
}

// ─── Realtime subscription ────────────────────────────────────

/**
 * Hook that subscribes to Supabase Realtime Postgres Changes on the
 * `alerts` table and invalidates TanStack Query cache on INSERT / UPDATE / DELETE.
 *
 * Call this once from AlertsPage so the list auto-refreshes.
 */
export function useAlertsRealtime() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('alerts-page')
            .on('postgres_changes', {
                event: '*',   // INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'alerts',
            }, () => {
                void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all() });
            })
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [queryClient]);
}
