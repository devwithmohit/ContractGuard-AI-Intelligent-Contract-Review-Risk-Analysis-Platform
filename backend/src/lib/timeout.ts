/**
 * timeout.ts
 *
 * Reliable timeout utilities for Bun + Node environments.
 *
 * WHY THIS EXISTS:
 * AbortSignal.timeout() is part of the WHATWG spec but has inconsistent
 * behavior in Bun (especially < 1.1.x) — it may silently no-op, causing
 * fetch() calls to hang indefinitely when Groq/Jina APIs are slow or down.
 *
 * This module provides:
 *  - makeAbortSignal(ms)    → AbortSignal that reliably fires after ms
 *  - withTimeout(p, ms)     → Promise.race wrapper (no fetch involvement)
 *  - fetchWithTimeout(...)  → drop-in fetch replacement with working timeout
 */

// ─── Reliable AbortSignal ─────────────────────────────────────

/**
 * Returns an AbortSignal that fires after `ms` milliseconds.
 * Uses setTimeout internally — works reliably in Bun and Node.
 *
 * IMPORTANT: Call clear() after fetch resolves to avoid a dangling timer.
 * Or use fetchWithTimeout() which handles this automatically.
 */
export function makeAbortSignal(ms: number): {
    signal: AbortSignal;
    clear: () => void;
} {
    const controller = new AbortController();
    const handle = setTimeout(() => {
        controller.abort(new Error(`Request timed out after ${ms}ms`));
    }, ms);

    return {
        signal: controller.signal,
        clear: () => clearTimeout(handle),
    };
}

// ─── fetch with timeout ───────────────────────────────────────

/**
 * Drop-in replacement for fetch() with a reliable timeout.
 *
 * @example
 * ```ts
 * const response = await fetchWithTimeout(
 *   'https://api.groq.com/...',
 *   { method: 'POST', headers: {...}, body: '...' },
 *   20_000, // 20s timeout
 * );
 * ```
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
): Promise<Response> {
    const { signal, clear } = makeAbortSignal(timeoutMs);

    // Merge with any existing signal from the caller
    const mergedSignal = options.signal
        ? anySignal([signal, options.signal as AbortSignal])
        : signal;

    try {
        const response = await fetch(url, {
            ...options,
            signal: mergedSignal,
        });
        return response;
    } finally {
        clear(); // Always clear timer — prevents dangling timer after response
    }
}

// ─── Promise timeout wrapper ──────────────────────────────────

/**
 * Wraps any promise with a hard timeout.
 * If the promise doesn't resolve within `ms`, rejects with a timeout error.
 *
 * @example
 * ```ts
 * const result = await withTimeout(
 *   someSlowOperation(),
 *   30_000,
 *   'Clause extraction',
 * );
 * ```
 */
export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label = 'Operation',
): Promise<T> {
    let handle: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
        handle = setTimeout(() => {
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
    });

    return Promise.race([
        promise.finally(() => clearTimeout(handle!)),
        timeoutPromise,
    ]);
}

// ─── Retry with exponential backoff ──────────────────────────

export interface RetryOptions {
    attempts: number;
    baseDelayMs: number;
    timeoutMs: number;
    label: string;
    isRetryable?: (err: unknown) => boolean;
}

/**
 * Retry an async operation with exponential backoff.
 * Each attempt gets its own timeout.
 *
 * @example
 * ```ts
 * const result = await retryWithBackoff(
 *   () => callGroqApi(prompt),
 *   { attempts: 3, baseDelayMs: 1000, timeoutMs: 20_000, label: 'Groq clause extraction' }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions,
): Promise<T> {
    const { attempts, baseDelayMs, timeoutMs, label, isRetryable = defaultIsRetryable } = options;

    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await withTimeout(fn(), timeoutMs, `${label} (attempt ${attempt})`);
        } catch (err) {
            lastError = err;

            const isLast = attempt === attempts;
            const shouldRetry = isRetryable(err);

            if (isLast || !shouldRetry) {
                throw err;
            }

            const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s...
            await sleep(delay);
        }
    }

    throw lastError;
}

// ─── Helpers ─────────────────────────────────────────────────

function defaultIsRetryable(err: unknown): boolean {
    if (!(err instanceof Error)) return false;

    const msg = err.message.toLowerCase();
    return (
        msg.includes('timeout') ||
        msg.includes('network') ||
        msg.includes('fetch') ||
        msg.includes('econnreset') ||
        msg.includes('econnrefused') ||
        msg.includes('503') ||
        msg.includes('502') ||
        msg.includes('429')
    );
}

/**
 * Combine multiple AbortSignals — aborts when ANY of them fires.
 * Polyfill for AbortSignal.any() which isn't in all Bun versions.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
    // Use native AbortSignal.any if available (Node 20+, Bun 1.1+)
    if (typeof (AbortSignal as unknown as Record<string, unknown>)['any'] === 'function') {
        return (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any(signals);
    }

    const controller = new AbortController();

    for (const signal of signals) {
        if (signal.aborted) {
            controller.abort(signal.reason);
            break;
        }
        signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }

    return controller.signal;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
