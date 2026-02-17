import { query } from '../client.js';

// ─── Types ───────────────────────────────────────────────────

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

export interface ClauseInsert {
    contract_id: string;
    clause_type: ClauseType;
    text: string;
    page_number?: number;
    risk_level: RiskLevel;
    risk_explanation?: string;
}

export interface ClauseRiskCount {
    clause_type: ClauseType;
    risk_level: RiskLevel;
    count: number;
}

// ─── Queries ─────────────────────────────────────────────────

/**
 * Insert a single clause
 */
export async function insertClause(data: ClauseInsert): Promise<Clause> {
    const result = await query<Clause>(
        `INSERT INTO contract_clauses (contract_id, clause_type, text, page_number, risk_level, risk_explanation)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
        [
            data.contract_id,
            data.clause_type,
            data.text,
            data.page_number ?? null,
            data.risk_level,
            data.risk_explanation ?? null,
        ],
    );
    return result.rows[0]!;
}

/**
 * Batch insert multiple clauses (single query for performance)
 */
export async function insertClausesBatch(clauses: ClauseInsert[]): Promise<Clause[]> {
    if (clauses.length === 0) return [];

    const values: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const clause of clauses) {
        values.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`,
        );
        params.push(
            clause.contract_id,
            clause.clause_type,
            clause.text,
            clause.page_number ?? null,
            clause.risk_level,
            clause.risk_explanation ?? null,
        );
        paramIndex += 6;
    }

    const result = await query<Clause>(
        `INSERT INTO contract_clauses (contract_id, clause_type, text, page_number, risk_level, risk_explanation)
     VALUES ${values.join(', ')}
     RETURNING *`,
        params,
    );
    return result.rows;
}

/**
 * Get all clauses for a contract
 */
export async function getClausesByContractId(contractId: string): Promise<Clause[]> {
    const result = await query<Clause>(
        `SELECT * FROM contract_clauses
     WHERE contract_id = $1
     ORDER BY
       CASE risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       page_number ASC NULLS LAST`,
        [contractId],
    );
    return result.rows;
}

/**
 * Get clauses grouped by risk level for a contract
 */
export async function getClausesByRisk(
    contractId: string,
): Promise<Record<RiskLevel, Clause[]>> {
    const clauses = await getClausesByContractId(contractId);

    const grouped: Record<RiskLevel, Clause[]> = {
        critical: [],
        high: [],
        medium: [],
        low: [],
    };

    for (const clause of clauses) {
        grouped[clause.risk_level].push(clause);
    }

    return grouped;
}

/**
 * Get risk score breakdown per clause type
 * Used for the risk breakdown API endpoint
 */
export async function getClauseRiskBreakdown(contractId: string) {
    const result = await query<{
        clause_type: ClauseType;
        count: string;
        max_risk: RiskLevel;
        avg_score: string;
    }>(
        `SELECT
       clause_type,
       COUNT(*) as count,
       MAX(CASE risk_level
         WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1
       END)::TEXT as max_risk_num,
       CASE MAX(CASE risk_level
         WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1
       END)
         WHEN 4 THEN 'critical' WHEN 3 THEN 'high' WHEN 2 THEN 'medium' ELSE 'low'
       END as max_risk,
       ROUND(AVG(CASE risk_level
         WHEN 'critical' THEN 90 WHEN 'high' THEN 70 WHEN 'medium' THEN 45 ELSE 20
       END))::TEXT as avg_score
     FROM contract_clauses
     WHERE contract_id = $1
     GROUP BY clause_type
     ORDER BY avg_score DESC`,
        [contractId],
    );

    return result.rows.map((row) => ({
        clauseType: row.clause_type,
        count: parseInt(row.count, 10),
        maxRisk: row.max_risk,
        avgScore: parseInt(row.avg_score, 10),
    }));
}

/**
 * Delete all clauses for a contract (used before re-analysis)
 */
export async function deleteClausesByContractId(contractId: string): Promise<number> {
    const result = await query(
        `DELETE FROM contract_clauses WHERE contract_id = $1`,
        [contractId],
    );
    return result.rowCount ?? 0;
}

/**
 * Count clauses by risk level across an entire org (for dashboard)
 */
export async function countClausesByRiskForOrg(
    orgId: string,
): Promise<Record<RiskLevel, number>> {
    const result = await query<{ risk_level: RiskLevel; count: string }>(
        `SELECT cc.risk_level, COUNT(*) as count
     FROM contract_clauses cc
     JOIN contracts c ON cc.contract_id = c.id
     WHERE c.org_id = $1 AND c.status = 'active'
     GROUP BY cc.risk_level`,
        [orgId],
    );

    const counts: Record<RiskLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const row of result.rows) {
        counts[row.risk_level] = parseInt(row.count, 10);
    }
    return counts;
}
