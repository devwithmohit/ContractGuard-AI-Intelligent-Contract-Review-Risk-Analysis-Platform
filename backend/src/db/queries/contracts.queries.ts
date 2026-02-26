import { query, transaction } from '../client.js';

// ─── Types ───────────────────────────────────────────────────

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

export type ContractType = 'NDA' | 'MSA' | 'SaaS' | 'Vendor' | 'Employment' | 'Other';
export type ContractStatus = 'processing' | 'active' | 'error' | 'archived';

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

export interface ContractInsert {
    org_id: string;
    uploaded_by: string;
    name: string;
    type: ContractType;
    counterparty?: string;
    file_path: string;
    file_size: number;
    file_type: string;
}

export interface ContractListFilters {
    org_id: string;
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

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

// ─── Queries ─────────────────────────────────────────────────

/**
 * Insert a new contract record (status = 'processing')
 */
export async function insertContract(data: ContractInsert): Promise<Contract> {
    const result = await query<Contract>(
        `INSERT INTO contracts (org_id, uploaded_by, name, type, counterparty, file_path, file_size, file_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
        [
            data.org_id,
            data.uploaded_by,
            data.name,
            data.type,
            data.counterparty ?? null,
            data.file_path,
            data.file_size,
            data.file_type,
        ],
    );
    return result.rows[0]!;
}

/**
 * Get a single contract by ID (scoped to org)
 */
export async function getContractById(
    contractId: string,
    orgId: string,
): Promise<Contract | null> {
    const result = await query<Contract>(
        `SELECT * FROM contracts WHERE id = $1 AND org_id = $2`,
        [contractId, orgId],
    );
    return result.rows[0] ?? null;
}

/**
 * List contracts with filtering, sorting, and pagination
 */
export async function listContracts(
    filters: ContractListFilters,
): Promise<{ data: ContractListItem[]; pagination: PaginationMeta }> {
    const {
        org_id,
        status,
        type,
        risk_min,
        risk_max,
        search,
        sort = 'created_at',
        order = 'desc',
        page = 1,
        limit = 20,
    } = filters;

    const conditions: string[] = ['org_id = $1'];
    const params: unknown[] = [org_id];
    let paramIndex = 2;

    if (status) {
        conditions.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
    }

    if (type) {
        conditions.push(`type = $${paramIndex}`);
        params.push(type);
        paramIndex++;
    }

    if (risk_min !== undefined) {
        conditions.push(`risk_score >= $${paramIndex}`);
        params.push(risk_min);
        paramIndex++;
    }

    if (risk_max !== undefined) {
        conditions.push(`risk_score <= $${paramIndex}`);
        params.push(risk_max);
        paramIndex++;
    }

    if (search) {
        conditions.push(
            `to_tsvector('english', coalesce(name, '') || ' ' || coalesce(counterparty, ''))
       @@ plainto_tsquery('english', $${paramIndex})`,
        );
        params.push(search);
        paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Whitelist sort columns to prevent SQL injection
    const allowedSorts = ['created_at', 'risk_score', 'expiration_date'];
    const sortColumn = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    // Count total matching rows
    const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM contracts WHERE ${whereClause}`,
        params,
    );
    const total = parseInt(countResult.rows[0]!.count, 10);

    // Fetch paginated results
    const offset = (page - 1) * limit;
    const dataResult = await query<ContractListItem>(
        `SELECT id, name, type, counterparty, status, risk_score, expiration_date, auto_renewal, created_at
     FROM contracts
     WHERE ${whereClause}
     ORDER BY ${sortColumn} ${sortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset],
    );

    return {
        data: dataResult.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

/**
 * Update contract after analysis completes
 */
export async function updateContractAnalysis(
    contractId: string,
    data: {
        raw_text?: string;
        effective_date?: string | null;
        expiration_date?: string | null;
        auto_renewal?: boolean;
        risk_score?: number;
        summary?: string;
        status?: ContractStatus;
        last_analyzed_at?: string;
    },
): Promise<Contract> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
            fields.push(`${key} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
        }
    }

    params.push(contractId);

