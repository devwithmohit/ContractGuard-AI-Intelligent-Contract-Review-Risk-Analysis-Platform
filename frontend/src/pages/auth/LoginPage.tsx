/**
 * LoginPage.tsx
 *
 * Authentication entry point — supports:
 *  1. Email + password sign-in
 *  2. Magic link (passwordless OTP via email)
 *  3. Google OAuth
 *
 * Design: full-screen dark layout, glassmorphic card, brand gradient accents.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck,
    Mail,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    Sparkles,
    Chrome,
    CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────

type AuthMode = 'password' | 'magic-link';

// ─── Animated background orbs ────────────────────────────────

function BackgroundOrbs() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {/* Top-right brand orb */}
            <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
            {/* Bottom-left accent orb */}
            <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-indigo-800/15 blur-3xl" />
            {/* Centre highlight */}
            <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-500/5 blur-2xl" />
        </div>
    );
}

// ─── Feature bullets ─────────────────────────────────────────

const FEATURES = [
    'AI-powered risk analysis in seconds',
    'Automatic clause identification & flagging',
    'Real-time deadline & expiry alerts',
    'Semantic search across all contracts',
] as const;

// ─── Component ────────────────────────────────────────────────

export default function LoginPage() {
    const { signInWithPassword, signInWithMagicLink, signInWithGoogle, isPending } = useAuth();

    // Form state
    const [mode, setMode] = useState<AuthMode>('password');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);

    // ── Form submit ───────────────────────────────────────────

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (isPending) return;

        if (mode === 'password') {
            await signInWithPassword(email, password);
        } else {
            await signInWithMagicLink(email);
            setMagicLinkSent(true);
        }
    }

    // ── Magic link sent confirmation view ─────────────────────

    if (magicLinkSent) {
        return (
            <div className="relative flex h-dvh flex-col items-center justify-center bg-surface px-4">
                <BackgroundOrbs />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 w-full max-w-sm text-center"
                >
                    <div className="mb-6 flex justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 ring-1 ring-green-500/30">
                            <CheckCircle2 className="h-8 w-8 text-green-400" />
                        </div>
                    </div>

                    <h1 className="mb-2 text-2xl font-bold text-content-primary">
                        Check your inbox
                    </h1>
                    <p className="mb-1 text-sm text-content-secondary">
                        We sent a magic link to
                    </p>
                    <p className="mb-6 text-sm font-semibold text-brand-400">{email}</p>
                    <p className="text-xs text-content-muted">
                        Click the link in the email to sign in. The link expires in 1 hour.
                    </p>

                    <button
                        type="button"
                        id="magic-link-resend-btn"
                        onClick={() => setMagicLinkSent(false)}
                        className="mt-8 text-sm text-brand-400 hover:text-brand-300 underline underline-offset-2 transition-colors"
                    >
                        ← Back to sign in
                    </button>
                </motion.div>
            </div>
        );
    }

    // ── Main login form ───────────────────────────────────────

    return (
        <div className="relative flex min-h-dvh overflow-hidden bg-surface">
            <BackgroundOrbs />

            {/* ─── Left panel: login form ─────────────────── */}
            <div className="relative z-10 flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2 lg:px-16">
                {/* Logo */}
                <div className="mb-10 flex items-center gap-3 self-start">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-sm">
                        <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2} />
                    </div>
                    <span className="text-lg font-bold text-content-primary tracking-tight">
                        ContractGuard <span className="text-brand-400">AI</span>
                    </span>
                </div>

                {/* Heading */}
                <div className="mb-8 self-start">
                    <h1 className="text-3xl font-bold text-content-primary">
                        Welcome back
                    </h1>
                    <p className="mt-2 text-sm text-content-secondary">
                        Sign in to review and manage your contracts.
                    </p>
                </div>

                {/* Card */}
                <div className="w-full max-w-sm">
                    {/* Google OAuth button */}
                    <button
                        id="login-google-btn"
                        type="button"
                        onClick={() => void signInWithGoogle()}
                        disabled={isPending}
                        className={cn(
                            'relative flex w-full items-center justify-center gap-3 rounded-xl',
                            'border border-surface-border bg-surface-elevated px-4 py-2.5',
                            'text-sm font-medium text-content-primary',
                            'hover:border-brand-500/40 hover:bg-surface-card transition-all duration-150',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                    >
                        <Chrome className="h-4 w-4 text-[#4285F4]" />
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="relative my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-surface-border" />
                        <span className="text-xs text-content-muted">or sign in with email</span>
                        <div className="h-px flex-1 bg-surface-border" />
                    </div>

                    {/* Mode toggle */}
                    <div className="mb-6 flex rounded-xl border border-surface-border bg-surface-elevated p-1 gap-1">
                        {([
                            { key: 'password', label: 'Password' },
                            { key: 'magic-link', label: 'Magic Link' },
                        ] as const).map(({ key, label }) => (
                            <button
                                key={key}
                                id={`login-mode-${key}-btn`}
                                type="button"
                                onClick={() => setMode(key)}
                                className={cn(
                                    'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150',
                                    mode === key
                                        ? 'bg-surface-card text-content-primary shadow-sm'
                                        : 'text-content-muted hover:text-content-secondary',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Form */}
                    <form id="login-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
                        <div className="space-y-4">
                            {/* Email field */}
                            <div>
                                <label
                                    htmlFor="login-email"
                                    className="mb-1.5 block text-xs font-medium text-content-secondary"
                                >
                                    Email address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted pointer-events-none" />
                                    <input
                                        id="login-email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        className="input w-full pl-10 pr-4"
                                        disabled={isPending}
                                    />
                                </div>
                            </div>

                            {/* Password field — only in password mode */}
                            <AnimatePresence initial={false}>
                                {mode === 'password' && (
                                    <motion.div
                                        key="password-field"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.18, ease: 'easeInOut' }}
                                        className="overflow-hidden"
                                    >
                                        <label
                                            htmlFor="login-password"
                                            className="mb-1.5 block text-xs font-medium text-content-secondary"
                                        >
                                            Password
                                        </label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted pointer-events-none" />
                                            <input
                                                id="login-password"
                                                type={showPassword ? 'text' : 'password'}
                                                autoComplete="current-password"
                                                required={mode === 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••"
                                                className="input w-full pl-10 pr-10"
                                                disabled={isPending}
                                            />
                                            <button
                                                type="button"
                                                id="login-show-password-btn"
                                                onClick={() => setShowPassword((s) => !s)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors"
                                                tabIndex={-1}
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showPassword
                                                    ? <EyeOff className="h-4 w-4" />
                                                    : <Eye className="h-4 w-4" />
                                                }
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Magic link helper text */}
                            <AnimatePresence initial={false}>
                                {mode === 'magic-link' && (
                                    <motion.p
                                        key="magic-link-hint"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-2 rounded-xl border border-brand-500/20 bg-brand-500/5 px-3 py-2.5 text-xs text-brand-300"
                                    >
                                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-400" />
                                        We'll email you a one-click link — no password needed.
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Submit button */}
                        <button
                            id="login-submit-btn"
                            type="submit"
                            disabled={isPending || !email.trim()}
                            className={cn(
                                'btn-primary mt-6 w-full justify-center gap-2',
                                isPending && 'opacity-75 cursor-not-allowed',
                            )}
                        >
                            {isPending ? (
                                <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    {mode === 'password' ? 'Signing in…' : 'Sending link…'}
                                </>
                            ) : (
                                <>
                                    {mode === 'password' ? 'Sign in' : 'Send magic link'}
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <p className="mt-6 text-center text-xs text-content-muted">
                        Don't have an account?{' '}
                        <Link
                            to="/auth/login"
                            className="text-brand-400 hover:text-brand-300 underline underline-offset-2 transition-colors"
                        >
                            Contact your admin
                        </Link>
                    </p>
                </div>
            </div>

            {/* ─── Right panel: feature showcase ─────────────── */}
            <div className="relative hidden flex-col justify-center overflow-hidden bg-surface-card/50 px-16 lg:flex lg:w-1/2">
                {/* Decorative grid */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(99,102,241,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.8) 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                    }}
                    aria-hidden="true"
                />

                <div className="relative z-10 max-w-md">
                    {/* Badge */}
                    <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1">
                        <Sparkles className="h-3 w-3 text-brand-400" />
                        <span className="text-xs font-medium text-brand-300">
                            AI-Powered Contract Intelligence
                        </span>
                    </div>

                    <h2 className="mb-4 text-4xl font-black leading-tight text-content-primary">
                        Review smarter.{' '}
                        <span className="text-gradient">Risk less.</span>
                    </h2>

                    <p className="mb-10 text-base text-content-secondary leading-relaxed">
                        ContractGuard uses advanced AI to analyse your contracts in seconds,
                        surfacing hidden risks before they become costly problems.
                    </p>

                    {/* Feature list */}
                    <ul className="space-y-4">
                        {FEATURES.map((feature) => (
                            <li key={feature} className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-400" />
                                </div>
                                <span className="text-sm text-content-secondary">{feature}</span>
                            </li>
                        ))}
                    </ul>

                    {/* Decorative risk gauge card */}
                    <div className="mt-12 rounded-2xl border border-surface-border bg-surface/80 p-5 backdrop-blur-sm shadow-glow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold text-content-secondary uppercase tracking-wide">
                                Risk Analysis
                            </p>
                            <span className="badge-risk-high text-xs px-2 py-0.5 rounded-full">
                                High Risk
                            </span>
                        </div>
                        <div className="space-y-2.5">
                            {[
                                { label: 'Liability Cap', score: 85, color: 'bg-red-500' },
                                { label: 'Termination Clause', score: 62, color: 'bg-orange-500' },
                                { label: 'IP Ownership', score: 41, color: 'bg-amber-500' },
                                { label: 'Payment Terms', score: 18, color: 'bg-green-500' },
                            ].map(({ label, score, color }) => (
                                <div key={label}>
                                    <div className="mb-1 flex justify-between text-xs">
                                        <span className="text-content-secondary">{label}</span>
                                        <span className="font-mono text-content-muted">{score}</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
                                        <motion.div
                                            className={cn('h-full rounded-full', color)}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${score}%` }}
                                            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
