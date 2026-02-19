/**
 * DashboardPage.tsx
 *
 * First screen after login. Composes:
 *  - StatsCards     (4 KPI tiles)
 *  - RiskDistChart  (donut — risk breakdown)
 *  - ContractTimeline (area chart — uploads over time)
 *  - Recent Contracts (5 most recent, links to detail)
 *  - Recent Alerts   (first 5 unread)
 *
 * Data strategy:
 *  - Stats:    GET /api/v1/dashboard/stats
 *  - Contracts (for timeline + recents): GET /api/v1/contracts?limit=10&sort=created_at&order=desc
 *  - Alerts:   GET /api/v1/alerts?is_read=false&limit=5
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    ArrowRight,
    Upload,
    Bell,
    ShieldAlert,
    FileText,
    Clock,
} from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';
import { apiGet } from '@/lib/api';
import type { DashboardStats, ContractListResponse, ContractListItem } from '@/types/contract.types';
import type { AlertListResponse } from '@/types/alert.types';
import StatsCards from '@/components/dashboard/StatsCards';
import RiskDistChart from '@/components/dashboard/RiskDistChart';
import ContractTimeline from '@/components/dashboard/ContractTimeline';
import {
    cn,
    formatDate,
    formatRelativeDate,
    formatExpiration,
    scoreToRiskLabel,
    riskLabelToBadgeClass,
    statusToBadgeClass,
    statusToLabel,
    CONTRACT_TYPE_LABELS,
} from '@/lib/utils';

// ─── Query hooks ──────────────────────────────────────────────

function useDashboardStats() {
    return useQuery({
        queryKey: queryKeys.dashboard.stats(),
        queryFn: () => apiGet<DashboardStats>('api/v1/dashboard/stats'),
        staleTime: 2 * 60 * 1000,   // matches backend 2-min cache TTL
    });
}

function useRecentContracts() {
    return useQuery({
        queryKey: queryKeys.contracts.list({
            sort: 'created_at',
            order: 'desc',
            limit: 10,
        }),
        queryFn: () =>
            apiGet<ContractListResponse>('api/v1/contracts', {
                sort: 'created_at',
                order: 'desc',
                limit: 10,
            }),
    });
}

function useRecentAlerts() {
    return useQuery({
        queryKey: queryKeys.alerts.list({ is_read: false, limit: 5 }),
        queryFn: () =>
            apiGet<AlertListResponse>('api/v1/alerts', {
                is_read: false,
                limit: 5,
            }),
    });
}

// ─── Recent Contracts sub-component ──────────────────────────

function RecentContractRow({ contract }: { contract: ContractListItem }) {
    const { isExpired, isExpiringSoon } = formatExpiration(contract.expiration_date);
    const riskLabel = scoreToRiskLabel(contract.risk_score);

    return (
        <Link
            to={`/contracts/${contract.id}`}
            className="group flex items-center gap-4 rounded-xl px-4 py-3 hover:bg-surface-elevated transition-colors"
        >
            {/* Icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
                <FileText className="h-4 w-4 text-brand-400" />
            </div>

            {/* Name + meta */}
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-content-primary truncate group-hover:text-brand-400 transition-colors">
                    {contract.name}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-content-muted">
                    <span>{CONTRACT_TYPE_LABELS[contract.type]}</span>
                    {contract.counterparty && (
                        <>
                            <span>·</span>
                            <span className="truncate max-w-[120px]">{contract.counterparty}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Status badge */}
            <span className={cn('badge', statusToBadgeClass(contract.status), 'shrink-0 hidden sm:inline-flex')}>
                {statusToLabel(contract.status)}
            </span>

            {/* Risk badge */}
            {contract.risk_score !== null && contract.status === 'active' && (
                <span className={cn('badge', riskLabelToBadgeClass(riskLabel), 'shrink-0')}>
                    {contract.risk_score}
                </span>
            )}

            {/* Expiry */}
            {contract.expiration_date && (
                <div className={cn(
                    'hidden items-center gap-1 text-xs lg:flex shrink-0',
                    isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-content-muted',
                )}>
                    <Clock className="h-3 w-3" />
                    {formatDate(contract.expiration_date)}
                </div>
            )}

            <ArrowRight className="h-4 w-4 shrink-0 text-content-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
    );
}

function RecentContractsSkeleton() {
    return (
        <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-surface-elevated" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-48 rounded-full bg-surface-elevated" />
                        <div className="h-2.5 w-32 rounded-full bg-surface-elevated" />
                    </div>
                    <div className="h-5 w-14 rounded-full bg-surface-elevated" />
                </div>
            ))}
        </div>
    );
}

