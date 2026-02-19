/**
 * api.ts
 *
 * Typed API client built on `ky` (fetch wrapper).
 *
 * Features:
 *  - Auto-attaches Supabase JWT as Authorization: Bearer <token>
 *  - Base URL from VITE_API_BASE_URL env (defaults to '' for Vite proxy)
 *  - Consistent error parsing — throws ApiError with status + body
 *  - Request timeout (30s)
 *  - Automatic retry on 429 / 5xx (2 retries, exponential backoff)
 */
import ky, { type KyInstance, HTTPError } from 'ky';
import { getAccessToken } from './supabase.js';

// ─── ApiError ─────────────────────────────────────────────────

export interface ApiErrorBody {
    error: {
        type: string;
        title: string;
        status: number;
        detail: string;
        instance: string;
        requestId?: string;
    };
}

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly title: string,
        public readonly detail: string,
        public readonly requestId?: string,
    ) {
        super(`[${status}] ${title}: ${detail}`);
        this.name = 'ApiError';
    }

    get isNotFound() { return this.status === 404; }
    get isUnauthorized() { return this.status === 401; }
    get isForbidden() { return this.status === 403; }
    get isConflict() { return this.status === 409; }
    get isRateLimited() { return this.status === 429; }
    get isServerError() { return this.status >= 500; }
}

// ─── Client factory ───────────────────────────────────────────

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

/**
 * Parse a ky HTTPError into our typed ApiError.
 * Falls back to a generic error if the body isn't RFC 7807 JSON.
 */
async function parseHttpError(error: HTTPError): Promise<ApiError> {
    try {
        const body = await error.response.clone().json() as Partial<ApiErrorBody>;
        const e = body.error;
        return new ApiError(
            error.response.status,
            e?.title ?? 'Request Failed',
            e?.detail ?? error.message,
            e?.requestId,
        );
    } catch {
        return new ApiError(
            error.response.status,
            'Request Failed',
            error.message,
        );
    }
}

/**
 * Create the authenticated API client.
 * Called lazily to avoid reading env vars at import time.
 */
function createApiClient(): KyInstance {
    return ky.create({
        prefixUrl: BASE_URL,
        timeout: 30_000,

        retry: {
            limit: 2,
            methods: ['get', 'head'],
            statusCodes: [408, 429, 500, 502, 503, 504],
            backoffLimit: 5_000,
        },

        hooks: {
            beforeRequest: [
                async (request) => {
                    // Attach JWT from Supabase session
                    const token = await getAccessToken();
                    if (token) {
                        request.headers.set('Authorization', `Bearer ${token}`);
                    }
                    request.headers.set('Content-Type', 'application/json');
                },
            ],

            afterResponse: [
                async (_request, _options, response) => {
                    // If 401, session expired — redirect to login
                    if (response.status === 401) {
                        // Avoid redirect loops on the login/callback pages
                        if (!window.location.pathname.startsWith('/auth')) {
                            window.location.href = '/auth/login';
                        }
                    }
                    return response;
                },
            ],

            beforeError: [
                async (error) => {
                    // Enrich the error before it propagates
                    const apiError = await parseHttpError(error);
                    // Attach to error object for consumers
                    (error as unknown as { apiError: ApiError }).apiError = apiError;
                    return error;
                },
            ],
        },
    });
}

// Singleton — created on first import
let _client: KyInstance | null = null;

function getClient(): KyInstance {
    if (!_client) _client = createApiClient();
    return _client;
}

// ─── Typed request helpers ────────────────────────────────────

/**
 * GET request — returns parsed JSON body.
 */
export async function apiGet<T>(
    url: string,
    searchParams?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
    try {
        const cleanParams: Record<string, string> = {};
        if (searchParams) {
            for (const [k, v] of Object.entries(searchParams)) {
                if (v !== undefined) cleanParams[k] = String(v);
            }
        }
        return await getClient().get(url, {
            searchParams: Object.keys(cleanParams).length > 0 ? cleanParams : undefined,
        }).json<T>();
    } catch (err) {
        throw toApiError(err);
    }
}

/**
 * POST request with JSON body — returns parsed JSON body.
 */
export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
    try {
        return await getClient().post(url, { json: body }).json<T>();
    } catch (err) {
        throw toApiError(err);
    }
}

/**
 * PATCH request with JSON body — returns parsed JSON body.
 */
export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
    try {
        return await getClient().patch(url, { json: body }).json<T>();
    } catch (err) {
        throw toApiError(err);
    }
}

/**
 * DELETE request — returns nothing (expects 204).
 */
export async function apiDelete(url: string): Promise<void> {
    try {
        await getClient().delete(url);
    } catch (err) {
        throw toApiError(err);
    }
}

/**
 * Multipart form-data upload (for contract files).
 * Uses native fetch via ky — does NOT set Content-Type (browser sets boundary).
 */
export async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
    try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        return await getClient().post(url, {
            body: formData,
            headers,
            // Don't set Content-Type — browser sets it with boundary
        }).json<T>();
    } catch (err) {
        throw toApiError(err);
    }
}

// ─── Internal helper ─────────────────────────────────────────

function toApiError(err: unknown): ApiError {
    // Already an ApiError (e.g. from another layer)
    if (err instanceof ApiError) return err;

    // ky HTTPError with attached apiError from our beforeError hook
    if (err instanceof HTTPError) {
        const attached = (err as unknown as { apiError?: ApiError }).apiError;
        if (attached) return attached;
        return new ApiError(err.response.status, 'HTTP Error', err.message);
    }

    // Network error / timeout
    if (err instanceof Error) {
        return new ApiError(0, 'Network Error', err.message);
    }

    return new ApiError(0, 'Unknown Error', String(err));
}
