/**
 * StatsCards.tsx
 *
 * Four KPI stat cards for the dashboard:
 *  - Total Contracts
 *  - Average Risk Score (colour-coded by level)
 *  - Expiring Soon (next 30 days)
 *  - Critical Risk Contracts
 *
 * Shows skeleton loaders while data is fetching.
 */
import { motion } from 'framer-motion';
import {
    FileText,
    TrendingUp,
    Clock,
    AlertTriangle,
} from 'lucide-react';
import type { DashboardStats } from '@/types/contract.types';
import { scoreToRiskLabel, riskLabelToColor, riskLabelToHex, cn } from '@/lib/utils';

// ─── Skeleton ─────────────────────────────────────────────────

function StatCardSkeleton() {
    return (
        <div className="card p-5 animate-pulse">
            <div className="flex items-center justify-between mb-4">
                <div className="h-3 w-24 rounded-full bg-surface-elevated" />
                <div className="h-9 w-9 rounded-xl bg-surface-elevated" />
            </div>
            <div className="h-8 w-16 rounded-lg bg-surface-elevated mb-1" />
            <div className="h-3 w-28 rounded-full bg-surface-elevated" />
        </div>
    );
}

// ─── Single card ──────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: string | number;
    subtext: string;
    icon: React.ReactNode;
    iconBg: string;
    valueColor?: string;
    index: number;
}

function StatCard({ label, value, subtext, icon, iconBg, valueColor, index }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.07, ease: 'easeOut' }}
            className="card p-5 hover:border-brand-500/30 transition-colors group"
        >
            <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-content-muted uppercase tracking-wide">
                    {label}
                </p>
                <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110',
                    iconBg,
                )}>
                    {icon}
                </div>
            </div>

            <p className={cn(
                'text-3xl font-black tabular-nums leading-none mb-1',
                valueColor ?? 'text-content-primary',
            )}>
                {value}
            </p>

            <p className="text-xs text-content-muted">{subtext}</p>
        </motion.div>
    );
}

// ─── Main component ───────────────────────────────────────────

interface StatsCardsProps {
    data: DashboardStats | undefined;
    isLoading: boolean;
}

export default function StatsCards({ data, isLoading }: StatsCardsProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <StatCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    const avgScore = data?.avgRiskScore ?? 0;
    const riskLabel = scoreToRiskLabel(avgScore);
    const riskColor = riskLabelToColor(riskLabel);
    const riskHex = riskLabelToHex(riskLabel);

    const cards: StatCardProps[] = [
        {
            label: 'Total Contracts',
            value: data?.totalContracts ?? 0,
            subtext: `${data?.activeContracts ?? 0} active`,
            icon: <FileText className="h-4 w-4 text-brand-400" />,
            iconBg: 'bg-brand-500/15',
            index: 0,
        },
        {
            label: 'Avg Risk Score',
            value: avgScore,
            subtext: `${riskLabel.charAt(0).toUpperCase() + riskLabel.slice(1)} overall risk`,
            icon: (
                <TrendingUp
                    className="h-4 w-4"
                    style={{ color: riskHex }}
                />
            ),
            iconBg: 'bg-surface-elevated',
            valueColor: riskColor,
            index: 1,
        },
        {
            label: 'Expiring Soon',
            value: data?.expiringSoon ?? 0,
            subtext: 'Within 30 days',
            icon: <Clock className="h-4 w-4 text-amber-400" />,
            iconBg: 'bg-amber-500/15',
            valueColor: (data?.expiringSoon ?? 0) > 0 ? 'text-amber-400' : undefined,
            index: 2,
        },
        {
            label: 'Critical Risk',
            value: data?.criticalRiskCount ?? 0,
            subtext: 'Score ≥ 75',
            icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
            iconBg: 'bg-red-500/15',
            valueColor: (data?.criticalRiskCount ?? 0) > 0 ? 'text-red-400' : undefined,
            index: 3,
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
                <StatCard key={card.label} {...card} />
            ))}
        </div>
    );
}
