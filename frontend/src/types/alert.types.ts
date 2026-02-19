/**
 * alert.types.ts
 *
 * Frontend alert types mirroring backend API response shapes.
 * Source of truth: backend/src/services/alert.service.ts
 */

// ─── Enums ────────────────────────────────────────────────────

export type AlertType = 'expiration' | 'renewal' | 'risk' | 'compliance';

// ─── Alert ────────────────────────────────────────────────────

export interface Alert {
    id: string;
    org_id: string;
    contract_id: string;
    alert_type: AlertType;
    message: string;
    trigger_date: string;
    is_read: boolean;
    snoozed_until: string | null;
    created_at: string;
    // Joined from contracts table (always present in list responses)
    contract_name?: string;
    contract_type?: string;
    risk_score?: number | null;
    expiration_date?: string | null;
}

// ─── List Response (GET /api/v1/alerts) ──────────────────────

export interface AlertListResponse {
    data: Alert[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    unreadCount?: number;   // Also available via X-Unread-Count response header
}

// ─── Actions ──────────────────────────────────────────────────

/** PATCH /api/v1/alerts/:id/snooze request body */
export interface SnoozeAlertBody {
    snoozedUntil: string; // ISO 8601
}

/** PATCH /api/v1/alerts/:id/snooze response */
export interface SnoozeAlertResponse {
    alert: Alert;
    message: string;
}

/** POST /api/v1/alerts/:id/read response */
export interface MarkReadResponse {
    updated: number;
    message: string;
}

// ─── Filters ──────────────────────────────────────────────────

export interface AlertListFilters {
    alert_type?: AlertType;
    is_read?: boolean;
    contract_id?: string;
    include_snoozed?: boolean;
    page?: number;
    limit?: number;
}

// ─── Display helpers ──────────────────────────────────────────

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
    expiration: 'Expiring Soon',
    renewal: 'Auto-Renewal',
    risk: 'High Risk',
    compliance: 'Compliance',
};

export const ALERT_TYPE_ICONS: Record<AlertType, string> = {
    expiration: 'Clock',
    renewal: 'RefreshCw',
    risk: 'AlertTriangle',
    compliance: 'Shield',
};