    const result = await query<Contract>(
        `UPDATE contracts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params,
    );
    return result.rows[0]!;
}

/**
 * Update contract status only
 */
export async function updateContractStatus(
    contractId: string,
    status: ContractStatus,
): Promise<void> {
    await query(
        `UPDATE contracts SET status = $1 WHERE id = $2`,
        [status, contractId],
    );
}

/**
 * Archive a contract (soft delete)
 */
export async function archiveContract(
    contractId: string,
    orgId: string,
): Promise<void> {
    await query(
        `UPDATE contracts SET status = 'archived' WHERE id = $1 AND org_id = $2`,
        [contractId, orgId],
    );
}

/**
 * Unarchive a contract (restore to active)
 */
export async function unarchiveContract(
    contractId: string,
    orgId: string,
): Promise<void> {
    await query(
        `UPDATE contracts SET status = 'active' WHERE id = $1 AND org_id = $2 AND status = 'archived'`,
        [contractId, orgId],
    );
}

/**
 * Hard-delete a contract and all related data (CASCADE via DB constraints)
 */
export async function deleteContract(
    contractId: string,
    orgId: string,
): Promise<{ file_path: string } | null> {
    const result = await query<{ file_path: string }>(
        `DELETE FROM contracts WHERE id = $1 AND org_id = $2 RETURNING file_path`,
        [contractId, orgId],
    );
    return result.rows[0] ?? null;
}

/**
 * Count contracts by org (for tier limit checks)
 */
export async function countOrgContracts(orgId: string): Promise<number> {
    const result = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM contracts WHERE org_id = $1 AND status != 'archived'`,
        [orgId],
    );
    return parseInt(result.rows[0]!.count, 10);
}

/**
 * Get contracts expiring within N days (for alert worker)
 */
export async function getExpiringContracts(withinDays: number): Promise<Contract[]> {
    const result = await query<Contract>(
        `SELECT * FROM contracts
     WHERE status = 'active'
       AND expiration_date IS NOT NULL
       AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::interval`,
        [`${withinDays} days`],
    );
    return result.rows;
}

/**
 * Get dashboard statistics for an org
 */
export async function getDashboardStats(orgId: string) {
    const result = await query<{
        total_contracts: string;
        active_contracts: string;
        avg_risk_score: string | null;
        expiring_soon: string;
        critical_risk_count: string;
    }>(
        `SELECT
       COUNT(*) FILTER (WHERE status != 'archived') AS total_contracts,
       COUNT(*) FILTER (WHERE status = 'active') AS active_contracts,
       ROUND(AVG(risk_score) FILTER (WHERE status = 'active'))::TEXT AS avg_risk_score,
       COUNT(*) FILTER (
         WHERE status = 'active'
         AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
       ) AS expiring_soon,
       COUNT(*) FILTER (
         WHERE status = 'active' AND risk_score >= 75
       ) AS critical_risk_count
     FROM contracts
     WHERE org_id = $1`,
        [orgId],
    );

    const row = result.rows[0]!;
    return {
        totalContracts: parseInt(row.total_contracts, 10),
        activeContracts: parseInt(row.active_contracts, 10),
        avgRiskScore: row.avg_risk_score ? parseInt(row.avg_risk_score, 10) : 0,
        expiringSoon: parseInt(row.expiring_soon, 10),
        criticalRiskCount: parseInt(row.critical_risk_count, 10),
    };
}

/**
 * Get count of contracts grouped by type (for dashboard chart)
 */
export async function getContractsByType(
    orgId: string,
): Promise<Record<string, number>> {
    const result = await query<{ type: string; count: string }>(
        `SELECT type, COUNT(*) as count
     FROM contracts
     WHERE org_id = $1 AND status != 'archived'
     GROUP BY type`,
        [orgId],
    );

    const map: Record<string, number> = {};
    for (const row of result.rows) {
        map[row.type] = parseInt(row.count, 10);
    }
    return map;
}

/**
 * Get risk distribution (for dashboard chart)
 */
export async function getRiskDistribution(
    orgId: string,
): Promise<{ low: number; medium: number; high: number; critical: number }> {
    const result = await query<{
        low: string;
        medium: string;
        high: string;
        critical: string;
    }>(
        `SELECT
       COUNT(*) FILTER (WHERE risk_score < 25) AS low,
       COUNT(*) FILTER (WHERE risk_score >= 25 AND risk_score < 50) AS medium,
       COUNT(*) FILTER (WHERE risk_score >= 50 AND risk_score < 75) AS high,
       COUNT(*) FILTER (WHERE risk_score >= 75) AS critical
     FROM contracts
     WHERE org_id = $1 AND status = 'active' AND risk_score IS NOT NULL`,
        [orgId],
    );

    const row = result.rows[0]!;
    return {
        low: parseInt(row.low, 10),
        medium: parseInt(row.medium, 10),
        high: parseInt(row.high, 10),
        critical: parseInt(row.critical, 10),
    };
}
