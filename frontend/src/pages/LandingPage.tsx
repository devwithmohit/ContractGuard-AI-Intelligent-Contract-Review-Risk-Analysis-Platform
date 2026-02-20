/**
 * LandingPage.tsx
 *
 * Public marketing landing page at `/`.
 *
 * Sections:
 *   1. Hero — headline, subheadline, CTA
 *   2. Problem — pain points
 *   3. Features — 6-column grid
 *   4. Pricing — Free / Pro / Enterprise cards
 *   5. Footer
 *
 * Uses the same dark theme + brand palette as the rest of the app.
 */
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ShieldCheck,
    Brain,
    Gauge,
    Search,
    FileText,
    Bell,
    ClipboardList,
    ArrowRight,
    Check,
    AlertTriangle,
    Clock,
    DollarSign,
    Sparkles,
} from 'lucide-react';

// ─── Animations ───────────────────────────────────────────────

const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
    }),
};

const stagger = {
    visible: { transition: { staggerChildren: 0.08 } },
};

// ─── Data ─────────────────────────────────────────────────────

const PROBLEMS = [
    {
        icon: AlertTriangle,
        title: 'Hidden Contract Risks',
        desc: 'Critical clauses buried in dense legal language go unnoticed until it\'s too late.',
    },
    {
        icon: Clock,
        title: 'Manual Review Bottlenecks',
        desc: 'Legal teams spend countless hours reading contracts that AI could analyze in seconds.',
    },
    {
        icon: DollarSign,
        title: 'Expensive Legal Fees',
        desc: 'Outsourcing routine contract reviews costs thousands per engagement.',
    },
];

const FEATURES = [
    {
        icon: Brain,
        title: 'AI Contract Analysis',
        desc: 'Upload any contract and get a comprehensive risk report powered by advanced LLMs.',
        color: 'text-brand-400',
        bg: 'bg-brand-500/10',
    },
    {
        icon: Gauge,
        title: 'Risk Scoring (0–100)',
        desc: 'Instant numeric risk score with visual breakdown across liability, termination, and IP.',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
    },
    {
        icon: Search,
        title: 'Semantic Search',
        desc: 'Search across all contracts using natural language — find clauses by meaning, not keywords.',
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
    },
    {
        icon: FileText,
        title: 'Key Clause Extraction',
        desc: 'Automatically identify and tag critical clauses — indemnity, non‑compete, auto‑renewal, and more.',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
    },
    {
        icon: Bell,
        title: 'Renewal Alerts',
        desc: 'Never miss a deadline. Get email and Slack alerts before contracts auto‑renew or expire.',
        color: 'text-rose-400',
        bg: 'bg-rose-500/10',
    },
    {
        icon: ClipboardList,
        title: 'Executive Summaries',
        desc: 'One-page plain-English summaries so stakeholders understand key terms without reading the full contract.',
        color: 'text-violet-400',
        bg: 'bg-violet-500/10',
    },
];

interface PricingTier {
    name: string;
    price: string;
    period: string;
    desc: string;
    features: string[];
    cta: string;
    highlighted?: boolean;
}

const PRICING: PricingTier[] = [
    {
        name: 'Free',
        price: '$0',
        period: '/month',
        desc: 'For individuals exploring AI contract analysis.',
        features: [
            '5 contracts per month',
            'Basic risk analysis',
            'Clause extraction',
            'Executive summaries',
            'Email alerts',
        ],
        cta: 'Get Started Free',
    },
    {
        name: 'Pro',
        price: '$49',
        period: '/month',
        desc: 'For growing teams that review contracts regularly.',
        features: [
            '50 contracts per month',
            'Advanced risk scoring',
            'Semantic search',
            'Team members (up to 5)',
            'Priority support',
            'Slack integration',
        ],
        cta: 'Start Pro Trial',
        highlighted: true,
    },
    {
        name: 'Enterprise',
        price: '$199',
        period: '/month',
        desc: 'For organizations with high-volume contract workflows.',
        features: [
            'Unlimited contracts',
            'Custom AI training',
            'API access',
            'Unlimited team members',
            'SSO & RBAC',
            'Dedicated support',
        ],
        cta: 'Contact Sales',
    },
];

