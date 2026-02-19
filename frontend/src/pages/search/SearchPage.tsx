/**
 * SearchPage.tsx
 *
 * AI-powered semantic search across all contracts.
 *
 * Features:
 *  - Full-width search bar with keyboard shortcut hint
 *  - Filter chips: contract type, minimum relevance
 *  - Results: contract name + type badge + risk score + text excerpt
 *    with query-highlighted passages
 *  - Performance stats bar (totalResults, embeddingMs, searchMs, cached)
 *  - Empty + error + initial states
 */
import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Sparkles,
    FileText,
    Clock,
    Zap,
    Database,
    X,
    ArrowRight,
    SlidersHorizontal,
} from 'lucide-react';
import { useSemanticSearch, type SearchResultItem, type Relevance } from '@/hooks/useSearch';
import { cn, scoreToRiskLabel, riskLabelToBadgeClass } from '@/lib/utils';
import type { ContractType } from '@/types/contract.types';

// ─── Constants ────────────────────────────────────────────────

const TYPE_OPTIONS: { value: ContractType; label: string }[] = [
    { value: 'NDA', label: 'NDA' },
    { value: 'MSA', label: 'MSA' },
    { value: 'SaaS', label: 'SaaS' },
    { value: 'Vendor', label: 'Vendor' },
    { value: 'Employment', label: 'Employment' },
    { value: 'Other', label: 'Other' },
];

const RELEVANCE_COLORS: Record<Relevance, { bg: string; text: string; label: string }> = {
    very_high: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Very High' },
    high: { bg: 'bg-brand-500/15', text: 'text-brand-400', label: 'High' },
    medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Medium' },
    low: { bg: 'bg-zinc-500/15', text: 'text-zinc-400', label: 'Low' },
};

// ─── Highlight helper ─────────────────────────────────────────

