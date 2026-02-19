/**
 * contract.types.ts
 *
 * Frontend contract types mirroring backend API response shapes exactly.
 * Source of truth: backend/src/db/queries/contracts.queries.ts
 *                  backend/src/services/contract.service.ts
 */

// ─── Enums ────────────────────────────────────────────────────

export type ContractType =
    | 'NDA'
    | 'MSA'
    | 'SaaS'
    | 'Vendor'
    | 'Employment'
    | 'Other';

export type ContractStatus =
    | 'processing'
    | 'active'
    | 'error'
    | 'archived';

export type RiskLabel = 'low' | 'medium' | 'high' | 'critical';

// ─── List Item (GET /api/v1/contracts) ───────────────────────

export interface ContractListItem {
    id: string;
    name: string;
    type: ContractType;
    counterparty: string | null;
    status: ContractStatus;
    risk_score: number | null;
    expiration_date: string | null;
    auto_renewal: boolean;
    created_at: string;
}

// ─── Full Contract Record ─────────────────────────────────────

export interface Contract {
    id: string;
    org_id: string;
    uploaded_by: string;
    name: string;
    type: ContractType;
    counterparty: string | null;
    status: ContractStatus;
    file_path: string;
    file_size: number;
    file_type: string;
    raw_text: string | null;
    effective_date: string | null;
    expiration_date: string | null;
    auto_renewal: boolean;
    risk_score: number | null;
    summary: string | null;
    created_at: string;
    updated_at: string;
    last_analyzed_at: string | null;
}

// ─── Contract Detail (GET /api/v1/contracts/:id) ─────────────

export interface RiskBreakdownItem {
    clauseType: string;
    weight: number;
    score: number;
    explanation: string;
}

export interface ClauseBreakdownItem {
    clauseType: string;
    count: number;
    maxRisk: RiskLabel;
    avgScore: number;
}

export interface ContractDetail extends Contract {
    clauses: import('./clause.types').Clause[];
    signedUrl: string | null;
    signedUrlExpiresAt: string | null;
    riskBreakdown: RiskBreakdownItem[];
}

// ─── Risk Breakdown (GET /api/v1/contracts/:id/risks) ─────────

export interface ClausesByRisk {
    critical: import('./clause.types').Clause[];
    high: import('./clause.types').Clause[];
    medium: import('./clause.types').Clause[];
    low: import('./clause.types').Clause[];
}

export interface ContractRiskBreakdown {
    overallScore: number;
    riskLabel: RiskLabel;
    clausesByRisk: ClausesByRisk;
    clauseBreakdown: ClauseBreakdownItem[];
    riskBreakdown: RiskBreakdownItem[];
    missingClauses: string[];
}

// ─── Upload Response (POST /api/v1/contracts/upload) ──────────

export interface UploadResponse {
    contractId: string;
    jobId: string;
    status: 'processing';
    message: string;
}

// ─── Analyze Response (POST /api/v1/contracts/:id/analyze) ───

export interface AnalyzeResponse {
    contractId: string;
    jobId: string;
    status: 'processing';
    message: string;
}

// ─── Paginated List Response ──────────────────────────────────

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface ContractListResponse {
    data: ContractListItem[];
    pagination: PaginationMeta;
}

// ─── Dashboard (GET /api/v1/dashboard/stats) ──────────────────

export interface DashboardStats {
    totalContracts: number;
    activeContracts: number;
    avgRiskScore: number;
    expiringSoon: number;
    criticalRiskCount: number;
    typeDistribution: Record<ContractType, number>;
    riskDistribution: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
}

// ─── List Filters (shared with API params) ───────────────────

export interface ContractListFilters {
    status?: ContractStatus;
    type?: ContractType;
    risk_min?: number;
    risk_max?: number;
    search?: string;
    sort?: 'created_at' | 'risk_score' | 'expiration_date';
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
}
