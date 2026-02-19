/**
 * ClauseList.tsx
 *
 * Grouped, expandable list of contract clauses sorted by risk level.
 * Renders groups: Critical → High → Medium → Low.
 * Each clause shows: type badge, risk badge, page number, explanation.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, BookOpen, AlertTriangle } from 'lucide-react';
import type { Clause, RiskLevel } from '@/types/clause.types';
import { CLAUSE_TYPE_LABELS, RISK_LEVEL_ORDER } from '@/types/clause.types';
import { cn, riskLabelToBadgeClass } from '@/lib/utils';

// ─── Risk group header colours ────────────────────────────────

const RISK_GROUP_STYLES: Record<RiskLevel, { dot: string; label: string }> = {
    critical: { dot: 'bg-red-500', label: 'text-red-400' },
    high: { dot: 'bg-orange-500', label: 'text-orange-400' },
    medium: { dot: 'bg-amber-500', label: 'text-amber-400' },
    low: { dot: 'bg-green-500', label: 'text-green-400' },
};

// ─── Single clause row ────────────────────────────────────────

function ClauseRow({ clause }: { clause: Clause }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="border-b border-surface-border last:border-0">
            <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="group flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-elevated/50 transition-colors"
            >
                {/* Type badge */}
                <span className="mt-0.5 shrink-0 badge badge-neutral text-xs">
                    {CLAUSE_TYPE_LABELS[clause.clause_type]}
                </span>

                {/* Risk badge */}
                <span className={cn('mt-0.5 shrink-0 badge text-xs', riskLabelToBadgeClass(clause.risk_level))}>
                    {clause.risk_level}
                </span>

                {/* Page */}
                {clause.page_number !== null && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-content-muted shrink-0">
                        <BookOpen className="h-3 w-3" />
                        p.{clause.page_number}
                    </span>
                )}

                {/* Expand icon */}
                <ChevronDown
                    className={cn(
                        'ml-auto h-4 w-4 shrink-0 text-content-muted transition-transform duration-200 mt-0.5',
                        expanded && 'rotate-180',
                    )}
                />
            </button>

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        key="clause-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-3 px-4 pb-4">
                            {/* Clause text */}
                            <div className="rounded-xl bg-surface-elevated border border-surface-border p-3">
                                <p className="text-xs text-content-secondary leading-relaxed whitespace-pre-wrap">
                                    {clause.text}
                                </p>
                            </div>

                            {/* AI explanation */}
                            {clause.risk_explanation && (
                                <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                                    <p className="text-xs text-amber-200/80 leading-relaxed">
                                        {clause.risk_explanation}
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Risk group ───────────────────────────────────────────────

function RiskGroup({ level, clauses }: { level: RiskLevel; clauses: Clause[] }) {
    const [open, setOpen] = useState(level === 'critical' || level === 'high');
    const style = RISK_GROUP_STYLES[level];

    return (
        <div className="card overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-elevated/50 transition-colors"
            >
                <span className={cn('h-2 w-2 rounded-full shrink-0', style.dot)} />
                <span className={cn('text-sm font-semibold capitalize flex-1 text-left', style.label)}>
                    {level} Risk
                </span>
                <span className="text-xs text-content-muted mr-2">
                    {clauses.length} clause{clauses.length !== 1 ? 's' : ''}
                </span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 text-content-muted transition-transform duration-200',
                        open && 'rotate-180',
                    )}
                />
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key="group-body"
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden border-t border-surface-border"
                    >
                        {clauses.map((c) => (
                            <ClauseRow key={c.id} clause={c} />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────

interface ClauseListProps {
    clauses: Clause[];
    isLoading?: boolean;
}

export default function ClauseList({ clauses, isLoading = false }: ClauseListProps) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="card p-4 animate-pulse">
                        <div className="h-4 w-24 rounded-full bg-surface-elevated" />
                    </div>
                ))}
            </div>
        );
    }

    if (clauses.length === 0) {
        return (
            <div className="card flex flex-col items-center justify-center gap-3 py-12 text-center">
                <BookOpen className="h-8 w-8 text-content-muted" />
                <p className="text-sm text-content-secondary">No clauses extracted yet</p>
                <p className="text-xs text-content-muted">
                    Analysis may still be processing — check back shortly.
                </p>
            </div>
        );
    }

    // Group by risk level in defined order
    const grouped = RISK_LEVEL_ORDER.reduce<Record<RiskLevel, Clause[]>>(
        (acc, level) => ({
            ...acc,
            [level]: clauses.filter((c) => c.risk_level === level),
        }),
        { critical: [], high: [], medium: [], low: [] },
    );

    return (
        <div className="space-y-3">
            {RISK_LEVEL_ORDER.map((level) =>
                grouped[level].length > 0 ? (
                    <RiskGroup key={level} level={level} clauses={grouped[level]} />
                ) : null,
            )}
        </div>
    );
}
