/**
 * ContractDetailPage.tsx
 *
 * Dual-panel layout for a single contract:
 *  LEFT  — PDF viewer (iframe, full height)
 *  RIGHT — Analysis panel:
 *            · Header (name, status, actions)
 *            · RiskScore gauge + key metadata
 *            · Risk breakdown bar chart (top contributors)
 *            · ClauseList (grouped by risk level)
 *
 * Real-time: subscribes to Supabase Realtime on the contract row so that
 * when AI analysis completes (status: processing → active) the page
 * refetches automatically without a page reload.
 */
import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Archive,
    Calendar,
    Building2,
    FileType,
    RotateCcw,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import {
    useContractDetail,
    useContractRisks,
    useReanalyzeContract,
    useArchiveContract,
    useDeleteContract,
} from '@/hooks/useContracts';
import PDFViewer from '@/components/contract/PDFViewer';
import RiskScore from '@/components/contract/RiskScore';
import ClauseList from '@/components/contract/ClauseList';
import {
    cn,
    formatDate,
    formatExpiration,
    riskLabelToHex,
    scoreToRiskLabel,
    statusToBadgeClass,
    statusToLabel,
    CONTRACT_TYPE_LABELS,
} from '@/lib/utils';

// ─── Status icon ──────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
    if (status === 'processing')
        return <Loader2 className="h-4 w-4 animate-spin text-brand-400" />;
    if (status === 'active')
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    if (status === 'error')
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
    return null;
}

// ─── Risk breakdown bars ──────────────────────────────────────

