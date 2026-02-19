import { createLogger } from '../lib/logger.js';
import { buildSummaryPrompt, type ExtractedClause, type SummaryInput } from './prompts.js';

const log = createLogger('ai.summarizer');

// ─── Configuration ────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_FALLBACK_MODEL = 'llama-3.1-8b-instant';

// ─── Types ───────────────────────────────────────────────────

export interface SummaryOptions {
    contractText: string;
    contractType: string;
    counterparty?: string;
    effectiveDate?: string;
    expirationDate?: string;
    clauses: ExtractedClause[];
}

// ─── Main Entry Point ─────────────────────────────────────────

/**
 * Generate a plain-English executive summary of a contract.
 *
 * Uses LLaMA 3.1 via Groq for speed, falls back to a lighter Groq model.
 * Output is 3-5 sentences targeted at non-legal SMB owners.
 *
 * @param options - Contract metadata and extracted clauses
 * @returns Plain text summary (no markdown)
 */
export async function generateSummary(options: SummaryOptions): Promise<string> {
    log.info(
        { contractType: options.contractType, clauseCount: options.clauses.length },
        'Generating executive summary',
    );

    const prompt = buildSummaryPrompt({
        contractText: options.contractText,
        contractType: options.contractType,
        counterparty: options.counterparty,
        effectiveDate: options.effectiveDate,
        expirationDate: options.expirationDate,
        clauses: options.clauses,
    });

    try {
        const summary = await callSummaryLlm(prompt, GROQ_MODEL);
        log.info({ length: summary.length, model: GROQ_MODEL }, 'Summary generated via Groq');
        return summary;
    } catch (err) {
        if (GROQ_MODEL !== GROQ_FALLBACK_MODEL) {
            log.warn({ err }, `Groq model ${GROQ_MODEL} failed — falling back to ${GROQ_FALLBACK_MODEL}`);

            try {
                const summary = await callSummaryLlm(prompt, GROQ_FALLBACK_MODEL);
                log.info({ length: summary.length, model: GROQ_FALLBACK_MODEL }, 'Summary generated via Groq fallback');
                return summary;
            } catch (fallbackErr) {
                log.error({ err: fallbackErr }, 'All Groq models failed for summary');
                return buildFallbackSummary(options);
            }
        }

        log.error({ err }, 'Groq summary failed');
        return buildFallbackSummary(options);
    }
}

// ─── Internal Helpers ────────────────────────────────────────

async function callSummaryLlm(prompt: string, model: string): Promise<string> {
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
                    content: 'You are a contract summarization assistant. Write clear, concise summaries for business owners. No legal jargon. No markdown.',
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 512,
        }),
        signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Groq API error (${model}) ${response.status}: ${body}`);
    }

    const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content?.trim();
    if (!content) throw new Error(`Groq model ${model} returned empty summary`);

    return content;
}

/**
 * Fallback summary when all LLM providers fail.
 * Built from structured data instead of LLM output.
 */
function buildFallbackSummary(options: SummaryOptions): string {
    const criticalCount = options.clauses.filter((c) => c.risk_level === 'critical').length;
    const highCount = options.clauses.filter((c) => c.risk_level === 'high').length;

    const parts = [
        `This ${options.contractType} agreement${options.counterparty ? ` with ${options.counterparty}` : ''} has been analyzed.`,
        options.expirationDate
            ? `The contract expires on ${options.expirationDate}.`
            : null,
        options.clauses.length > 0
            ? `${options.clauses.length} clauses were identified, including ${criticalCount} critical and ${highCount} high-risk clauses requiring attention.`
            : null,
        'Please review the full analysis and consult legal counsel for important decisions.',
    ]
        .filter(Boolean)
        .join(' ');

    return parts;
}
