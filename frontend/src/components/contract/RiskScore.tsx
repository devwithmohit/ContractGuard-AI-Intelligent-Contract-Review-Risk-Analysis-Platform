/**
 * RiskScore.tsx
 *
 * Circular SVG progress ring gauge showing a contract's overall risk score 0–100.
 * Colour coding: green (<25) → amber (25–49) → orange (50–74) → red (≥75).
 *
 * Usage:
 *   <RiskScore score={72} size="lg" showLabel />
 */
import { cn, scoreToRiskLabel, riskLabelToHex } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────

type Size = 'sm' | 'md' | 'lg' | 'xl';

interface RiskScoreProps {
    score: number | null;
    size?: Size;
    showLabel?: boolean;
    className?: string;
    animate?: boolean;
}

// ─── Size config ──────────────────────────────────────────────

const SIZE_MAP: Record<Size, { px: number; stroke: number; fontSize: string; labelSize: string }> = {
    sm: { px: 40, stroke: 4, fontSize: 'text-xs', labelSize: 'text-[10px]' },
    md: { px: 64, stroke: 5, fontSize: 'text-base', labelSize: 'text-xs' },
    lg: { px: 96, stroke: 6, fontSize: 'text-2xl', labelSize: 'text-xs' },
    xl: { px: 128, stroke: 7, fontSize: 'text-4xl', labelSize: 'text-sm' },
};

// ─── Component ────────────────────────────────────────────────

export default function RiskScore({
    score,
    size = 'md',
    showLabel = false,
    className,
    animate = true,
}: RiskScoreProps) {
    const cfg = SIZE_MAP[size];
    const radius = (cfg.px - cfg.stroke * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const safeScore = score ?? 0;
    const pct = Math.min(100, Math.max(0, safeScore));
    const offset = circumference - (pct / 100) * circumference;
    const label = scoreToRiskLabel(score);
    const color = riskLabelToHex(label);

    if (score === null) {
        return (
            <div
                className={cn(
                    'flex flex-col items-center gap-1',
                    className,
                )}
                style={{ width: cfg.px, height: cfg.px }}
            >
                <div
                    className="rounded-full bg-surface-elevated animate-pulse"
                    style={{ width: cfg.px, height: cfg.px }}
                />
                {showLabel && (
                    <span className="text-xs text-content-muted">Analysing…</span>
                )}
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col items-center gap-1.5', className)}>
            <div className="relative flex items-center justify-center" style={{ width: cfg.px, height: cfg.px }}>
                <svg
                    width={cfg.px}
                    height={cfg.px}
                    viewBox={`0 0 ${cfg.px} ${cfg.px}`}
                    className="-rotate-90"
                    aria-label={`Risk score: ${safeScore}`}
                    role="img"
                >
                    {/* Track */}
                    <circle
                        cx={cfg.px / 2}
                        cy={cfg.px / 2}
                        r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={cfg.stroke}
                    />
                    {/* Progress ring */}
                    <circle
                        cx={cfg.px / 2}
                        cy={cfg.px / 2}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={cfg.stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{
                            transition: animate ? 'stroke-dashoffset 0.8s ease-out' : undefined,
                        }}
                    />
                </svg>

                {/* Centre label */}
                <div className="absolute flex flex-col items-center leading-none">
                    <span
                        className={cn('font-black tabular-nums', cfg.fontSize)}
                        style={{ color }}
                    >
                        {safeScore}
                    </span>
                </div>
            </div>

            {showLabel && (
                <span
                    className={cn('font-semibold capitalize', cfg.labelSize)}
                    style={{ color }}
                >
                    {label} risk
                </span>
            )}
        </div>
    );
}