function RiskBreakdownBar({ label, score }: { label: string; score: number }) {
    const riskLabel = scoreToRiskLabel(score);
    const color = riskLabelToHex(riskLabel);

    return (
        <div>
            <div className="mb-1 flex justify-between text-xs">
                <span className="capitalize text-content-secondary">{label}</span>
                <span className="font-mono font-semibold" style={{ color }}>{score}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
}

// ─── Detail skeleton ──────────────────────────────────────────

function DetailSkeleton() {
    return (
        <div className="flex h-full flex-col gap-4 animate-pulse">
            <div className="h-8 w-3/4 rounded-xl bg-surface-elevated" />
            <div className="h-4 w-1/2 rounded-full bg-surface-elevated" />
            <div className="mt-4 h-32 w-full rounded-2xl bg-surface-elevated" />
            <div className="h-24 w-full rounded-2xl bg-surface-elevated" />
            <div className="flex-1 rounded-2xl bg-surface-elevated" />
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────

export default function ContractDetailPage() {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();


    const detailQuery = useContractDetail(id);
    const risksQuery = useContractRisks(id);
    const reanalyzeMutation = useReanalyzeContract();
    const archiveMutation = useArchiveContract();
    const deleteMutation = useDeleteContract();

    const contract = detailQuery.data;
    const risks = risksQuery.data;

    // ── Realtime — refetch when status changes ────────────────

    useEffect(() => {
        if (!id) return;

        const channel = supabase
            .channel(`contract-${id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'contracts',
                filter: `id=eq.${id}`,
            }, () => {
                void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(id) });
                void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.risks(id) });
            })
            .subscribe();

        return () => { void supabase.removeChannel(channel); };
    }, [id, queryClient]);

    // ── 404 / error ───────────────────────────────────────────

    if (detailQuery.isError) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center animate-fade-up">
                <AlertTriangle className="h-10 w-10 text-red-400" />
                <h1 className="text-xl font-bold text-content-primary">Contract not found</h1>
                <p className="text-sm text-content-muted">
                    This contract may have been deleted or you don't have access.
                </p>
                <Link to="/contracts" className="btn-primary">
                    Back to contracts
                </Link>
            </div>
        );
    }

    const { isExpired, isExpiringSoon } = formatExpiration(contract?.expiration_date ?? null);

    return (
        <div className="flex h-full flex-col gap-4 animate-fade-up">
            {/* ── Breadcrumb + actions ────────────────── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <Link
                        to="/contracts"
                        className="flex items-center gap-1.5 text-sm text-content-muted hover:text-content-primary transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Contracts
                    </Link>
                    <span className="text-surface-border">/</span>
                    <span className="text-sm text-content-secondary truncate max-w-[200px]">
                        {contract?.name ?? '…'}
                    </span>
                </div>

                {contract && (
                    <div className="flex items-center gap-2">
                        <button
                            id="contract-reanalyze-btn"
                            type="button"
                            onClick={() => reanalyzeMutation.mutate(contract.id)}
                            disabled={reanalyzeMutation.isPending || contract.status === 'processing'}
                            className="flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface-card px-3 py-1.5 text-sm text-content-secondary hover:border-brand-500/30 hover:text-brand-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Re-run AI analysis"
                        >
                            <RotateCcw className={cn('h-3.5 w-3.5', reanalyzeMutation.isPending && 'animate-spin')} />
                            <span className="hidden sm:inline">Re-analyse</span>
                        </button>

                        <button
                            id="contract-archive-btn"
                            type="button"
                            onClick={() => {
                                if (window.confirm('Archive this contract? It will be hidden from the active list.')) {
                                    archiveMutation.mutate(contract.id);
                                }
                            }}
                            disabled={archiveMutation.isPending || contract.status === 'archived'}
                            className="flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface-card px-3 py-1.5 text-sm text-content-secondary hover:border-red-500/30 hover:text-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {archiveMutation.isPending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Archive className="h-3.5 w-3.5" />
                            }
                            <span className="hidden sm:inline">Archive</span>
                        </button>

                        <button
                            id="contract-delete-btn"
                            type="button"
                            onClick={() => {
                                const name = contract.name;
                                const typed = window.prompt(
                                    `This action cannot be undone. Type "${name}" to confirm deletion.`,
                                );
                                if (typed === name) {
                                    deleteMutation.mutate(contract.id);
                                } else if (typed !== null) {
                                    window.alert('Contract name did not match. Deletion cancelled.');
                                }
                            }}
                            disabled={deleteMutation.isPending}
                            className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {deleteMutation.isPending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                            }
                            <span className="hidden sm:inline">Delete</span>
                        </button>
                    </div>
                )}
            </div>

            {/* ── Dual panel layout ────────────────────── */}
            <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
                {/* LEFT — PDF viewer */}
                <PDFViewer
                    signedUrl={contract?.signedUrl ?? null}
                    contractName={contract?.name}
                    className="min-h-[500px] lg:min-h-0 lg:h-full"
                />

                {/* RIGHT — Analysis panel */}
                <div className="flex flex-col gap-4 overflow-y-auto lg:max-h-[calc(100vh-8rem)]">
                    {detailQuery.isLoading ? (
                        <DetailSkeleton />
                    ) : contract ? (
                        <>
                            {/* Name + status */}
                            <div className="card p-5">
                                <div className="mb-3 flex items-center gap-2">
                                    <StatusIcon status={contract.status} />
                                    <span className={cn('badge', statusToBadgeClass(contract.status))}>
                                        {statusToLabel(contract.status)}
                                    </span>
                                    {contract.status === 'processing' && (
                                        <span className="text-xs text-content-muted animate-pulse">
                                            AI analysis in progress…
                                        </span>
                                    )}
                                </div>

                                <h1 className="text-lg font-bold text-content-primary leading-tight">
                                    {contract.name}
                                </h1>

                                {/* Meta grid */}
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="flex items-center gap-2 text-xs text-content-muted">
                                        <FileType className="h-3.5 w-3.5 shrink-0" />
                                        {CONTRACT_TYPE_LABELS[contract.type]}
                                    </div>
                                    {contract.counterparty && (
                                        <div className="flex items-center gap-2 text-xs text-content-muted">
                                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">{contract.counterparty}</span>
                                        </div>
                                    )}
                                    {contract.effective_date && (
                                        <div className="flex items-center gap-2 text-xs text-content-muted">
                                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                                            Effective {formatDate(contract.effective_date)}
                                        </div>
                                    )}
                                    {contract.expiration_date && (
                                        <div className={cn(
                                            'flex items-center gap-2 text-xs',
                                            isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-content-muted',
                                        )}>
                                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                                            {isExpired ? 'Expired' : 'Expires'} {formatDate(contract.expiration_date)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Risk score + summary */}
                            {contract.status === 'active' && (
                                <div className="card p-5">
                                    <div className="flex items-center gap-6">
                                        <RiskScore
                                            score={contract.risk_score}
                                            size="lg"
                                            showLabel
                                            animate
                                        />
                                        <div className="flex-1">
                                            {contract.summary ? (
                                                <p className="text-xs text-content-secondary leading-relaxed">
                                                    {contract.summary}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-content-muted italic">
                                                    No summary available.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Risk breakdown */}
                            {risks && risks.riskBreakdown.length > 0 && (
                                <div className="card p-5">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h2 className="text-sm font-semibold text-content-primary">
                                            Risk Breakdown
                                        </h2>
                                        {risks.missingClauses.length > 0 && (
                                            <span className="flex items-center gap-1 text-xs text-amber-400">
                                                <AlertTriangle className="h-3 w-3" />
                                                {risks.missingClauses.length} missing
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        {risks.riskBreakdown
                                            .sort((a, b) => b.score - a.score)
                                            .slice(0, 6)
                                            .map((item) => (
                                                <RiskBreakdownBar
                                                    key={item.clauseType}
                                                    label={item.clauseType.replace(/_/g, ' ')}
                                                    score={item.score}
                                                />
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Missing clauses notice */}
                            {risks && risks.missingClauses.length > 0 && (
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                                    <p className="mb-2 text-xs font-semibold text-amber-300">
                                        Missing clauses detected
                                    </p>
                                    <ul className="space-y-1">
                                        {risks.missingClauses.map((mc) => (
                                            <li key={mc} className="flex items-center gap-2 text-xs text-amber-200/70">
                                                <span className="h-1 w-1 rounded-full bg-amber-400" />
                                                {mc.replace(/_/g, ' ')}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Clause list */}
                            <div>
                                <h2 className="mb-3 text-sm font-semibold text-content-primary">
                                    Clauses <span className="text-content-muted font-normal">({contract.clauses?.length ?? 0})</span>
                                </h2>
                                <ClauseList
                                    clauses={contract.clauses ?? []}
                                    isLoading={detailQuery.isLoading}
                                />
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