// ─── Component ────────────────────────────────────────────────

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-dvh bg-surface text-content-primary font-sans antialiased">
            {/* ── Navbar ───────────────────────────────────── */}
            <nav className="sticky top-0 z-50 border-b border-surface-border/60 bg-surface/80 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-sm">
                            <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2} />
                        </div>
                        <span className="text-lg font-bold tracking-tight">
                            ContractGuard <span className="text-brand-400">AI</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/auth/login')}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-content-secondary hover:text-content-primary transition-colors"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => navigate('/auth/login')}
                            className="rounded-lg bg-gradient-brand px-5 py-2 text-sm font-semibold text-white shadow-glow-sm hover:opacity-90 transition-opacity"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* ── Hero ─────────────────────────────────────── */}
            <section className="relative overflow-hidden">
                {/* Background orbs */}
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                    <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-brand-600/15 blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-indigo-800/10 blur-3xl" />
                    <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/5 blur-2xl" />
                </div>

                <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-20 text-center lg:pt-32 lg:pb-32">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={stagger}
                    >
                        {/* Badge */}
                        <motion.div variants={fadeUp} custom={0} className="mb-6 flex justify-center">
                            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-300">
                                <Sparkles className="h-3.5 w-3.5" />
                                AI-Powered Contract Intelligence
                            </span>
                        </motion.div>

                        {/* Headline */}
                        <motion.h1
                            variants={fadeUp}
                            custom={1}
                            className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
                        >
                            AI-Powered Contract Review{' '}
                            <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
                                for Modern Businesses
                            </span>
                        </motion.h1>

                        {/* Subheadline */}
                        <motion.p
                            variants={fadeUp}
                            custom={2}
                            className="mx-auto mt-6 max-w-2xl text-lg text-content-secondary leading-relaxed sm:text-xl"
                        >
                            Spot hidden risks, avoid auto-renewal traps, and save thousands in legal
                            fees — all in seconds, not hours.
                        </motion.p>

                        {/* CTA */}
                        <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                            <button
                                onClick={() => navigate('/auth/login')}
                                className="group flex items-center gap-2 rounded-xl bg-gradient-brand px-8 py-3.5 text-base font-semibold text-white shadow-glow hover:opacity-90 transition-all"
                            >
                                Get Started
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </button>
                            <a
                                href="#features"
                                className="rounded-xl border border-surface-border px-8 py-3.5 text-base font-medium text-content-secondary hover:border-brand-500/40 hover:text-content-primary transition-colors"
                            >
                                See Features
                            </a>
                        </motion.div>

                        {/* Social proof */}
                        <motion.p variants={fadeUp} custom={4} className="mt-8 text-sm text-content-muted">
                            Trusted by startups and SMBs to review contracts faster &amp; safer.
                        </motion.p>
                    </motion.div>

                    {/* Dashboard preview card */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }}
                        className="mx-auto mt-16 max-w-4xl"
                    >
                        <div className="rounded-2xl border border-surface-border bg-surface-card/80 p-6 shadow-card backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-3 w-3 rounded-full bg-red-500/70" />
                                <div className="h-3 w-3 rounded-full bg-amber-500/70" />
                                <div className="h-3 w-3 rounded-full bg-green-500/70" />
                                <span className="ml-3 text-xs text-content-muted font-mono">ContractGuard AI — Dashboard</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {/* Stat cards */}
                                {[
                                    { label: 'Contracts Analyzed', value: '1,284', color: 'text-brand-400' },
                                    { label: 'Risks Identified', value: '347', color: 'text-amber-400' },
                                    { label: 'Hours Saved', value: '2,100+', color: 'text-emerald-400' },
                                ].map((s) => (
                                    <div key={s.label} className="rounded-xl bg-surface-elevated/60 border border-surface-border p-4 text-left">
                                        <p className="text-2xs text-content-muted uppercase tracking-wider">{s.label}</p>
                                        <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
                                    </div>
                                ))}
                            </div>
                            {/* Fake contract row */}
                            <div className="mt-4 rounded-xl bg-surface-elevated/40 border border-surface-border p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-brand-400" />
                                    <div>
                                        <p className="text-sm font-medium">SaaS Vendor Agreement – Acme Corp</p>
                                        <p className="text-2xs text-content-muted">Analyzed 2 min ago • 12 clauses extracted</p>
                                    </div>
                                </div>
                                <span className="rounded-lg bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">Risk: 67</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Problem Section ──────────────────────────── */}
            <section className="border-y border-surface-border/40 bg-surface-card/30">
                <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        variants={stagger}
                        className="text-center"
                    >
                        <motion.p variants={fadeUp} custom={0} className="text-sm font-semibold uppercase tracking-widest text-brand-400">
                            The Problem
                        </motion.p>
                        <motion.h2 variants={fadeUp} custom={1} className="mt-3 text-3xl font-bold sm:text-4xl">
                            Contracts are risky. Manual review is slow.
                        </motion.h2>
                        <motion.p variants={fadeUp} custom={2} className="mx-auto mt-4 max-w-2xl text-content-secondary">
                            Most businesses discover unfavorable terms, auto-renewals, or hidden liabilities only after they've signed — or worse, after they've cost real money.
                        </motion.p>
                    </motion.div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-40px' }}
                        variants={stagger}
                        className="mt-14 grid gap-6 sm:grid-cols-3"
                    >
                        {PROBLEMS.map((p, i) => (
                            <motion.div
                                key={p.title}
                                variants={fadeUp}
                                custom={i}
                                className="rounded-2xl border border-surface-border bg-surface-card/60 p-6 text-center"
                            >
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10">
                                    <p.icon className="h-6 w-6 text-rose-400" />
                                </div>
                                <h3 className="text-lg font-semibold">{p.title}</h3>
                                <p className="mt-2 text-sm text-content-secondary leading-relaxed">{p.desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── Features Grid ────────────────────────────── */}
            <section id="features" className="scroll-mt-20">
                <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        variants={stagger}
                        className="text-center"
                    >
                        <motion.p variants={fadeUp} custom={0} className="text-sm font-semibold uppercase tracking-widest text-brand-400">
                            Features
                        </motion.p>
                        <motion.h2 variants={fadeUp} custom={1} className="mt-3 text-3xl font-bold sm:text-4xl">
                            Everything you need to review contracts with confidence
                        </motion.h2>
                    </motion.div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-40px' }}
                        variants={stagger}
                        className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {FEATURES.map((f, i) => (
                            <motion.div
                                key={f.title}
                                variants={fadeUp}
                                custom={i}
                                className="group rounded-2xl border border-surface-border bg-surface-card/50 p-6 transition-colors hover:border-brand-500/30"
                            >
                                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${f.bg}`}>
                                    <f.icon className={`h-5 w-5 ${f.color}`} />
                                </div>
                                <h3 className="text-lg font-semibold">{f.title}</h3>
                                <p className="mt-2 text-sm text-content-secondary leading-relaxed">{f.desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── Pricing ──────────────────────────────────── */}
            <section id="pricing" className="border-t border-surface-border/40 bg-surface-card/20 scroll-mt-20">
                <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        variants={stagger}
                        className="text-center"
                    >
                        <motion.p variants={fadeUp} custom={0} className="text-sm font-semibold uppercase tracking-widest text-brand-400">
                            Pricing
                        </motion.p>
                        <motion.h2 variants={fadeUp} custom={1} className="mt-3 text-3xl font-bold sm:text-4xl">
                            Simple, transparent pricing
                        </motion.h2>
                        <motion.p variants={fadeUp} custom={2} className="mx-auto mt-4 max-w-xl text-content-secondary">
                            Start free, upgrade as you grow. No hidden fees. Cancel anytime.
                        </motion.p>
                    </motion.div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-40px' }}
                        variants={stagger}
                        className="mt-14 grid gap-6 sm:grid-cols-3"
                    >
                        {PRICING.map((tier, i) => (
                            <motion.div
                                key={tier.name}
                                variants={fadeUp}
                                custom={i}
                                className={`relative flex flex-col rounded-2xl border p-8 transition-colors ${
                                    tier.highlighted
                                        ? 'border-brand-500/50 bg-surface-card shadow-glow'
                                        : 'border-surface-border bg-surface-card/40 hover:border-surface-muted'
                                }`}
                            >
                                {tier.highlighted && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-4 py-1 text-xs font-semibold text-white shadow-glow-sm">
                                        Most Popular
                                    </span>
                                )}

                                <h3 className="text-lg font-semibold">{tier.name}</h3>
                                <div className="mt-4 flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold">{tier.price}</span>
                                    <span className="text-content-muted text-sm">{tier.period}</span>
                                </div>
                                <p className="mt-3 text-sm text-content-secondary">{tier.desc}</p>

                                <ul className="mt-8 flex-1 space-y-3">
                                    {tier.features.map((f) => (
                                        <li key={f} className="flex items-start gap-2.5 text-sm">
                                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                                            <span className="text-content-secondary">{f}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => navigate('/auth/login')}
                                    className={`mt-8 w-full rounded-xl py-3 text-sm font-semibold transition-all ${
                                        tier.highlighted
                                            ? 'bg-gradient-brand text-white shadow-glow-sm hover:opacity-90'
                                            : 'border border-surface-border text-content-primary hover:border-brand-500/40 hover:text-brand-400'
                                    }`}
                                >
                                    {tier.cta}
                                </button>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── Footer ───────────────────────────────────── */}
            <footer className="border-t border-surface-border/40">
                <div className="mx-auto max-w-6xl px-6 py-12">
                    <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
                                <ShieldCheck className="h-4 w-4 text-white" strokeWidth={2} />
                            </div>
                            <span className="text-sm font-bold tracking-tight">
                                ContractGuard <span className="text-brand-400">AI</span>
                            </span>
                        </div>

                        {/* Links */}
                        <div className="flex gap-8 text-sm text-content-muted">
                            <a href="#features" className="hover:text-content-primary transition-colors">Features</a>
                            <a href="#pricing" className="hover:text-content-primary transition-colors">Pricing</a>
                            <button onClick={() => navigate('/auth/login')} className="hover:text-content-primary transition-colors">Sign In</button>
                        </div>

                        {/* Copyright */}
                        <p className="text-xs text-content-muted">
                            &copy; {new Date().getFullYear()} ContractGuard AI. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
