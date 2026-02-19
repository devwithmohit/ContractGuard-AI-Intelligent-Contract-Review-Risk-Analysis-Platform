/**
 * useUpload.ts
 *
 * Contract file upload with real progress tracking.
 *
 * Uses XMLHttpRequest (not fetch) so we can report upload progress.
 * After success, invalidates the contract list + dashboard stats cache.
 *
 * Returns:
 *  - upload(file, meta)   → Promise<UploadResponse>
 *  - progress             → 0–100 number
 *  - isUploading          → boolean
 *  - error                → string | null
 *  - reset()              → clears state
 */
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { ApiError } from '@/lib/api';
import type { ContractType } from '@/types/contract.types';

// ─── Types ────────────────────────────────────────────────────

export interface UploadMeta {
    name: string;
    type: ContractType;
    counterparty?: string;
    effectiveDate?: string;
    expirationDate?: string;
    autoRenewal?: boolean;
}

export interface UploadResponse {
    contractId: string;
    jobId: string;
    status: 'processing';
    message: string;
}

// ─── Validation ───────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
];

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function validateFile(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return 'Only PDF and Word documents (.pdf, .docx, .doc) are supported.';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return `File is too large. Maximum size is 25 MB (your file: ${(file.size / 1024 / 1024).toFixed(1)} MB).`;
    }
    return null;
}

// ─── XHR upload with progress ────────────────────────────────

function xhrUpload(
    url: string,
    formData: FormData,
    token: string,
    onProgress: (pct: number) => void,
    signal: AbortSignal,
): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const body = JSON.parse(xhr.responseText) as unknown;
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(body as UploadResponse);
                } else {
                    const errBody = body as { error?: { title?: string; detail?: string; status?: number } };
                    reject(
                        new ApiError(
                            xhr.status,
                            errBody.error?.title ?? 'Upload Failed',
                            errBody.error?.detail ?? xhr.statusText,
                        ),
                    );
                }
            } catch {
                reject(new ApiError(xhr.status, 'Upload Failed', 'Invalid server response.'));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new ApiError(0, 'Network Error', 'Upload failed — check your connection.'));
        });

        xhr.addEventListener('abort', () => {
            reject(new ApiError(0, 'Cancelled', 'Upload was cancelled.'));
        });

        signal.addEventListener('abort', () => xhr.abort());

        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
    });
}

// ─── Hook ─────────────────────────────────────────────────────

export function useUpload() {
    const queryClient = useQueryClient();
    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setProgress(0);
        setIsUploading(false);
        setError(null);
    }, []);

    const upload = useCallback(
        async (file: File, meta: UploadMeta): Promise<UploadResponse | null> => {
            // Validate
            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
                toast.error(validationError);
                return null;
            }

            // Get JWT
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                const msg = 'Session expired — please sign in again.';
                setError(msg);
                toast.error(msg);
                return null;
            }

            // Build FormData
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', meta.name.trim());
            formData.append('type', meta.type);
            if (meta.counterparty) formData.append('counterparty', meta.counterparty.trim());
            if (meta.effectiveDate) formData.append('effectiveDate', meta.effectiveDate);
            if (meta.expirationDate) formData.append('expirationDate', meta.expirationDate);
            if (meta.autoRenewal !== undefined)
                formData.append('autoRenewal', String(meta.autoRenewal));

            const controller = new AbortController();

            try {
                setIsUploading(true);
                setError(null);
                setProgress(0);

                const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
                const result = await xhrUpload(
                    `${BASE}/api/v1/contracts/upload`,
                    formData,
                    session.access_token,
                    setProgress,
                    controller.signal,
                );

                // Invalidate list + dashboard so new contract appears immediately
                void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() });
                void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });

                toast.success('Contract uploaded — AI analysis has started!');
                return result;
            } catch (err) {
                const msg =
                    err instanceof ApiError
                        ? err.detail
                        : err instanceof Error
                            ? err.message
                            : 'Upload failed. Please try again.';
                setError(msg);
                if (!(err instanceof ApiError && err.status === 0 && err.title === 'Cancelled')) {
                    toast.error(msg);
                }
                return null;
            } finally {
                setIsUploading(false);
            }
        },
        [queryClient],
    );

    return { upload, progress, isUploading, error, reset };
}
