/**
 * ContractListPage.tsx  (alias ContractsPage)
 *
 * Paginated contract list with:
 *  - Search input
 *  - Filter bar (status, type, risk range)
 *  - Sort control (created_at, risk_score, expiration_date)
 *  - Grid of ContractCards
 *  - Pagination controls
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Upload,
    SlidersHorizontal,
    X,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useContractList } from '@/hooks/useContracts';
import ContractCard from '@/components/contract/ContractCard';
import { cn } from '@/lib/utils';
import type { ContractListFilters, ContractStatus, ContractType } from '@/types/contract.types';

// ─── Constants ────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ContractStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'processing', label: 'Processing' },
    { value: 'error', label: 'Error' },
    { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS: { value: ContractType; label: string }[] = [
    { value: 'NDA', label: 'NDA' },
    { value: 'MSA', label: 'MSA' },
    { value: 'SaaS', label: 'SaaS' },
    { value: 'Vendor', label: 'Vendor' },
    { value: 'Employment', label: 'Employment' },
    { value: 'Other', label: 'Other' },
];

const RISK_OPTIONS: { value: string; label: string }[] = [
    { value: '0-25', label: 'Low (0–25)' },
    { value: '26-50', label: 'Medium (26–50)' },
    { value: '51-75', label: 'High (51–75)' },
    { value: '76-100', label: 'Critical (76–100)' },
];

const SORT_OPTIONS = [
    { value: 'created_at', label: 'Date Added' },
    { value: 'risk_score', label: 'Risk Score' },
    { value: 'expiration_date', label: 'Expiry Date' },
] as const;

// ─── Skeleton grid ────────────────────────────────────────────

function CardGridSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-9 w-9 rounded-xl bg-surface-elevated" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-32 rounded-full bg-surface-elevated" />
                            <div className="h-2.5 w-20 rounded-full bg-surface-elevated" />
                        </div>
                        <div className="h-5 w-10 rounded-full bg-surface-elevated" />
                    </div>
                    <div className="flex gap-2 mb-4">
                        <div className="h-4 w-14 rounded-full bg-surface-elevated" />
                        <div className="h-4 w-14 rounded-full bg-surface-elevated" />
                    </div>
                    <div className="flex justify-between">
                        <div className="h-3 w-20 rounded-full bg-surface-elevated" />
                        <div className="h-3 w-16 rounded-full bg-surface-elevated" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────

export default function ContractListPage() {
    const [showFilters, setShowFilters] = useState(false);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<ContractStatus | ''>('');
    const [type, setType] = useState<ContractType | ''>('');
    const [riskRange, setRiskRange] = useState('');  // e.g. '26-50'
    const [sort, setSort] = useState<ContractListFilters['sort']>('created_at');
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);

    // Parse risk range into min/max
    const riskMin = riskRange ? parseInt(riskRange.split('-')[0]!, 10) : undefined;
    const riskMax = riskRange ? parseInt(riskRange.split('-')[1]!, 10) : undefined;

    const filters: ContractListFilters = {
        ...(search && { search }),
        ...(status && { status }),
        ...(type && { type }),
        ...(riskMin !== undefined && { risk_min: riskMin }),
        ...(riskMax !== undefined && { risk_max: riskMax }),
        sort,
        order,
        page,
        limit: 12,
    };

    const { data, isLoading, isError, refetch } = useContractList(filters);
    const contracts = data?.data ?? [];
    const pagination = data?.pagination;
    const hasFilters = !!(search || status || type || riskRange);

    function clearFilters() {
        setSearch('');
        setStatus('');
        setType('');
        setRiskRange('');
        setPage(1);
    }

    return (
        <div className="space-y-5 animate-fade-up">
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-content-primary">Contracts</h1>
                    <p className="mt-0.5 text-sm text-content-muted">
                        {pagination ? `${pagination.total} total` : 'Your contract portfolio'}
                    </p>
                </div>
                <Link to="/contracts/upload" className="btn-primary gap-2">
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Upload</span>
                </Link>
            </div>

            {/* ── Search + filter bar ─────────────────────────── */}
            <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted pointer-events-none" />
                    <input
                        id="contract-search"
                        type="search"
                        placeholder="Search contracts…"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="input w-full pl-9"
                    />
                </div>

                {/* Sort */}
                <select
                    id="contract-sort"
                    value={`${sort}:${order}`}
                    onChange={(e) => {
                        const [s, o] = e.target.value.split(':') as [typeof sort, 'asc' | 'desc'];
                        setSort(s);
                        setOrder(o);
                        setPage(1);
                    }}
                    className="input w-auto"
                >
                    {SORT_OPTIONS.map((opt) => (
                        <>
                            <option key={`${opt.value}:desc`} value={`${opt.value}:desc`}>
                                {opt.label} ↓
                            </option>
                            <option key={`${opt.value}:asc`} value={`${opt.value}:asc`}>
                                {opt.label} ↑
                            </option>
                        </>
                    ))}
                </select>

                {/* Filter toggle */}
                <button
                    id="contract-filter-toggle"
                    type="button"
                    onClick={() => setShowFilters((f) => !f)}
                    className={cn(
                        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                        showFilters || hasFilters
                            ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                            : 'border-surface-border bg-surface-card text-content-secondary hover:border-brand-500/30',
                    )}
                >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Filters</span>
                    {hasFilters && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] text-white font-bold">
                            {[search, status, type].filter(Boolean).length}
                        </span>
                    )}
                </button>
            </div>

            {/* ── Filters row ─────────────────────────────────── */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-surface-border bg-surface-card p-4">
                            {/* Status */}
                            <select
                                id="filter-status"
                                value={status}
                                onChange={(e) => { setStatus(e.target.value as ContractStatus | ''); setPage(1); }}
                                className="input w-auto text-sm"
                            >
                                <option value="">All Statuses</option>
                                {STATUS_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>

                            {/* Type */}
                            <select
                                id="filter-type"
                                value={type}
                                onChange={(e) => { setType(e.target.value as ContractType | ''); setPage(1); }}
                                className="input w-auto text-sm"
                            >
                                <option value="">All Types</option>
                                {TYPE_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>

                            {/* Risk */}
                            <select
                                id="filter-risk"
                                value={riskRange}
                                onChange={(e) => { setRiskRange(e.target.value); setPage(1); }}
                                className="input w-auto text-sm"
                            >
                                <option value="">All Risk Levels</option>
                                {RISK_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>

                            {/* Clear */}
                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="flex items-center gap-1.5 text-xs text-content-muted hover:text-content-primary transition-colors"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Clear filters
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Error state ─────────────────────────────────── */}
            {isError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-3">
                    Failed to load contracts.{' '}
                    <button type="button" onClick={() => refetch()} className="underline">Retry</button>
                </div>
            )}

            {/* ── Grid ────────────────────────────────────────── */}
            {isLoading ? (
                <CardGridSkeleton />
            ) : contracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated">
                        <Search className="h-6 w-6 text-content-muted" />
                    </div>
                    <div>
                        <p className="font-medium text-content-secondary">
                            {hasFilters ? 'No contracts match your filters' : 'No contracts yet'}
                        </p>
                        <p className="mt-1 text-sm text-content-muted">
                            {hasFilters
                                ? 'Try adjusting or clearing your filters.'
                                : 'Upload your first contract to get started.'}
                        </p>
                    </div>
                    {hasFilters ? (
                        <button type="button" onClick={clearFilters} className="btn-secondary">
                            Clear filters
                        </button>
                    ) : (
                        <Link to="/contracts/upload" className="btn-primary gap-2">
                            <Upload className="h-4 w-4" />
                            Upload Contract
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {contracts.map((contract, i) => (
                        <ContractCard key={contract.id} contract={contract} index={i} />
                    ))}
                </div>
            )}

            {/* ── Pagination ───────────────────────────────────── */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-content-muted">
                        Page {pagination.page} of {pagination.totalPages}
                        {' '}({pagination.total} total)
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            id="pagination-prev"
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex items-center gap-1 rounded-lg border border-surface-border bg-surface-card px-3 py-1.5 text-xs text-content-secondary hover:border-brand-500/30 hover:text-content-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Prev
                        </button>
                        <button
                            id="pagination-next"
                            type="button"
                            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                            disabled={page >= pagination.totalPages}
                            className="flex items-center gap-1 rounded-lg border border-surface-border bg-surface-card px-3 py-1.5 text-xs text-content-secondary hover:border-brand-500/30 hover:text-content-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            Next
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
