import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('service.storage');

// ─── Singleton Supabase Client ───────────────────────────────
let supabase: SupabaseClient | null = null;

const BUCKET_NAME = 'contracts';

function getSupabase(): SupabaseClient {
    if (!supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !key) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
        }

        supabase = createClient(url, key, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
    }
    return supabase;
}

// ─── Types ───────────────────────────────────────────────────

export interface UploadResult {
    path: string;          // Full storage path: "org_id/contract_id.ext"
    size: number;          // File size in bytes
    contentType: string;   // MIME type
}

export interface SignedUrlResult {
    url: string;           // Signed download URL
    expiresAt: string;     // ISO timestamp when URL expires
}

// ─── Upload ──────────────────────────────────────────────────

/**
 * Upload a contract file to Supabase Storage.
 *
 * Files are namespaced by org_id to enforce multi-tenant isolation:
 *   "contracts/{org_id}/{contract_id}.{ext}"
 *
 * @param orgId      - Organization UUID
 * @param contractId - Contract UUID (used as filename)
 * @param fileBuffer - Raw file buffer
 * @param fileName   - Original file name (used to extract extension)
 * @param mimeType   - MIME type ('application/pdf' or 'application/vnd.openxmlformats...')
 */
export async function uploadFile(
    orgId: string,
    contractId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
): Promise<UploadResult> {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? 'pdf';
    const storagePath = `${orgId}/${contractId}.${ext}`;

    log.info(
        { orgId, contractId, storagePath, size: fileBuffer.length, mimeType },
        'Uploading file to storage',
    );

    const { data, error } = await getSupabase()
        .storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: true,   // Overwrite if re-uploading
            cacheControl: '3600',
        });

    if (error) {
        log.error({ err: error, storagePath }, 'Storage upload failed');
        throw new Error(`Storage upload failed: ${error.message}`);
    }

    log.info({ storagePath, fullPath: data.path }, 'File uploaded successfully');

    return {
        path: storagePath,
        size: fileBuffer.length,
        contentType: mimeType,
    };
}

// ─── Download ────────────────────────────────────────────────

/**
 * Download a file from Supabase Storage.
 * Returns the raw binary data as a Buffer.
 *
 * @param storagePath - Full path within the bucket (e.g. "org_id/contract_id.pdf")
 */
export async function downloadFile(storagePath: string): Promise<Buffer> {
    log.debug({ storagePath }, 'Downloading file from storage');

    const { data, error } = await getSupabase()
        .storage
        .from(BUCKET_NAME)
        .download(storagePath);

    if (error || !data) {
        log.error({ err: error, storagePath }, 'Storage download failed');
        throw new Error(`Storage download failed: ${error?.message ?? 'No data returned'}`);
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// ─── Signed URLs ─────────────────────────────────────────────

/**
 * Generate a signed download URL for a contract file.
 * URLs expire after `expiresInSeconds` (default: 1 hour).
 *
 * @param storagePath     - Full path within the bucket
 * @param expiresInSeconds - URL expiration (default: 3600 = 1 hour)
 */
export async function getSignedUrl(
    storagePath: string,
    expiresInSeconds = 3600,
): Promise<SignedUrlResult> {
    const { data, error } = await getSupabase()
        .storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data) {
        log.error({ err: error, storagePath }, 'Signed URL generation failed');
        throw new Error(`Signed URL generation failed: ${error?.message ?? 'Unknown error'}`);
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    log.debug({ storagePath, expiresInSeconds, expiresAt }, 'Signed URL generated');

    return {
        url: data.signedUrl,
        expiresAt,
    };
}

// ─── Delete ──────────────────────────────────────────────────

/**
 * Delete a file from Supabase Storage.
 *
 * @param storagePath - Full path within the bucket
 */
export async function deleteFile(storagePath: string): Promise<void> {
    const { error } = await getSupabase()
        .storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

    if (error) {
        log.error({ err: error, storagePath }, 'Storage delete failed');
        throw new Error(`Storage delete failed: ${error.message}`);
    }

    log.info({ storagePath }, 'File deleted from storage');
}

/**
 * Delete all files for a contract (handles both .pdf and .docx extensions).
 *
 * @param orgId      - Organization UUID
 * @param contractId - Contract UUID
 */
export async function deleteContractFiles(
    orgId: string,
    contractId: string,
): Promise<void> {
    const extensions = ['pdf', 'docx'];
    const paths = extensions.map((ext) => `${orgId}/${contractId}.${ext}`);

    const { error } = await getSupabase()
        .storage
        .from(BUCKET_NAME)
        .remove(paths);

    if (error) {
        log.warn({ err: error, orgId, contractId }, 'Bulk file delete had errors (non-fatal)');
    } else {
        log.info({ orgId, contractId }, 'Contract files deleted');
    }
}

// ─── List (for admin/debug) ──────────────────────────────────

/**
 * List all files for an organization.
 *
 * @param orgId - Organization UUID
 */
export async function listOrgFiles(
    orgId: string,
): Promise<Array<{ name: string; size: number; createdAt: string }>> {
    const { data, error } = await getSupabase()
        .storage
        .from(BUCKET_NAME)
        .list(orgId, {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'desc' },
        });

    if (error) {
        log.error({ err: error, orgId }, 'Storage list failed');
        throw new Error(`Storage list failed: ${error.message}`);
    }

    return (data ?? []).map((file) => ({
        name: file.name,
        size: file.metadata?.size ?? 0,
        createdAt: file.created_at,
    }));
}

export default {
    uploadFile,
    downloadFile,
    getSignedUrl,
    deleteFile,
    deleteContractFiles,
    listOrgFiles,
};
