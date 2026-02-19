/**
 * ContractGuard AI — Custom Error Classes
 *
 * All errors follow RFC 7807 (Problem Details for HTTP APIs).
 * Each error serializes to a consistent JSON response shape.
 */

const BASE_ERROR_URL = 'https://contractguard.app/errors';

// ─── RFC 7807 Error Response Shape ───────────────────────────────
export interface ErrorResponse {
    error: {
        type: string;
        title: string;
        status: number;
        detail: string;
        instance?: string;
        requestId?: string;
    };
}

// ─── Base Application Error ──────────────────────────────────────
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly errorType: string;
    public readonly title: string;
    public readonly isOperational: boolean;

    constructor(
        message: string,
        statusCode: number,
        errorType: string,
        title: string,
        isOperational = true,
    ) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorType = errorType;
        this.title = title;
        this.isOperational = isOperational;

        // Maintains proper stack trace in V8/Bun
        Error.captureStackTrace?.(this, this.constructor);
    }

    /**
     * Serialize to RFC 7807 response format.
     */
    toResponse(instance?: string, requestId?: string): ErrorResponse {
        return {
            error: {
                type: `${BASE_ERROR_URL}/${this.errorType}`,
                title: this.title,
                status: this.statusCode,
                detail: this.message,
                ...(instance && { instance }),
                ...(requestId && { requestId }),
            },
        };
    }
}

// ─── 400: Validation Error ───────────────────────────────────────
export class ValidationError extends AppError {
    public readonly validationErrors?: Record<string, string[]>;

    constructor(message: string, validationErrors?: Record<string, string[]>) {
        super(message, 400, 'validation-error', 'Validation Error');
        this.validationErrors = validationErrors;
    }

    override toResponse(instance?: string, requestId?: string): ErrorResponse {
        const base = super.toResponse(instance, requestId);
        if (this.validationErrors) {
            (base.error as Record<string, unknown>).errors = this.validationErrors;
        }
        return base;
    }
}

// ─── 401: Unauthorized ───────────────────────────────────────────
export class UnauthorizedError extends AppError {
    constructor(message = 'Missing or invalid authentication token') {
        super(message, 401, 'unauthorized', 'Unauthorized');
    }
}

// ─── 403: Forbidden ──────────────────────────────────────────────
export class ForbiddenError extends AppError {
    constructor(message = 'Insufficient permissions for this operation') {
        super(message, 403, 'forbidden', 'Forbidden');
    }
}

// ─── 404: Not Found ──────────────────────────────────────────────
export class NotFoundError extends AppError {
    constructor(resource = 'Resource', identifier?: string) {
        const detail = identifier
            ? `${resource} with id '${identifier}' not found`
            : `${resource} not found`;
        super(detail, 404, 'not-found', 'Not Found');
    }
}

// ─── 402: Tier Limit Exceeded ────────────────────────────────────
export class TierLimitError extends AppError {
    public readonly currentTier: string;
    public readonly limit: number;

    constructor(currentTier: string, limit: number) {
        super(
            `Contract upload limit reached for '${currentTier}' tier (max ${limit}). Please upgrade your plan.`,
            402,
            'tier-limit-exceeded',
            'Tier Limit Exceeded',
        );
        this.currentTier = currentTier;
        this.limit = limit;
    }
}

// ─── 409: Conflict ───────────────────────────────────────────────
export class ConflictError extends AppError {
    constructor(message = 'A resource with this identifier already exists') {
        super(message, 409, 'conflict', 'Conflict');
    }
}

// ─── 413: Payload Too Large ──────────────────────────────────────
export class PayloadTooLargeError extends AppError {
    constructor(maxSizeMB = 50) {
        super(
            `File size exceeds the maximum allowed size of ${maxSizeMB}MB`,
            413,
            'payload-too-large',
            'Payload Too Large',
        );
    }
}

// ─── 422: Analysis Failed ────────────────────────────────────────
export class AnalysisFailedError extends AppError {
    public readonly contractId?: string;

    constructor(message = 'AI analysis pipeline failed', contractId?: string) {
        super(message, 422, 'analysis-failed', 'Analysis Failed');
        this.contractId = contractId;
    }
}

// ─── 422: AI Service Error ───────────────────────────────────────
export class AIServiceError extends AppError {
    public readonly provider: 'groq' | 'jina';
    public readonly modelUsed?: string;

    constructor(
        message: string,
        provider: 'groq' | 'jina',
        modelUsed?: string,
    ) {
        super(message, 422, 'ai-service-error', 'AI Service Error');
        this.provider = provider;
        this.modelUsed = modelUsed;
    }
}

// ─── 429: Rate Limit Exceeded ────────────────────────────────────
export class RateLimitError extends AppError {
    public readonly retryAfterSeconds: number;

    constructor(retryAfterSeconds: number) {
        super(
            `Rate limit exceeded. Please retry after ${retryAfterSeconds} seconds.`,
            429,
            'rate-limit-exceeded',
            'Rate Limit Exceeded',
        );
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

// ─── 503: Service Unavailable ────────────────────────────────────
export class ServiceUnavailableError extends AppError {
    public readonly dependency: string;

    constructor(dependency: string, message?: string) {
        super(
            message ?? `Service dependency '${dependency}' is currently unavailable`,
            503,
            'service-unavailable',
            'Service Unavailable',
            false, // Non-operational — indicates infrastructure issue
        );
        this.dependency = dependency;
    }
}

// ─── Error Type Guard ────────────────────────────────────────────
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

// ─── Error Factory (from status code) ────────────────────────────
export function createHttpError(statusCode: number, message: string): AppError {
    switch (statusCode) {
        case 400:
            return new ValidationError(message);
        case 401:
            return new UnauthorizedError(message);
        case 403:
            return new ForbiddenError(message);
        case 404:
            return new NotFoundError(message);
        case 409:
            return new ConflictError(message);
        case 413:
            return new PayloadTooLargeError();
        case 429:
            return new RateLimitError(60);
        case 503:
            return new ServiceUnavailableError('unknown', message);
        default:
            return new AppError(message, statusCode, 'internal-error', 'Internal Server Error', false);
    }
}
