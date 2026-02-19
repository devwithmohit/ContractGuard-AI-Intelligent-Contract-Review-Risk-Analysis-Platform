/**
 * AlertsPage.tsx
 *
 * Full alert management page.
 *
 * Features:
 *  - Filter tabs: All / Unread / Expiration / Renewal / Risk / Compliance
 *  - "Mark all read" bulk action
 *  - Per-alert actions: mark read, snooze (7d/30d/custom), dismiss
 *  - Days-until badge with urgency colours
 *  - Supabase Realtime — new alerts appear live
 *  - Pagination
 *  - Skeleton loaders, empty + error states
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    BellOff,
    Clock,
    RefreshCw,
    AlertTriangle,
    Shield,
    Check,
    CheckCheck,
    Trash2,
    ChevronLeft,
    ChevronRight,
    FileText,
    Eye,
} from 'lucide-react';
import {
    useAlertList,
    useSnoozeAlert,
    useMarkRead,
    useMarkAllRead,
    useDismissAlert,
    useAlertsRealtime,
} from '@/hooks/useAlerts';
import { cn, formatDate, formatRelativeDate } from '@/lib/utils';
import type { Alert, AlertType, AlertListFilters } from '@/types/alert.types';
import { addDays, differenceInDays } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 15;

interface TabDef {
    id: string;
    label: string;
    filters: Partial<AlertListFilters>;
    icon: React.ReactNode;
}

const TABS: TabDef[] = [
    { id: 'all', label: 'All', filters: {}, icon: <Bell className="h-3.5 w-3.5" /> },
    { id: 'unread', label: 'Unread', filters: { is_read: false }, icon: <Eye className="h-3.5 w-3.5" /> },
    { id: 'expiration', label: 'Expiring', filters: { alert_type: 'expiration' }, icon: <Clock className="h-3.5 w-3.5" /> },
    { id: 'renewal', label: 'Renewal', filters: { alert_type: 'renewal' }, icon: <RefreshCw className="h-3.5 w-3.5" /> },
    { id: 'risk', label: 'Risk', filters: { alert_type: 'risk' }, icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { id: 'compliance', label: 'Compliance', filters: { alert_type: 'compliance' }, icon: <Shield className="h-3.5 w-3.5" /> },
];

// ─── Alert type helpers ───────────────────────────────────────

function alertTypeIcon(type: AlertType) {
    switch (type) {
        case 'expiration': return <Clock className="h-4 w-4" />;
        case 'renewal': return <RefreshCw className="h-4 w-4" />;
        case 'risk': return <AlertTriangle className="h-4 w-4" />;
        case 'compliance': return <Shield className="h-4 w-4" />;
    }
}

function alertTypeStyles(type: AlertType) {
    switch (type) {
        case 'expiration': return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/20' };
        case 'renewal': return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/20' };
        case 'risk': return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/20' };
        case 'compliance': return { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/20' };
    }
}

// ─── Days-until badge ─────────────────────────────────────────

function DaysUntilBadge({ triggerDate }: { triggerDate: string }) {
    const days = differenceInDays(new Date(triggerDate), new Date());

    let color: string;
    let label: string;

    if (days < 0) {
        color = 'bg-red-500/20 text-red-400';
        label = `${Math.abs(days)}d overdue`;
    } else if (days === 0) {
        color = 'bg-red-500/20 text-red-400';
        label = 'Today';
    } else if (days <= 7) {
        color = 'bg-amber-500/20 text-amber-400';
        label = `${days}d left`;
    } else if (days <= 30) {
        color = 'bg-yellow-500/15 text-yellow-400';
        label = `${days}d left`;
    } else {
        color = 'bg-zinc-500/15 text-zinc-400';
        label = `${days}d left`;
    }

    return (
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', color)}>
            {label}
        </span>
    );
}

// ─── Snooze popover ───────────────────────────────────────────

function SnoozeMenu({
    alertId,
    onClose,
}: {
    alertId: string;
    onClose: () => void;
}) {
    const snoozeMutation = useSnoozeAlert();

    function snoozeFor(days: number) {
        const until = addDays(new Date(), days).toISOString();
        snoozeMutation.mutate({ alertId, snoozedUntil: until });
        onClose();
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-surface-border bg-surface-card p-1 shadow-xl"
        >
            <p className="px-2 py-1.5 text-[11px] font-semibold text-content-muted uppercase tracking-wide">
                Snooze for…
            </p>
            {[
                { label: '1 day', days: 1 },
                { label: '3 days', days: 3 },
                { label: '7 days', days: 7 },
                { label: '30 days', days: 30 },
            ].map((opt) => (
                <button
                    key={opt.days}
                    type="button"
                    onClick={() => snoozeFor(opt.days)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-content-secondary hover:bg-surface-elevated hover:text-content-primary transition-colors"
                >
                    <BellOff className="h-3 w-3" />
                    {opt.label}
                </button>
            ))}
        </motion.div>
    );
}

// ─── Alert row ────────────────────────────────────────────────

function AlertRow({
    alert,
    index,
}: {
    alert: Alert;
    index: number;
}) {
    const [showSnooze, setShowSnooze] = useState(false);
    const markReadMutation = useMarkRead();
    const dismissMutation = useDismissAlert();

    const typeStyle = alertTypeStyles(alert.alert_type);
    const isSnoozed = alert.snoozed_until && new Date(alert.snoozed_until) > new Date();

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.03, ease: 'easeOut' }}
            className={cn(
                'card group flex items-start gap-4 p-4 transition-all duration-200',
                !alert.is_read && 'border-l-2 border-l-brand-500',
                isSnoozed && 'opacity-60',
            )}
        >
            {/* Icon */}
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', typeStyle.bg, typeStyle.text)}>
                {alertTypeIcon(alert.alert_type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className={cn(
                            'text-sm leading-snug',
                            alert.is_read ? 'text-content-secondary' : 'text-content-primary font-medium',
                        )}>
                            {alert.message}
                        </p>

                        {/* Contract link */}
                        {alert.contract_name && (
                            <Link
                                to={`/contracts/${alert.contract_id}`}
                                className="mt-1 inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                            >
                                <FileText className="h-3 w-3" />
                                {alert.contract_name}
                            </Link>
                        )}
                    </div>

                    {/* Right: days badge + timestamp */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <DaysUntilBadge triggerDate={alert.trigger_date} />
                        <span className="text-[11px] text-content-muted">
                            {formatRelativeDate(alert.created_at)}
                        </span>
                    </div>
                </div>

                {/* Snoozed notice */}
                {isSnoozed && (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-amber-400">
                        <BellOff className="h-3 w-3" />
                        Snoozed until {formatDate(alert.snoozed_until!)}
                    </span>
                )}

                {/* Actions row */}
                <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!alert.is_read && (
                        <button
                            type="button"
                            onClick={() => markReadMutation.mutate(alert.id)}
                            disabled={markReadMutation.isPending}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-content-muted hover:bg-surface-elevated hover:text-content-primary transition-colors"
                        >
                            <Check className="h-3 w-3" />
                            Mark read
                        </button>
                    )}

                    {/* Snooze */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowSnooze((s) => !s)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-content-muted hover:bg-surface-elevated hover:text-content-primary transition-colors"
                        >
                            <BellOff className="h-3 w-3" />
                            Snooze
                        </button>
                        <AnimatePresence>
                            {showSnooze && (
                                <SnoozeMenu alertId={alert.id} onClose={() => setShowSnooze(false)} />
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Dismiss */}
                    <button
                        type="button"
                        onClick={() => {
                            if (window.confirm('Permanently dismiss this alert?')) {
                                dismissMutation.mutate(alert.id);
                            }
                        }}
                        disabled={dismissMutation.isPending}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                        <Trash2 className="h-3 w-3" />
                        Dismiss
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────

function AlertSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="card flex items-start gap-4 p-4 animate-pulse">
                    <div className="h-9 w-9 rounded-xl bg-surface-elevated" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-3/4 rounded-full bg-surface-elevated" />
                        <div className="h-3 w-1/2 rounded-full bg-surface-elevated" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-surface-elevated" />
                </div>
            ))}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────

export default function AlertsPage() {
    const [activeTab, setActiveTab] = useState('all');
    const [page, setPage] = useState(1);

    // Derive filters from active tab
    const tab = TABS.find((t) => t.id === activeTab)!;
    const filters: AlertListFilters = useMemo(
        () => ({
            ...tab.filters,
            include_snoozed: true,
            page,
            limit: PAGE_SIZE,
        }),
        [tab, page],
    );

    const alertsQuery = useAlertList(filters);
    const markAllReadMutation = useMarkAllRead();

    // Realtime invalidation
    useAlertsRealtime();

    const alerts = alertsQuery.data?.data ?? [];
    const pagination = alertsQuery.data?.pagination;
    const totalPages = pagination?.totalPages ?? 1;
    const total = pagination?.total ?? 0;

    // Count unread across current results (for header badge)
    const unreadInView = alerts.filter((a) => !a.is_read).length;

    return (
        <div className="mx-auto max-w-3xl space-y-6 animate-fade-up">
            {/* ── Header ──────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-content-primary">Alerts</h1>
                    <p className="mt-0.5 text-sm text-content-muted">
                        Contract expirations, renewals, and risk notifications
                    </p>
                </div>

                {unreadInView > 0 && (
                    <button
                        type="button"
                        id="mark-all-read-btn"
                        onClick={() => markAllReadMutation.mutate()}
                        disabled={markAllReadMutation.isPending}
                        className="btn-secondary btn-sm gap-1.5 disabled:opacity-50"
                    >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all read
                    </button>
                )}
            </div>

            {/* ── Tab bar ─────────────────────────────────── */}
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-surface-border bg-surface-card p-1">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => { setActiveTab(t.id); setPage(1); }}
                        className={cn(
                            'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                            activeTab === t.id
                                ? 'bg-brand-500/15 text-brand-400 shadow-sm'
                                : 'text-content-muted hover:text-content-secondary hover:bg-surface-elevated',
                        )}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Error ───────────────────────────────────── */}
            {alertsQuery.isError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center justify-between">
                    <span>Failed to load alerts.</span>
                    <button
                        type="button"
                        onClick={() => void alertsQuery.refetch()}
                        className="text-xs text-red-400 underline hover:text-red-300"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* ── Loading ─────────────────────────────────── */}
            {alertsQuery.isLoading && <AlertSkeleton />}

            {/* ── Alert list ──────────────────────────────── */}
            {!alertsQuery.isLoading && (
                alerts.length > 0 ? (
                    <div className="space-y-3">
                        {alerts.map((alert, i) => (
                            <AlertRow key={alert.id} alert={alert} index={i} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated">
                            <Bell className="h-6 w-6 text-content-muted" />
                        </div>
                        <div>
                            <p className="font-medium text-content-secondary">No alerts</p>
                            <p className="mt-1 text-sm text-content-muted">
                                {activeTab === 'unread'
                                    ? "You're all caught up! No unread alerts."
                                    : 'No alerts match the current filter.'}
                            </p>
                        </div>
                    </div>
                )
            )}

            {/* ── Pagination ──────────────────────────────── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-content-muted">
                        Page {page} of {totalPages} · {total} alert{total !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-1">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="rounded-lg border border-surface-border bg-surface-card p-1.5 text-content-muted hover:text-content-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            className="rounded-lg border border-surface-border bg-surface-card p-1.5 text-content-muted hover:text-content-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