function highlightExcerpt(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text;

    // Build a rough regex from the query words (case-insensitive)
    const words = query
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (words.length === 0) return text;

    const regex = new RegExp(`(${words.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
        regex.test(part) ? (
            <mark key={i} className="bg-brand-500/25 text-brand-300 rounded-sm px-0.5">
                {part}
            </mark>
        ) : (
            <span key={i}>{part}</span>
        ),
    );
}

// ─── Result card ──────────────────────────────────────────────

function ResultCard({
    result,
    query,
    index,
}: {
    result: SearchResultItem;
    query: string;
    index: number;
}) {
    const riskLabel = scoreToRiskLabel(result.risk_score);
    const relevance = RELEVANCE_COLORS[result.relevance];
    const scorePercent = Math.round(result.similarity_score * 100);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.04, ease: 'easeOut' }}
        >
            <Link
                to={`/contracts/${result.contract_id}`}
                className="group card flex flex-col gap-3 p-5 hover:border-brand-500/40 transition-all duration-200 hover:shadow-glow-sm"
            >
                {/* Header: contract name + badges */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
                            <FileText className="h-4 w-4 text-brand-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-content-primary truncate group-hover:text-brand-400 transition-colors">
                                {result.contract_name}
                            </p>
                            <span className="text-xs text-content-muted">{result.contract_type}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Relevance badge */}
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', relevance.bg, relevance.text)}>
                            {scorePercent}%
                        </span>

                        {/* Risk badge */}
                        {result.risk_score !== null && (
                            <span className={cn('badge text-xs', riskLabelToBadgeClass(riskLabel))}>
                                {result.risk_score}
                            </span>
                        )}
                    </div>
                </div>

                {/* Excerpt */}
                <div className="rounded-xl bg-surface-elevated border border-surface-border p-3">
                    <p className="text-xs text-content-secondary leading-relaxed line-clamp-4">
                        {highlightExcerpt(result.chunk_text, query)}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', relevance.text)}>
                        <Sparkles className="h-3 w-3" />
                        {relevance.label} relevance
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-content-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </Link>
        </motion.div>
    );
}

// ─── Performance stats ────────────────────────────────────────

function PerfStats({
    totalResults,
    embeddingMs,
    searchMs,
    cached,
}: {
    totalResults: number;
    embeddingMs: number;
    searchMs: number;
    cached: boolean;
}) {
    return (
        <div className="flex flex-wrap items-center gap-4 text-xs text-content-muted">
            <span className="flex items-center gap-1.5">
                <Search className="h-3 w-3" />
                {totalResults} result{totalResults !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                Embedding: {embeddingMs}ms
            </span>
            <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Search: {searchMs}ms
            </span>
            {cached && (
                <span className="flex items-center gap-1.5 text-green-400">
                    <Database className="h-3 w-3" />
                    Cached
                </span>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────

export default function SearchPage() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedTypes, setSelectedTypes] = useState<ContractType[]>([]);

    const searchMutation = useSemanticSearch();
    const results = searchMutation.data;

    // Focus search on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // ── Submit ─────────────────────────────────────────────────

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!query.trim() || searchMutation.isPending) return;

        searchMutation.mutate({
            query: query.trim(),
            limit: 20,
            minScore: 0.4,
            ...(selectedTypes.length > 0 && { contractTypes: selectedTypes }),
        });
    }

    // ── Type filter toggle ─────────────────────────────────────

    function toggleType(type: ContractType) {
        setSelectedTypes((prev) =>
            prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
        );
    }

    const hasFilters = selectedTypes.length > 0;

    return (
        <div className="mx-auto max-w-3xl space-y-6 animate-fade-up">
            {/* ── Header ───────────────────────────────────── */}
            <div>
                <h1 className="text-2xl font-bold text-content-primary">Semantic Search</h1>
                <p className="mt-0.5 text-sm text-content-muted">
                    AI-powered natural language search across all your contracts
                </p>
            </div>

            {/* ── Search bar ───────────────────────────────── */}
            <form onSubmit={handleSubmit} className="relative">
                <div className="relative flex items-center">
                    {searchMutation.isPending ? (
                        <span className="absolute left-4 h-4 w-4 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500 pointer-events-none" />
                    ) : (
                        <Sparkles className="absolute left-4 h-4 w-4 text-brand-400 pointer-events-none" />
                    )}

                    <input
                        ref={inputRef}
                        id="semantic-search-input"
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder='Try "limitation of liability clauses" or "auto-renewal terms"…'
                        className="input w-full py-3.5 pl-11 pr-28 text-sm"
                        disabled={searchMutation.isPending}
                    />

                    <div className="absolute right-2 flex items-center gap-1.5">
                        {/* Filter button */}
                        <button
                            type="button"
                            onClick={() => setShowFilters((f) => !f)}
                            className={cn(
                                'flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors',
                                showFilters || hasFilters
                                    ? 'bg-brand-500/15 text-brand-400'
                                    : 'text-content-muted hover:text-content-secondary',
                            )}
                        >
                            <SlidersHorizontal className="h-3 w-3" />
                            {hasFilters && (
                                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-500 text-[9px] text-white font-bold">
                                    {selectedTypes.length}
                                </span>
                            )}
                        </button>

                        {/* Search button */}
                        <button
                            id="semantic-search-btn"
                            type="submit"
                            disabled={!query.trim() || searchMutation.isPending}
                            className="btn-primary btn-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Search className="h-3.5 w-3.5" />
                            Search
                        </button>
                    </div>
                </div>
            </form>

            {/* ── Filters row ──────────────────────────────── */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-semibold text-content-secondary">Contract Type</p>
                                {hasFilters && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTypes([])}
                                        className="flex items-center gap-1 text-[11px] text-content-muted hover:text-content-primary transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {TYPE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleType(opt.value)}
                                        className={cn(
                                            'rounded-lg border px-2.5 py-1 text-xs font-medium transition-all',
                                            selectedTypes.includes(opt.value)
                                                ? 'border-brand-500/50 bg-brand-500/15 text-brand-400'
                                                : 'border-surface-border bg-surface-elevated text-content-muted hover:border-brand-500/30 hover:text-content-secondary',
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Results ──────────────────────────────────── */}

            {/* Performance stats */}
            {results && (
                <PerfStats
                    totalResults={results.totalResults}
                    embeddingMs={results.embeddingMs}
                    searchMs={results.searchMs}
                    cached={results.cached}
                />
            )}

            {/* Error state */}
            {searchMutation.isError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    Search failed. Please try again.
                </div>
            )}

            {/* Loading skeleton */}
            {searchMutation.isPending && (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="card p-5 animate-pulse">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-9 w-9 rounded-xl bg-surface-elevated" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3 w-40 rounded-full bg-surface-elevated" />
                                    <div className="h-2.5 w-20 rounded-full bg-surface-elevated" />
                                </div>
                                <div className="h-5 w-10 rounded-full bg-surface-elevated" />
                            </div>
                            <div className="h-16 w-full rounded-xl bg-surface-elevated" />
                        </div>
                    ))}
                </div>
            )}

            {/* Results list */}
            {results && !searchMutation.isPending && (
                results.results.length > 0 ? (
                    <div className="space-y-3">
                        {results.results.map((r, i) => (
                            <ResultCard key={r.id} result={r} query={query} index={i} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated">
                            <Search className="h-6 w-6 text-content-muted" />
                        </div>
                        <div>
                            <p className="font-medium text-content-secondary">No results found</p>
                            <p className="mt-1 text-sm text-content-muted">
                                Try rephrasing your query or adjusting the filters.
                            </p>
                        </div>
                    </div>
                )
            )}

            {/* Initial state (no search yet) */}
            {!results && !searchMutation.isPending && !searchMutation.isError && (
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/20">
                        <Sparkles className="h-7 w-7 text-brand-400" />
                        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500">
                            <Search className="h-2.5 w-2.5 text-white" />
                        </div>
                    </div>
                    <div>
                        <p className="font-semibold text-content-primary">AI-Powered Contract Search</p>
                        <p className="mt-1 text-sm text-content-muted max-w-md">
                            Search in plain English across all your contracts. Our AI understands
                            legal concepts, not just keywords.
                        </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                        {[
                            'limitation of liability',
                            'data processing terms',
                            'auto-renewal clauses',
                            'indemnification obligations',
                        ].map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                onClick={() => {
                                    setQuery(suggestion);
                                    searchMutation.mutate({
                                        query: suggestion,
                                        limit: 20,
                                        minScore: 0.4,
                                    });
                                }}
                                className="rounded-lg border border-surface-border bg-surface-card px-3 py-1.5 text-xs text-content-secondary hover:border-brand-500/30 hover:text-brand-400 transition-all"
                            >
                                "{suggestion}"
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
