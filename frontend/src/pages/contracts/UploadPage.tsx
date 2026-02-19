/**
 * UploadPage.tsx
 *
 * Full two-step upload form:
 *  Step 1 – File selection (drag-drop area)
 *  Step 2 – Contract metadata (name, type, counterparty, dates, auto-renewal)
 *
 * On submit: calls useUpload → POST /api/v1/contracts/upload (multipart)
 * On success: navigates to the new contract's detail page.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    ArrowRight,
    Upload,
    Check,
} from 'lucide-react';
import { useUpload, type UploadMeta } from '@/hooks/useUpload';
import ContractUploader from '@/components/contract/ContractUploader';
import { cn } from '@/lib/utils';
import type { ContractType } from '@/types/contract.types';

// ─── Constants ────────────────────────────────────────────────

const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
    { value: 'NDA', label: 'NDA — Non-Disclosure Agreement' },
    { value: 'MSA', label: 'MSA — Master Service Agreement' },
    { value: 'SaaS', label: 'SaaS Agreement' },
    { value: 'Vendor', label: 'Vendor Agreement' },
    { value: 'Employment', label: 'Employment Agreement' },
    { value: 'Other', label: 'Other' },
];

// ─── Step indicators ──────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 }) {
    return (
        <div className="flex items-center gap-2">
            {[1, 2].map((step) => (
                <div key={step} className="flex items-center gap-2">
                    <div className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                        step < current
                            ? 'bg-green-500 text-white'
                            : step === current
                                ? 'bg-brand-500 text-white shadow-glow-sm'
                                : 'bg-surface-elevated text-content-muted',
                    )}>
                        {step < current ? <Check className="h-3.5 w-3.5" /> : step}
                    </div>
                    <span className={cn(
                        'text-xs font-medium hidden sm:inline transition-colors',
                        step === current ? 'text-content-primary' : 'text-content-muted',
                    )}>
                        {step === 1 ? 'Select file' : 'Contract details'}
                    </span>
                    {step < 2 && <div className="h-px w-8 bg-surface-border" />}
                </div>
            ))}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────

export default function UploadPage() {
    const navigate = useNavigate();
    const { upload, progress, isUploading, error, reset } = useUpload();

    // ── State ──────────────────────────────────────────────────
    const [step, setStep] = useState<1 | 2>(1);
    const [file, setFile] = useState<File | null>(null);

    // Metadata fields
    const [name, setName] = useState('');
    const [type, setType] = useState<ContractType>('NDA');
    const [counterparty, setCounterparty] = useState('');
    const [effectiveDate, setEffectiveDate] = useState('');
    const [expirationDate, setExpirationDate] = useState('');
    const [autoRenewal, setAutoRenewal] = useState(false);

    // ── File selection ─────────────────────────────────────────

    function handleFileSelect(f: File) {
        setFile(f);
        // Auto-fill name from filename (strip extension)
        if (!name) {
            setName(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
        }
    }

    function handleFileClear() {
        setFile(null);
        reset();
    }

    function goToStep2(e: FormEvent) {
        e.preventDefault();
        if (file) setStep(2);
    }

    // ── Submit ─────────────────────────────────────────────────

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!file || isUploading) return;

        const meta: UploadMeta = {
            name: name.trim() || file.name,
            type,
            ...(counterparty.trim() && { counterparty: counterparty.trim() }),
            ...(effectiveDate && { effectiveDate }),
            ...(expirationDate && { expirationDate }),
            autoRenewal,
        };

        const result = await upload(file, meta);
        if (result) {
            navigate(`/contracts/${result.contractId}`, { replace: true });
        }
    }

    // ─────────────────────────────────────────────────────────

    return (
        <div className="animate-fade-up max-w-2xl mx-auto">
            {/* ── Breadcrumb ─────────────────────────────────── */}
            <div className="mb-6 flex items-center gap-2 text-sm text-content-muted">
                <Link to="/contracts" className="hover:text-content-primary transition-colors">
                    Contracts
                </Link>
                <span>/</span>
                <span className="text-content-secondary">Upload</span>
            </div>

            {/* ── Header ────────────────────────────────────── */}
            <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-content-primary">Upload Contract</h1>
                    <p className="mt-1 text-sm text-content-muted">
                        AI analysis starts automatically after upload.
                    </p>
                </div>
                <StepIndicator current={step} />
            </div>

            {/* ── Step 1: File selection ─────────────────── */}
            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.form
                        key="step1"
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.22 }}
                        onSubmit={goToStep2}
                        className="space-y-6"
                    >
                        <div className="card p-6">
                            <h2 className="mb-4 text-sm font-semibold text-content-primary">
                                Select your contract file
                            </h2>
                            <ContractUploader
                                file={file}
                                onFileSelect={handleFileSelect}
                                onFileClear={handleFileClear}
                                error={error}
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                id="upload-next-btn"
                                type="submit"
                                disabled={!file}
                                className="btn-primary gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </motion.form>
                )}

                {/* ── Step 2: Metadata ──────────────────────── */}
                {step === 2 && (
                    <motion.form
                        key="step2"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.22 }}
                        onSubmit={(e) => void handleSubmit(e)}
                        className="space-y-5"
                    >
                        {/* File summary */}
                        <div className="card p-4">
                            <ContractUploader
                                file={file}
                                onFileSelect={handleFileSelect}
                                onFileClear={() => { handleFileClear(); setStep(1); }}
                                progress={progress}
                                isUploading={isUploading}
                                error={error}
                                disabled={isUploading}
                            />
                        </div>

                        {/* Metadata form */}
                        <div className="card p-6 space-y-5">
                            <h2 className="text-sm font-semibold text-content-primary">
                                Contract details
                            </h2>

                            {/* Name */}
                            <div>
                                <label htmlFor="upload-name" className="form-label">
                                    Contract name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    id="upload-name"
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Vendor MSA 2024 — Acme Corp"
                                    className="input w-full mt-1.5"
                                    disabled={isUploading}
                                />
                            </div>

                            {/* Type */}
                            <div>
                                <label htmlFor="upload-type" className="form-label">
                                    Contract type <span className="text-red-400">*</span>
                                </label>
                                <select
                                    id="upload-type"
                                    value={type}
                                    onChange={(e) => setType(e.target.value as ContractType)}
                                    className="input w-full mt-1.5"
                                    disabled={isUploading}
                                >
                                    {CONTRACT_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Counterparty */}
                            <div>
                                <label htmlFor="upload-counterparty" className="form-label">
                                    Counterparty <span className="text-content-muted text-xs">(optional)</span>
                                </label>
                                <input
                                    id="upload-counterparty"
                                    type="text"
                                    value={counterparty}
                                    onChange={(e) => setCounterparty(e.target.value)}
                                    placeholder="Company or individual name"
                                    className="input w-full mt-1.5"
                                    disabled={isUploading}
                                />
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="upload-effective-date" className="form-label">
                                        Effective date
                                    </label>
                                    <input
                                        id="upload-effective-date"
                                        type="date"
                                        value={effectiveDate}
                                        onChange={(e) => setEffectiveDate(e.target.value)}
                                        className="input w-full mt-1.5"
                                        disabled={isUploading}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="upload-expiration-date" className="form-label">
                                        Expiration date
                                    </label>
                                    <input
                                        id="upload-expiration-date"
                                        type="date"
                                        value={expirationDate}
                                        onChange={(e) => setExpirationDate(e.target.value)}
                                        className="input w-full mt-1.5"
                                        disabled={isUploading}
                                    />
                                </div>
                            </div>

                            {/* Auto-renewal */}
                            <label className="flex cursor-pointer items-center gap-3">
                                <div className="relative">
                                    <input
                                        id="upload-auto-renewal"
                                        type="checkbox"
                                        checked={autoRenewal}
                                        onChange={(e) => setAutoRenewal(e.target.checked)}
                                        disabled={isUploading}
                                        className="peer sr-only"
                                    />
                                    <div className={cn(
                                        'h-5 w-9 rounded-full border transition-all peer-checked:bg-brand-500 peer-checked:border-brand-500',
                                        'border-surface-border bg-surface-elevated',
                                    )} />
                                    <div className={cn(
                                        'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                                        autoRenewal && 'translate-x-4',
                                    )} />
                                </div>
                                <div>
                                    <p className="text-sm text-content-primary">Auto-renewal</p>
                                    <p className="text-xs text-content-muted">Contract renews automatically unless cancelled</p>
                                </div>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                            <button
                                id="upload-back-btn"
                                type="button"
                                onClick={() => setStep(1)}
                                disabled={isUploading}
                                className="flex items-center gap-2 text-sm text-content-muted hover:text-content-primary transition-colors disabled:opacity-50"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </button>

                            <button
                                id="upload-submit-btn"
                                type="submit"
                                disabled={isUploading || !name.trim()}
                                className="btn-primary gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? (
                                    <>
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Uploading {progress}%…
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4" />
                                        Upload &amp; Analyse
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
    );
}
