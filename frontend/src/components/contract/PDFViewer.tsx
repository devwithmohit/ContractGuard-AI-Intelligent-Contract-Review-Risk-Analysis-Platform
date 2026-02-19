/**
 * PDFViewer.tsx
 *
 * Renders a PDF using an <iframe> (simplest reliable approach — no
 * native dependency pain). For the signed URL from the backend.
 *
 * Falls back to a "Download PDF" button if the URL is not available.
 * Supports loading skeleton and error states.
 */
import { useState } from 'react';
import { FileDown, AlertCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────

interface PDFViewerProps {
    /** Presigned URL from GET /api/v1/contracts/:id (signedUrl field) */
    signedUrl: string | null;
    contractName?: string;
    className?: string;
}

// ─── Component ────────────────────────────────────────────────

export default function PDFViewer({ signedUrl, contractName = 'Contract', className }: PDFViewerProps) {
    const [loadError, setLoadError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // ── No URL available ───────────────────────────────────────

    if (!signedUrl) {
        return (
            <div className={cn(
                'flex flex-col items-center justify-center gap-4 rounded-2xl border border-surface-border bg-surface-card p-12 text-center',
                className,
            )}>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated">
                    <FileText className="h-6 w-6 text-content-muted" />
                </div>
                <div>
                    <p className="text-sm font-medium text-content-secondary">PDF not available</p>
                    <p className="mt-1 text-xs text-content-muted">
                        The document is still being processed or the link has expired.
                    </p>
                </div>
            </div>
        );
    }

    // ── Load error fallback ────────────────────────────────────

    if (loadError) {
        return (
            <div className={cn(
                'flex flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-12 text-center',
                className,
            )}>
                <AlertCircle className="h-8 w-8 text-red-400" />
                <div>
                    <p className="text-sm font-medium text-red-300">Could not display PDF</p>
                    <p className="mt-1 text-xs text-content-muted">
                        Your browser may be blocking embedded PDFs.
                    </p>
                </div>
                <a
                    href={signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary gap-2"
                    download={contractName}
                >
                    <FileDown className="h-4 w-4" />
                    Download PDF
                </a>
            </div>
        );
    }

    // ── Iframe viewer ─────────────────────────────────────────

    return (
        <div className={cn('relative overflow-hidden rounded-2xl border border-surface-border bg-surface-card', className)}>
            {/* Skeleton while loading */}
            {!isLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-card animate-pulse z-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500" />
                    <p className="text-xs text-content-muted">Loading PDF…</p>
                </div>
            )}

            <iframe
                src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                title={contractName}
                className={cn(
                    'h-full w-full transition-opacity duration-300',
                    isLoaded ? 'opacity-100' : 'opacity-0',
                )}
                onLoad={() => setIsLoaded(true)}
                onError={() => setLoadError(true)}
                style={{ minHeight: '600px', border: 'none' }}
            />

            {/* Download button overlay — top-right corner */}
            <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                download={contractName}
                className={cn(
                    'absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg',
                    'bg-surface/80 backdrop-blur-sm border border-surface-border px-2.5 py-1.5',
                    'text-xs text-content-secondary hover:text-content-primary transition-colors',
                    !isLoaded && 'hidden',
                )}
                title="Download PDF"
            >
                <FileDown className="h-3.5 w-3.5" />
                Download
            </a>
        </div>
    );
}
