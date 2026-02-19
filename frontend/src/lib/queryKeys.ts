/**
 * queryKeys.ts
 *
 * TanStack Query key factory for ContractGuard.
 *
 * Using structured key factories (not raw strings) gives us:
 *  - Type-safe invalidation with queryClient.invalidateQueries({ queryKey: keys.contracts.all() })
 *  - Automatic cache scoping (list vs detail vs risks)
 *  - Easy partial invalidation (invalidate all contract queries vs just one contract's detail)
 *
 * Convention: keys.entity.scope(params) returns a readonly tuple.
 */

import type { ContractListFilters } from '@/types/contract.types';
import type { AlertListFilters } from '@/types/alert.types';

// ─── Contract Keys ────────────────────────────────────────────

const contracts = {
    /** Matches ALL contract-related queries */
    all: () => ['contracts'] as const,

    /** Matches all contract list queries (any filter combo) */
    lists: () => [...contracts.all(), 'list'] as const,

    /** Matches one specific list query (filter-specific) */
    list: (filters: ContractListFilters) =>
        [...contracts.lists(), filters] as const,

    /** Matches all contract detail queries */
    details: () => [...contracts.all(), 'detail'] as const,

    /** One contract's full detail */
    detail: (id: string) =>
        [...contracts.details(), id] as const,

    /** One contract's risk breakdown */
    risks: (id: string) =>
        [...contracts.all(), 'risks', id] as const,
};

// ─── Dashboard Keys ───────────────────────────────────────────

const dashboard = {
    all: () => ['dashboard'] as const,
    stats: () => [...dashboard.all(), 'stats'] as const,
};

// ─── Search Keys ──────────────────────────────────────────────

const search = {
    all: () => ['search'] as const,

    /** Semantic search — keyed by query string + limit + minScore */
    semantic: (query: string, limit?: number, minScore?: number) =>
        [...search.all(), 'semantic', { query, limit, minScore }] as const,
};

// ─── Alert Keys ───────────────────────────────────────────────

const alerts = {
    all: () => ['alerts'] as const,

    /** All alert list queries */
    lists: () => [...alerts.all(), 'list'] as const,

    /** One specific list query (filter-specific) */
    list: (filters: AlertListFilters) =>
        [...alerts.lists(), filters] as const,

    /** Unread count badge */
    unreadCount: () => [...alerts.all(), 'unread-count'] as const,
};

// ─── Auth Keys ────────────────────────────────────────────────

const auth = {
    all: () => ['auth'] as const,
    session: () => [...auth.all(), 'session'] as const,
    user: () => [...auth.all(), 'user'] as const,
};

// ─── Exported factory ─────────────────────────────────────────

export const queryKeys = {
    contracts,
    dashboard,
    search,
    alerts,
    auth,
} as const;

export type QueryKeys = typeof queryKeys;
