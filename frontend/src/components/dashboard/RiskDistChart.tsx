/**
 * RiskDistChart.tsx
 *
 * Recharts PieChart — risk distribution across active contracts.
 * Shows low / medium / high / critical segments with legend.
 *
 * Includes skeleton while loading and empty-state when all counts are 0.
 */
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import type { DashboardStats, RiskLabel } from '@/types/contract.types';
import { riskLabelToHex } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────

interface RiskSegment {
    name: string;
    label: RiskLabel;
    value: number;
    color: string;
}

// ─── Custom tooltip ───────────────────────────────────────────

function CustomTooltip({ active, payload }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: RiskSegment }>;
}) {
    if (!active || !payload?.length) return null;
    const item = payload[0]!;
    const total = item.payload.value;

    return (
        <div className="card px-3 py-2 text-xs shadow-xl">
            <p className="font-semibold text-content-primary capitalize">{item.name}</p>
            <p className="text-content-muted">
                {total} contract{total !== 1 ? 's' : ''}
            </p>
        </div>
    );
}

// ─── Custom legend ────────────────────────────────────────────

function CustomLegend({ segments }: { segments: RiskSegment[] }) {
    const total = segments.reduce((sum, s) => sum + s.value, 0);

    return (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
            {segments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-2">
                    <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-xs text-content-secondary capitalize flex-1">
                        {seg.name}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-content-primary">
                        {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────

function ChartSkeleton() {
    return (
        <div className="card p-5 animate-pulse h-72">
            <div className="h-3 w-32 rounded-full bg-surface-elevated mb-4" />
            <div className="flex justify-center items-center h-40">
                <div className="h-36 w-36 rounded-full bg-surface-elevated" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-3 rounded-full bg-surface-elevated" />
                ))}
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────

interface RiskDistChartProps {
    data: DashboardStats | undefined;
    isLoading: boolean;
}

export default function RiskDistChart({ data, isLoading }: RiskDistChartProps) {
    if (isLoading) return <ChartSkeleton />;

    const dist = data?.riskDistribution ?? { low: 0, medium: 0, high: 0, critical: 0 };

    const segments: RiskSegment[] = [
        { name: 'Low', label: 'low', value: dist.low, color: riskLabelToHex('low') },
        { name: 'Medium', label: 'medium', value: dist.medium, color: riskLabelToHex('medium') },
        { name: 'High', label: 'high', value: dist.high, color: riskLabelToHex('high') },
        { name: 'Critical', label: 'critical', value: dist.critical, color: riskLabelToHex('critical') },
    ];

    const total = segments.reduce((s, seg) => s + seg.value, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
            className="card p-5"
        >
            <h2 className="text-sm font-semibold text-content-primary mb-4">
                Risk Distribution
            </h2>

            {total === 0 ? (
                <div className="flex h-52 flex-col items-center justify-center gap-2 text-center">
                    <div className="h-12 w-12 rounded-full bg-surface-elevated flex items-center justify-center">
                        <span className="text-xl">📊</span>
                    </div>
                    <p className="text-sm text-content-secondary">No analysed contracts yet</p>
                    <p className="text-xs text-content-muted">Upload a contract to see risk distribution</p>
                </div>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                            <Pie
                                data={segments}
                                cx="50%"
                                cy="50%"
                                innerRadius={48}
                                outerRadius={72}
                                paddingAngle={3}
                                dataKey="value"
                                strokeWidth={0}
                                animationBegin={200}
                                animationDuration={800}
                            >
                                {segments.map((seg) => (
                                    <Cell key={seg.label} fill={seg.color} opacity={0.9} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            {/* Hidden recharts legend replaced by custom below */}
                            <Legend wrapperStyle={{ display: 'none' }} />
                        </PieChart>
                    </ResponsiveContainer>

                    <CustomLegend segments={segments} />
                </>
            )}
        </motion.div>
    );
}
