/**
 * clause.types.ts
 *
 * Frontend clause types mirroring backend API response shapes.
 * Source of truth: backend/src/db/queries/clauses.queries.ts
 */

// ─── Enums ────────────────────────────────────────────────────

export type ClauseType =
    | 'liability'
    | 'indemnification'
    | 'data_processing'
    | 'auto_renewal'
    | 'termination'
    | 'payment'
    | 'confidentiality'
    | 'ip_ownership'
    | 'warranty'
    | 'force_majeure'
    | 'governing_law'
    | 'dispute_resolution'
    | 'non_compete'
    | 'non_solicitation'
    | 'other';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

// ─── Clause ───────────────────────────────────────────────────

export interface Clause {
    id: string;
    contract_id: string;
    clause_type: ClauseType;
    text: string;
    page_number: number | null;
    risk_level: RiskLevel;
    risk_explanation: string | null;
    created_at: string;
}

// ─── Display helpers ──────────────────────────────────────────

/** Human-readable label for a clause type */
export const CLAUSE_TYPE_LABELS: Record<ClauseType, string> = {
    liability: 'Liability',
    indemnification: 'Indemnification',
    data_processing: 'Data Processing',
    auto_renewal: 'Auto-Renewal',
    termination: 'Termination',
    payment: 'Payment',
    confidentiality: 'Confidentiality',
    ip_ownership: 'IP Ownership',
    warranty: 'Warranty',
    force_majeure: 'Force Majeure',
    governing_law: 'Governing Law',
    dispute_resolution: 'Dispute Resolution',
    non_compete: 'Non-Compete',
    non_solicitation: 'Non-Solicitation',
    other: 'Other',
};

/** Ordered risk levels from highest to lowest */
export const RISK_LEVEL_ORDER: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
