/**
 * AI Prompt Templates for ContractGuard
 *
 * All prompts are centralized here to make iteration easy.
 * Each prompt is a function returning a string so parameters are typed.
 */

// ─── Clause Extraction ───────────────────────────────────────

export const CLAUSE_TYPES = [
    'liability',
    'indemnification',
    'data_processing',
    'auto_renewal',
    'termination',
    'payment',
    'confidentiality',
    'ip_ownership',
    'warranty',
    'force_majeure',
    'governing_law',
    'dispute_resolution',
    'non_compete',
    'non_solicitation',
    'other',
] as const;

export type ClauseTypeValue = (typeof CLAUSE_TYPES)[number];

export const RISK_LEVELS = ['critical', 'high', 'medium', 'low'] as const;
export type RiskLevelValue = (typeof RISK_LEVELS)[number];

export interface ExtractedClause {
    clause_type: ClauseTypeValue;
    text: string;
    page_number?: number;
    risk_level: RiskLevelValue;
    risk_explanation: string;
}

export function buildClauseExtractionPrompt(contractText: string): string {
    return `You are a legal contract analysis AI. Your task is to extract and classify key clauses from the following contract text.

INSTRUCTIONS:
1. Identify all significant clauses in the contract.
2. For each clause, determine its type from this exact list: ${CLAUSE_TYPES.join(', ')}.
3. Assess risk level: "critical" (severe business impact), "high" (significant concern), "medium" (moderate concern), "low" (standard/acceptable).
4. Provide a concise risk explanation (1-2 sentences max).
5. Extract the exact verbatim text of the clause (max 500 words per clause).
6. Return ONLY valid JSON — no preamble, no markdown fences, no explanation.

OUTPUT FORMAT (JSON array):
[
  {
    "clause_type": "<type from list>",
    "text": "<exact clause text>",
    "risk_level": "<critical|high|medium|low>",
    "risk_explanation": "<why this is risky or acceptable>"
  }
]

CONTRACT TEXT:
---
${contractText}
---

Return ONLY the JSON array. No markdown. No explanation.`;
}

// ─── Risk Assessment ─────────────────────────────────────────

export interface RiskAssessmentInput {
    clauses: ExtractedClause[];
    contractType: string;
    counterparty?: string;
}

export function buildRiskAssessmentPrompt(input: RiskAssessmentInput): string {
    const clauseSummary = input.clauses
        .map((c) => `- [${c.risk_level.toUpperCase()}] ${c.clause_type}: ${c.risk_explanation}`)
        .join('\n');

    return `You are a legal risk assessment AI. Given the following clause analysis for a ${input.contractType} contract${input.counterparty ? ` with ${input.counterparty}` : ''}, provide an overall risk assessment.

IDENTIFIED CLAUSES:
${clauseSummary}

TASK: Calculate an overall risk score from 0-100 and provide a brief justification.
- 0-24: Low risk (standard, well-balanced contract)
- 25-49: Medium risk (some concerning clauses, manageable)
- 50-74: High risk (significant issues requiring attention)
- 75-100: Critical risk (severe red flags, legal review required)

OUTPUT FORMAT (JSON):
{
  "risk_score": <integer 0-100>,
  "risk_summary": "<2-3 sentence overall risk assessment>",
  "top_concerns": ["<concern 1>", "<concern 2>", "<concern 3>"]
}

Return ONLY the JSON object. No markdown. No explanation.`;
}

// ─── Executive Summary ───────────────────────────────────────

export interface SummaryInput {
    contractText: string;
    contractType: string;
    counterparty?: string;
    effectiveDate?: string;
    expirationDate?: string;
    clauses: ExtractedClause[];
}

export function buildSummaryPrompt(input: SummaryInput): string {
    const keyFacts = [
        input.contractType && `Contract Type: ${input.contractType}`,
        input.counterparty && `Counterparty: ${input.counterparty}`,
        input.effectiveDate && `Effective Date: ${input.effectiveDate}`,
        input.expirationDate && `Expiration Date: ${input.expirationDate}`,
    ]
        .filter(Boolean)
        .join('\n');

    const criticalClauses = input.clauses
        .filter((c) => c.risk_level === 'critical' || c.risk_level === 'high')
        .slice(0, 5)
        .map((c) => `- ${c.clause_type}: ${c.risk_explanation}`)
        .join('\n');

    return `You are a contract summarization AI for business owners who are NOT lawyers.
Write a clear, plain-English executive summary of this contract.

KEY CONTRACT FACTS:
${keyFacts}

HIGH-RISK CLAUSES:
${criticalClauses || 'None identified'}

CONTRACT TEXT (excerpt):
---
${input.contractText.slice(0, 3000)}
---

REQUIREMENTS:
- Write 3-5 sentences maximum
- Use plain English — no legal jargon
- Focus on: what the contract does, key obligations, main risks
- Start with "This [contract type] agreement..."
- Do NOT use bullet points — write flowing prose

Return ONLY the summary text. No labels, no markdown, no explanation.`;
}

// ─── Date Extraction ─────────────────────────────────────────

export function buildDateExtractionPrompt(contractText: string): string {
    return `Extract key dates from this contract text.

CONTRACT TEXT:
---
${contractText.slice(0, 4000)}
---

OUTPUT FORMAT (JSON):
{
  "effective_date": "<YYYY-MM-DD or null>",
  "expiration_date": "<YYYY-MM-DD or null>",
  "auto_renewal": <true|false>,
  "notice_period_days": <integer or null>
}

Rules:
- Use ISO 8601 date format (YYYY-MM-DD)
- If a date is ambiguous or not present, use null
- auto_renewal is true only if the contract explicitly mentions automatic renewal
- notice_period_days is the number of days notice required to cancel (if stated)

Return ONLY the JSON object. No markdown. No explanation.`;
}

export interface ExtractedDates {
    effective_date: string | null;
    expiration_date: string | null;
    auto_renewal: boolean;
    notice_period_days: number | null;
}

// ─── Contract Type Detection ──────────────────────────────────

export function buildContractTypePrompt(contractText: string): string {
    return `Identify the type of this legal contract.

CONTRACT TEXT (first 2000 chars):
---
${contractText.slice(0, 2000)}
---

Choose exactly one from: NDA, MSA, SaaS, Vendor, Employment, Other

OUTPUT FORMAT (JSON):
{
  "type": "<NDA|MSA|SaaS|Vendor|Employment|Other>",
  "confidence": <0.0-1.0>,
  "counterparty": "<company or person name if identifiable, or null>"
}

Return ONLY the JSON object. No markdown. No explanation.`;
}
