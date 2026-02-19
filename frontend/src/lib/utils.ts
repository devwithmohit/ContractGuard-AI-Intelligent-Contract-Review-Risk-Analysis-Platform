/**
 * utils.ts
 *
 * Shared utility functions for the ContractGuard frontend.
 *
 * Categories:
 *  - Date formatting
 *  - Risk score / level utilities
 *  - File size formatting
 *  - Contract type / status helpers
 *  - Class name merging (clsx + tailwind-merge)
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isPast, isWithinInterval, addDays } from 'date-fns';
import type { RiskLabel } from '@/types/contract.types';
import type { RiskLevel } from '@/types/clause.types';
import type { ContractStatus, ContractType } from '@/types/contract.types';

// ─── Class merging ────────────────────────────────────────────

/**
 * Merge Tailwind class names safely.
 * Combines clsx (conditional classes) with tailwind-merge (conflict resolution).
 *
 * @example cn('px-4 py-2', isActive && 'bg-blue-500', 'px-6') → 'py-2 bg-blue-500 px-6'
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

// ─── Date formatting ──────────────────────────────────────────

/**
 * Format an ISO date string as a short "MMM d, yyyy" display date.
 * @example formatDate('2025-06-15T00:00:00Z') → 'Jun 15, 2025'
 */
export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
        return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
        return '—';
    }
}

/**
 * Format an ISO date as a relative time string (e.g. "3 days ago", "in 2 months").
 */
export function formatRelativeDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
        return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
        return '—';
    }
}

/**
 * Format a contract expiration date with urgency context.
 * Returns the text AND a flag indicating if it's expiring soon (≤30 days).
 */
export function formatExpiration(dateStr: string | null | undefined): {
    text: string;
    isExpired: boolean;
    isExpiringSoon: boolean;  // within 30 days
    isExpiring90: boolean;    // within 90 days
} {
    if (!dateStr) return { text: 'No expiration', isExpired: false, isExpiringSoon: false, isExpiring90: false };

    try {
        const date = new Date(dateStr);
        const now = new Date();

        const isExpired = isPast(date);
        const isExpiringSoon = !isExpired && isWithinInterval(date, { start: now, end: addDays(now, 30) });
        const isExpiring90 = !isExpired && isWithinInterval(date, { start: now, end: addDays(now, 90) });

        const text = isExpired
            ? `Expired ${formatRelativeDate(dateStr)}`
            : `Expires ${formatRelativeDate(dateStr)}`;

        return { text, isExpired, isExpiringSoon, isExpiring90 };
    } catch {
        return { text: '—', isExpired: false, isExpiringSoon: false, isExpiring90: false };
    }
}

// ─── File size formatting ─────────────────────────────────────

/**
 * Format bytes to a human-readable file size string.
 * @example formatFileSize(1048576) → '1.0 MB'
 */
export function formatFileSize(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined || bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);

    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ─── Risk score utilities ─────────────────────────────────────

/**
 * Convert a numeric risk score (0–100) to a risk label.
 * Matches the backend's riskAnalyzer thresholds:
 *   0–24  → low
 *   25–49 → medium
 *   50–74 → high
 *   75+   → critical
 */
export function scoreToRiskLabel(score: number | null | undefined): RiskLabel {
    if (score === null || score === undefined) return 'low';
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
}

/**
 * Get the Tailwind CSS color class for a risk label.
 * Returns text color class for use with className.
 */
export function riskLabelToColor(label: RiskLabel | RiskLevel): string {
    switch (label) {
        case 'critical': return 'text-red-400';
        case 'high': return 'text-orange-400';
        case 'medium': return 'text-amber-400';
        case 'low': return 'text-green-400';
    }
}

/**
 * Get the badge class variant for a risk label.
 */
export function riskLabelToBadgeClass(label: RiskLabel | RiskLevel): string {
    switch (label) {
        case 'critical': return 'badge-risk-critical';
        case 'high': return 'badge-risk-high';
        case 'medium': return 'badge-risk-medium';
        case 'low': return 'badge-risk-low';
    }
}

/**
 * Get a hex color value for a risk label (for use in Recharts).
 */
export function riskLabelToHex(label: RiskLabel | RiskLevel): string {
    switch (label) {
        case 'critical': return '#ef4444';  // red-500
        case 'high': return '#f97316';  // orange-500
        case 'medium': return '#f59e0b';  // amber-500
        case 'low': return '#22c55e';  // green-500
    }
}

/**
 * Get the ring / background gradient class for a risk score gauge.
 */
export function riskScoreToGradient(score: number | null | undefined): string {
    const label = scoreToRiskLabel(score);
    switch (label) {
        case 'critical': return 'from-red-600 to-red-400';
        case 'high': return 'from-orange-600 to-orange-400';
        case 'medium': return 'from-amber-600 to-amber-400';
        case 'low': return 'from-green-600 to-green-400';
    }
}

// ─── Contract status helpers ──────────────────────────────────

/**
 * Get the badge class for a contract status.
 */
export function statusToBadgeClass(status: ContractStatus): string {
    switch (status) {
        case 'processing': return 'badge-status-processing';
        case 'active': return 'badge-status-active';
        case 'error': return 'badge-status-error';
        case 'archived': return 'badge-status-archived';
    }
}

/**
 * Human-readable contract status label.
 */
export function statusToLabel(status: ContractStatus): string {
    switch (status) {
        case 'processing': return 'Analyzing…';
        case 'active': return 'Active';
        case 'error': return 'Analysis Failed';
        case 'archived': return 'Archived';
    }
}

/**
 * Human-readable contract type label (short form for cards).
 */
export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
    NDA: 'NDA',
    MSA: 'MSA',
    SaaS: 'SaaS',
    Vendor: 'Vendor',
    Employment: 'Employment',
    Other: 'Other',
};

// ─── Misc helpers ─────────────────────────────────────────────

/**
 * Truncate a string to maxLength chars, appending '…' if needed.
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 1) + '…';
}

/**
 * Generate initials (1–2 chars) from a name string.
 * @example initials('Acme Corp') → 'AC'
 */
export function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');
}

/**
 * Safely parse a number — returns null if NaN.
 */
export function safeInt(val: unknown): number | null {
    const n = Number(val);
    return isNaN(n) ? null : n;
}
