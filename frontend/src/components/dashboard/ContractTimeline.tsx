/**
 * ContractTimeline.tsx
 *
 * Recharts AreaChart — contracts uploaded over time (by month).
 *
 * Note: The backend dashboard/stats endpoint does NOT return timeline data.
 * This component derives a time-bucketed view from the contract list query
 * (last 6 months of data, up to 200 contracts). Data is passed in from
 * DashboardPage which queries /api/v1/contracts with no filters (limit 200).
 *
 * Falls back to a placeholder chart with empty-state when no data.
 */
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import type { ContractListItem } from '@/types/contract.types';

// ─── Data transform ───────────────────────────────────────────

interface TimelinePoint {
    month: string;       // e.g. "Jun '25"
    contracts: number;
}

/**
 * Bucket a list of contracts into monthly counts (last N months).
 */
function buildTimeline(contracts: ContractListItem[], months = 6): TimelinePoint[] {
    const now = new Date();
    return Array.from({ length: months }, (_, i) => {
        const date = subMonths(now, months - 1 - i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        const count = contracts.filter((c) => {
            const created = parseISO(c.created_at);
            return created >= start && created <= end;
        }).length;

        return {
            month: format(date, "MMM ''yy"),
            contracts: count,
        };
    });
}

// ─── Custom tooltip ───────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    const count = payload[0]!.value;

    return (
        <div className="card px-3 py-2 text-xs shadow-xl">
            <p className="text-content-muted mb-0.5">{label}</p>
            <p className="font-semibold text-content-primary">
                {count} contract{count !== 1 ? 's' : ''} uploaded
            </p>
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────

function ChartSkeleton() {
    return (
        <div className="card p-5 animate-pulse h-72">
            <div className="h-3 w-40 rounded-full bg-surface-elevated mb-4" />
            <div className="h-48 rounded-xl bg-surface-elevated" />
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────

interface ContractTimelineProps {
    contracts: ContractListItem[] | undefined;
    isLoading: boolean;
}

export default function ContractTimeline({ contracts, isLoading }: ContractTimelineProps) {
    if (isLoading) return <ChartSkeleton />;

    const timeline = buildTimeline(contracts ?? []);
    const total = timeline.reduce((s, p) => s + p.contracts, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
            className="card p-5"
        >
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-content-primary">
                    Contracts Over Time
                </h2>
                <span className="text-xs text-content-muted">Last 6 months</span>
            </div>

            {total === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                    <div className="h-12 w-12 rounded-full bg-surface-elevated flex items-center justify-center">
                        <span className="text-xl">📈</span>
                    </div>
                    <p className="text-sm text-content-secondary">No contracts yet</p>
                    <p className="text-xs text-content-muted">Upload your first contract to see activity</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={188}>
                    <AreaChart
                        data={timeline}
                        margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="contractsGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.04)"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="contracts"
                            stroke="#6366f1"
                            strokeWidth={2}
                            fill="url(#contractsGrad)"
                            dot={false}
                            activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                            animationDuration={800}
                            animationBegin={200}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </motion.div>
    );
}
