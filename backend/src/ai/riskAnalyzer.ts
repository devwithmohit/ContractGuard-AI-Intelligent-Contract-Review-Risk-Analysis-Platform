import { createLogger } from '../lib/logger.js';
import type { ExtractedClause } from './prompts.js';

const log = createLogger('ai.riskAnalyzer');

// ─── Weight Table ─────────────────────────────────────────────
// Higher weight = clause has more business impact.
// Weights sum to ~100 for a contract with all clause types.
// From the system design specification.

const CLAUSE_WEIGHTS: Record<string, number> = {
    liability: 25,
    indemnification: 20,
    data_processing: 15,
    auto_renewal: 10,
    termination: 10,
    payment: 8,
    ip_ownership: 5,
    confidentiality: 3,
    non_compete: 2,
    non_solicitation: 2,
    warranty: 2,
    dispute_resolution: 2,
    governing_law: 1,
    force_majeure: 1,
    other: 1,
};

// Risk level → numeric score (0-100 per clause)
const RISK_LEVEL_SCORES: Record<string, number> = {
    critical: 100,
    high: 75,
    medium: 40,
    low: 10,
};

// Default weight for unknown clause types
const DEFAULT_WEIGHT = 1;

// ─── Types ───────────────────────────────────────────────────

export interface RiskBreakdown {
    clauseType: string;
    weight: number;
    riskLevel: string;
    riskScore: number;       // Raw 0-100 score for this clause
    weightedScore: number;   // weight * riskScore / 100
    explanation: string;
}

export interface RiskAnalysisResult {
    overallScore: number;           // 0-100 normalized score
    riskLabel: 'low' | 'medium' | 'high' | 'critical';
    breakdown: RiskBreakdown[];
    missingHighWeightClauses: string[];  // High-weight clauses not found (also a risk signal)
}

// ─── Main Entry Point ─────────────────────────────────────────

/**
 * Compute an overall risk score from extracted clauses.
 *
 * Algorithm:
 * 1. For each clause, look up its weight and convert risk level to score (0-100)
 * 2. Compute weighted average: Σ(weight_i * score_i) / Σ(weight_i)
 * 3. Apply a "missing clause" penalty for high-weight clauses that weren't found
 *    (e.g., missing a liability clause in an MSA is itself a risk)
 * 4. Normalize and clamp to [0, 100]
 *
 * @param clauses - Extracted clauses from clauseExtractor
 */
export function computeRiskScore(clauses: ExtractedClause[]): RiskAnalysisResult {
    if (clauses.length === 0) {
        log.warn('No clauses provided — returning 0 risk score');
        return {
            overallScore: 0,
            riskLabel: 'low',
            breakdown: [],
            missingHighWeightClauses: [],
        };
    }

    const breakdown: RiskBreakdown[] = [];
    let totalWeight = 0;
    let weightedScoreSum = 0;

    // Build breakdown for each extracted clause
    const foundClauseTypes = new Set<string>();

    for (const clause of clauses) {
        const weight = CLAUSE_WEIGHTS[clause.clause_type] ?? DEFAULT_WEIGHT;
        const riskScore = RISK_LEVEL_SCORES[clause.risk_level] ?? 10;
        const weightedScore = (weight * riskScore) / 100;

        breakdown.push({
            clauseType: clause.clause_type,
            weight,
            riskLevel: clause.risk_level,
            riskScore,
            weightedScore,
            explanation: clause.risk_explanation,
        });

        // For duplicate clause types, take the MAX risk score
        const existing = foundClauseTypes.has(clause.clause_type);
        if (!existing) {
            totalWeight += weight;
            weightedScoreSum += weightedScore;
            foundClauseTypes.add(clause.clause_type);
        } else {
            // Update if higher risk found (already counted weight once)
            const prev = breakdown.find((b) => b.clauseType === clause.clause_type);
            if (prev && riskScore > prev.riskScore) {
                weightedScoreSum -= prev.weightedScore;
                weightedScoreSum += weightedScore;
                prev.riskScore = riskScore;
                prev.riskLevel = clause.risk_level;
                prev.weightedScore = weightedScore;
            }
        }
    }

    // ── Missing clause penalty ────────────────────────────────
    // High-weight clauses not in the contract also signal risk
    // (e.g., no liability clause = unlimited liability exposure)
    const HIGH_WEIGHT_THRESHOLD = 10;
    const missingHighWeightClauses: string[] = [];

    for (const [clauseType, weight] of Object.entries(CLAUSE_WEIGHTS)) {
        if (weight >= HIGH_WEIGHT_THRESHOLD && !foundClauseTypes.has(clauseType)) {
            missingHighWeightClauses.push(clauseType);

            // Add a modest penalty for missing high-weight clauses
            // (treat as medium risk / 40 score)
            const penaltyWeight = weight * 0.5; // Half-weight penalty
            totalWeight += penaltyWeight;
            weightedScoreSum += (penaltyWeight * 40) / 100;
        }
    }

    // ── Final score computation ───────────────────────────────
    const rawScore = totalWeight > 0 ? (weightedScoreSum / totalWeight) * 100 : 0;
    const overallScore = Math.round(Math.min(100, Math.max(0, rawScore)));
    const riskLabel = scoreToLabel(overallScore);

    log.info(
        {
            overallScore,
            riskLabel,
            clauseCount: clauses.length,
            missingClauses: missingHighWeightClauses,
        },
        'Risk analysis complete',
    );

    // Sort breakdown by weighted score descending
    breakdown.sort((a, b) => b.weightedScore - a.weightedScore);

    return {
        overallScore,
        riskLabel,
        breakdown,
        missingHighWeightClauses,
    };
}

// ─── Helpers ─────────────────────────────────────────────────

function scoreToLabel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
}

/**
 * Get the risk label color for UI badges.
 * Centralized here so backend and frontend stay in sync.
 */
export function getRiskColor(riskLabel: string): string {
    const colors: Record<string, string> = {
        critical: '#ef4444',  // red-500
        high: '#f97316',      // orange-500
        medium: '#eab308',    // yellow-500
        low: '#22c55e',       // green-500
    };
    return colors[riskLabel] ?? colors.low!;
}