// ─── Recent Alerts sub-component ─────────────────────────────

function AlertRow({ alert }: { alert: AlertListResponse['data'][number] }) {
    return (
        <Link
            to="/alerts"
            className="group flex items-start gap-3 rounded-xl px-4 py-3 hover:bg-surface-elevated transition-colors"
        >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <Bell className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm text-content-secondary truncate group-hover:text-content-primary transition-colors">
                    {alert.message}
                </p>
                <p className="mt-0.5 text-xs text-content-muted">
                    {formatRelativeDate(alert.created_at)}
                </p>
            </div>
        </Link>
    );
}

// ─── Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
    const statsQuery = useDashboardStats();
    const contractsQuery = useRecentContracts();
    const alertsQuery = useRecentAlerts();

    const contracts = contractsQuery.data?.data ?? [];
    const alerts = alertsQuery.data?.data ?? [];

    return (
        <div className="space-y-6 animate-fade-up">
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-content-primary">Dashboard</h1>
                    <p className="mt-0.5 text-sm text-content-muted">
                        Overview of your contract portfolio
                    </p>
                </div>

                <Link to="/contracts/upload" className="btn-primary gap-2">
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Upload Contract</span>
                </Link>
            </div>

            {/* ── Error banner ────────────────────────────────── */}
            {statsQuery.isError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3">
                    <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
                    <p className="text-sm text-red-300">
                        Failed to load dashboard stats.{' '}
                        <button
                            type="button"
                            onClick={() => statsQuery.refetch()}
                            className="underline hover:no-underline"
                        >
                            Retry
                        </button>
                    </p>
                </div>
            )}

            {/* ── KPI cards ───────────────────────────────────── */}
            <StatsCards
                data={statsQuery.data}
                isLoading={statsQuery.isLoading}
            />

            {/* ── Charts row ──────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Risk donut — 1 col */}
                <RiskDistChart
                    data={statsQuery.data}
                    isLoading={statsQuery.isLoading}
                />
                {/* Timeline — 2 cols */}
                <div className="lg:col-span-2">
                    <ContractTimeline
                        contracts={contracts}
                        isLoading={contractsQuery.isLoading}
                    />
                </div>
            </div>

            {/* ── Bottom row: Recent contracts + Recent alerts ── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {/* Recent contracts — 2 cols */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="card overflow-hidden xl:col-span-2"
                >
                    <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
                        <h2 className="text-sm font-semibold text-content-primary">
                            Recent Contracts
                        </h2>
                        <Link
                            to="/contracts"
                            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                        >
                            View all
                            <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="py-2">
                        {contractsQuery.isLoading ? (
                            <RecentContractsSkeleton />
                        ) : contracts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
                                    <FileText className="h-5 w-5 text-content-muted" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-content-secondary">
                                        No contracts yet
                                    </p>
                                    <p className="mt-1 text-xs text-content-muted">
                                        Upload your first contract to get started
                                    </p>
                                </div>
                                <Link to="/contracts/upload" className="btn-primary btn-sm gap-2 mt-1">
                                    <Upload className="h-3.5 w-3.5" />
                                    Upload
                                </Link>
                            </div>
                        ) : (
                            contracts.slice(0, 5).map((c) => (
                                <RecentContractRow key={c.id} contract={c} />
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Recent alerts — 1 col */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 }}
                    className="card overflow-hidden"
                >
                    <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
                        <h2 className="text-sm font-semibold text-content-primary">
                            Recent Alerts
                        </h2>
                        <Link
                            to="/alerts"
                            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                        >
                            View all
                            <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="py-2">
                        {alertsQuery.isLoading ? (
                            <div className="space-y-1 px-4 py-2 animate-pulse">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="flex gap-3 py-2">
                                        <div className="h-7 w-7 shrink-0 rounded-lg bg-surface-elevated" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-3 w-full rounded-full bg-surface-elevated" />
                                            <div className="h-2.5 w-20 rounded-full bg-surface-elevated" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : alerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
                                    <Bell className="h-5 w-5 text-content-muted" />
                                </div>
                                <p className="text-sm font-medium text-content-secondary">
                                    No unread alerts
                                </p>
                                <p className="text-xs text-content-muted">
                                    You're all caught up!
                                </p>
                            </div>
                        ) : (
                            alerts.map((a) => (
                                <AlertRow key={a.id} alert={a} />
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
