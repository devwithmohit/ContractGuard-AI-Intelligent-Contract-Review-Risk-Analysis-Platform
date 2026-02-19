/**
 * ContractUploader.tsx
 *
 * Drag-and-drop file upload zone with:
 *  - Drag-over highlight
 *  - File type / size validation
 *  - Progress bar (via useUpload hook)
 *  - Accepted formats: PDF, DOCX, DOC (max 25 MB)
 *
 * Usage: drop a file or click to open file picker.
 * The parent (UploadPage) owns form state; this component only handles
 * the file selection and forwards it via onFileSelect/onFileClear.
 */
import { useRef, useState, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatFileSize } from '@/lib/utils';
import { validateFile } from '@/hooks/useUpload';

// ─── Types ────────────────────────────────────────────────────

interface ContractUploaderProps {
    file: File | null;
    onFileSelect: (file: File) => void;
    onFileClear: () => void;
    progress?: number;            // 0–100, shown when uploading
    isUploading?: boolean;
    error?: string | null;
    disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────

export default function ContractUploader({
    file,
    onFileSelect,
    onFileClear,
    progress = 0,
    isUploading = false,
    error = null,
    disabled = false,
}: ContractUploaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const displayError = error ?? localError;

    // ── File processing ───────────────────────────────────────

    const processFile = useCallback((f: File) => {
        setLocalError(null);
        const validErr = validateFile(f);
        if (validErr) {
            setLocalError(validErr);
            return;
        }
        onFileSelect(f);
    }, [onFileSelect]);

    // ── Drag events ───────────────────────────────────────────

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
    }

    function handleDragLeave(e: DragEvent) {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
            setIsDragging(false);
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        setIsDragging(false);
        if (disabled) return;
        const f = e.dataTransfer.files[0];
        if (f) processFile(f);
    }

    // ── Input change ──────────────────────────────────────────

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (f) processFile(f);
        // Reset input so same file can be re-selected after clearing
        e.target.value = '';
    }

    // ── Selected file view ────────────────────────────────────

    if (file && !localError) {
        return (
            <div
                className={cn(
                    'relative rounded-2xl border p-5 transition-all',
                    isUploading
                        ? 'border-brand-500/40 bg-brand-500/5'
                        : 'border-surface-border bg-surface-card',
                )}
            >
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15">
                        <FileText className="h-5 w-5 text-brand-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-content-primary truncate">{file.name}</p>
                        <p className="text-xs text-content-muted">{formatFileSize(file.size)}</p>
                    </div>

                    {isUploading ? (
                        <span className="text-xs text-brand-400 shrink-0">{progress}%</span>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { onFileClear(); setLocalError(null); }}
                            disabled={disabled}
                            className="shrink-0 rounded-lg p-1.5 text-content-muted hover:bg-surface-elevated hover:text-content-primary transition-colors"
                            aria-label="Remove file"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Progress bar */}
                <AnimatePresence>
                    {isUploading && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 overflow-hidden"
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-content-muted">Uploading…</span>
                                <span className="text-xs text-brand-400 font-medium">{progress}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full bg-gradient-brand"
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.2 }}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Done indicator */}
                {!isUploading && progress === 100 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Upload complete
                    </div>
                )}
            </div>
        );
    }

    // ── Drop zone ─────────────────────────────────────────────

    return (
        <div className="space-y-3">
            <div
                role="button"
                tabIndex={0}
                aria-label="Upload contract — click or drag and drop"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !disabled && inputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && inputRef.current?.click()}
                className={cn(
                    'flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed',
                    'min-h-[180px] cursor-pointer p-8 text-center transition-all duration-200',
                    isDragging && !disabled
                        ? 'border-brand-400 bg-brand-500/10 scale-[1.01]'
                        : displayError
                            ? 'border-red-500/40 bg-red-500/5'
                            : 'border-surface-border bg-surface-card hover:border-brand-500/40 hover:bg-brand-500/5',
                    disabled && 'pointer-events-none opacity-50',
                )}
            >
                <div className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-2xl transition-colors',
                    isDragging ? 'bg-brand-500/20' : 'bg-surface-elevated',
                )}>
                    <Upload className={cn(
                        'h-5 w-5 transition-colors',
                        isDragging ? 'text-brand-400' : 'text-content-muted',
                    )} />
                </div>

                <div>
                    <p className="text-sm font-medium text-content-primary">
                        {isDragging ? 'Drop it here' : 'Drag & drop your contract'}
                    </p>
                    <p className="mt-1 text-xs text-content-muted">
                        or <span className="text-brand-400 underline">click to browse</span>
                    </p>
                    <p className="mt-2 text-[11px] text-content-muted">
                        PDF, DOCX, DOC · Max 25 MB
                    </p>
                </div>
            </div>

            {/* Validation error */}
            <AnimatePresence>
                {displayError && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5"
                    >
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                        <p className="text-xs text-red-300">{displayError}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                className="hidden"
                onChange={handleChange}
                disabled={disabled}
                id="contract-file-input"
            />
        </div>
    );
}
