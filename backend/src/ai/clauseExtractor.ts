import { z } from 'zod';
import { createLogger } from '../lib/logger.js';
import {
    buildClauseExtractionPrompt,
    buildDateExtractionPrompt,
    buildContractTypePrompt,
    CLAUSE_TYPES,
    RISK_LEVELS,
    type ExtractedClause,
    type ExtractedDates,
} from './prompts.js';

const log = createLogger('ai.clauseExtractor');

// ─── Configuration ────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_FALLBACK_MODEL = 'llama-3.1-8b-instant';

// Max context for clause extraction (keep room for response)
const MAX_EXTRACT_CHARS = 12_000;
const CHUNK_OVERLAP_CHARS = 500;

// ─── Zod Schemas ─────────────────────────────────────────────

const ClauseSchema = z.object({
    clause_type: z.enum(CLAUSE_TYPES),
    text: z.string().min(1).max(5000),
    risk_level: z.enum(RISK_LEVELS),
    risk_explanation: z.string().min(1).max(500),
    page_number: z.number().int().optional(),
});

const ClauseArraySchema = z.array(ClauseSchema);

const DateSchema = z.object({
    effective_date: z.string().nullable(),
    expiration_date: z.string().nullable(),
    auto_renewal: z.boolean(),
    notice_period_days: z.number().nullable(),
});

const ContractTypeSchema = z.object({
    type: z.enum(['NDA', 'MSA', 'SaaS', 'Vendor', 'Employment', 'Other']),
    confidence: z.number().min(0).max(1),
    counterparty: z.string().nullable(),
});

// ─── Main Entry Point ─────────────────────────────────────────

/**
 * Extract all clauses from a contract using LLaMA 3.1 via Groq.
 * Falls back to a lighter Groq model on failure.
 *
 * For large contracts, splits into overlapping windows and deduplicates results.
 */
export async function extractClauses(contractText: string): Promise<ExtractedClause[]> {
    log.info({ textLength: contractText.length }, 'Starting clause extraction');

    // Split into processable windows for large contracts
    const windows = splitIntoWindows(contractText, MAX_EXTRACT_CHARS, CHUNK_OVERLAP_CHARS);
    log.debug({ windowCount: windows.length }, 'Processing contract windows');

    // Process all windows in parallel for speed
    // (each hits Groq API independently — no contention)
    const windowPromises = windows.map((window, i) => {
        const prompt = buildClauseExtractionPrompt(window);
        return callLlm(prompt, 'groq')
            .then((raw) => {
                const parsed = parseJsonResponse(raw, ClauseArraySchema);
                log.debug({ window: i + 1, clausesFound: parsed.length }, 'Window processed');
                return parsed;
            })
            .catch((err) => {
                log.error({ err, window: i + 1 }, 'Clause extraction failed for window');
                return [] as ExtractedClause[]; // Continue with other windows
            });
    });

    const windowResults = await Promise.all(windowPromises);
    const allClauses: ExtractedClause[] = windowResults.flat();

    // Deduplicate clauses by type (keep the one with highest risk level)
    const deduped = deduplicateClauses(allClauses);

    log.info(
        { totalClauses: allClauses.length, dedupedClauses: deduped.length },
        'Clause extraction complete',
    );

    return deduped;
}

/**
 * Extract key dates from a contract.
 */
export async function extractDates(contractText: string): Promise<ExtractedDates> {
    const prompt = buildDateExtractionPrompt(contractText);

    try {
        const raw = await callLlm(prompt, 'groq');
        return parseJsonResponse(raw, DateSchema);
    } catch (err) {
        log.warn({ err }, 'Date extraction failed — returning nulls');
        return {
            effective_date: null,
            expiration_date: null,
            auto_renewal: false,
            notice_period_days: null,
        };
    }
}

/**
 * Detect contract type and counterparty.
 */
export async function detectContractType(contractText: string): Promise<{
    type: string;
    counterparty: string | null;
}> {
    const prompt = buildContractTypePrompt(contractText);

    try {
        const raw = await callLlm(prompt, 'groq');
        const parsed = parseJsonResponse(raw, ContractTypeSchema);
        return { type: parsed.type, counterparty: parsed.counterparty };
    } catch (err) {
        log.warn({ err }, 'Contract type detection failed — defaulting to Other');
        return { type: 'Other', counterparty: null };
    }
}

// ─── LLM Caller ──────────────────────────────────────────────

async function callLlm(
    prompt: string,
    model: string = GROQ_MODEL,
): Promise<string> {
    try {
        return await callGroqModel(prompt, model);
    } catch (err) {
        if (model !== GROQ_FALLBACK_MODEL) {
            log.warn({ err, model }, `Groq model ${model} failed — falling back to ${GROQ_FALLBACK_MODEL}`);
            return callGroqModel(prompt, GROQ_FALLBACK_MODEL);
        }
        throw err;
    }
}

async function callGroqModel(prompt: string, model: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        throw new Error('GROQ_API_KEY is not set');
    }

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a legal contract analysis AI. Always respond with valid JSON only. No markdown, no explanation.',
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.1,      // Low temp for consistency
            max_tokens: 4096,
            response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(20_000), // 20s timeout (llama responds in 1-5s)
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Groq API error (${model}) ${response.status}: ${body}`);
    }

    const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error(`Groq model ${model} returned empty response`);

    return content;
}

// ─── Helpers ─────────────────────────────────────────────────

function parseJsonResponse<T>(raw: string, schema: z.ZodSchema<T>): T {
    // Strip markdown fences if present (some models ignore the instruction)
    const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    let parsed: unknown;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        // Try to extract JSON from response
        const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
        if (!jsonMatch) throw new Error(`No valid JSON found in LLM response: ${cleaned.slice(0, 200)}`);
        parsed = JSON.parse(jsonMatch[0]);
    }

    // Handle both array and wrapped object responses
    // e.g. { "clauses": [...] } → extract the array
    if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed !== null) {
        const values = Object.values(parsed);
        if (values.length === 1 && Array.isArray(values[0])) {
            parsed = values[0];
        }
    }

    return schema.parse(parsed);
}

function splitIntoWindows(text: string, maxChars: number, overlap: number): string[] {
    if (text.length <= maxChars) return [text];

    const windows: string[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + maxChars, text.length);
        windows.push(text.slice(start, end));

        if (end === text.length) break;
        start = end - overlap;
    }

    return windows;
}

const RISK_ORDER: Record<string, number> = {
    critical: 4, high: 3, medium: 2, low: 1,
};

function deduplicateClauses(clauses: ExtractedClause[]): ExtractedClause[] {
    const byType = new Map<string, ExtractedClause[]>();

    for (const clause of clauses) {
        const existing = byType.get(clause.clause_type) ?? [];
        existing.push(clause);
        byType.set(clause.clause_type, existing);
    }

    // For each type, sort by risk level desc and take the top (but keep multiple
    // clauses of the same type if risk levels differ — e.g., 2 liability clauses
    // one critical and one low are both meaningful)
    const result: ExtractedClause[] = [];
    for (const [, typeClauses] of byType) {
        const sorted = typeClauses.sort(
            (a, b) => (RISK_ORDER[b.risk_level] ?? 0) - (RISK_ORDER[a.risk_level] ?? 0),
        );
        // Deduplicate by near-identical text (same first 100 chars)
        const seen = new Set<string>();
        for (const clause of sorted) {
            const key = clause.text.slice(0, 100).trim();
            if (!seen.has(key)) {
                seen.add(key);
                result.push(clause);
            }
        }
    }

    return result;
}
