/**
 * SettingsPage.tsx
 *
 * User and organization settings page.
 * Allows users to view their profile, org info, and manage preferences.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Settings,
    User,
    Building2,
    CreditCard,
    Shield,
    Mail,
    Crown,
    CheckCircle2,
} from 'lucide-react';
import { useAuthContext } from '@/app/providers';
import { cn } from '@/lib/utils';

// ─── Tab types ────────────────────────────────────────────────

type SettingsTab = 'profile' | 'organization' | 'billing';

const TABS = [
    { key: 'profile' as const, label: 'Profile', icon: User },
    { key: 'organization' as const, label: 'Organization', icon: Building2 },
    { key: 'billing' as const, label: 'Billing', icon: CreditCard },
] as const;

// ─── Tier badge component ─────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
    const config = {
        free: { label: 'Free', color: 'bg-gray-500/15 text-gray-400 ring-gray-500/30' },
        starter: { label: 'Starter', color: 'bg-blue-500/15 text-blue-400 ring-blue-500/30' },
        pro: { label: 'Pro', color: 'bg-brand-500/15 text-brand-400 ring-brand-500/30' },
        enterprise: { label: 'Enterprise', color: 'bg-amber-500/15 text-amber-400 ring-amber-500/30' },
    }[tier.toLowerCase()] ?? { label: tier, color: 'bg-gray-500/15 text-gray-400 ring-gray-500/30' };

    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1', config.color)}>
            <Crown className="h-3 w-3" />
            {config.label}
        </span>
    );
}

// ─── Component ────────────────────────────────────────────────

export default function SettingsPage() {
    const { user, profile } = useAuthContext();
    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-content-primary flex items-center gap-3">
                    <Settings className="h-6 w-6 text-brand-400" />
                    Settings
                </h1>
                <p className="mt-1 text-sm text-content-secondary">
                    Manage your account and organization preferences.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl border border-surface-border bg-surface-elevated p-1">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={cn(
                            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150',
                            activeTab === key
                                ? 'bg-surface-card text-content-primary shadow-sm'
                                : 'text-content-muted hover:text-content-secondary',
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
            >
                {activeTab === 'profile' && (
                    <div className="rounded-2xl border border-surface-border bg-surface-card p-6 space-y-6">
                        <h2 className="text-lg font-semibold text-content-primary flex items-center gap-2">
                            <User className="h-5 w-5 text-content-muted" />
                            Profile Information
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                                    Email Address
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-4 py-2.5">
                                    <Mail className="h-4 w-4 text-content-muted" />
                                    <span className="text-sm text-content-primary">
                                        {user?.email ?? '—'}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                                    User ID
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-4 py-2.5">
                                    <Shield className="h-4 w-4 text-content-muted" />
                                    <span className="text-sm text-content-primary font-mono truncate">
                                        {user?.id?.slice(0, 8) ?? '—'}…
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                                    Role
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-4 py-2.5">
                                    <Crown className="h-4 w-4 text-content-muted" />
                                    <span className="text-sm text-content-primary capitalize">
                                        {profile?.role ?? 'Member'}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                                    Auth Provider
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-4 py-2.5">
                                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                                    <span className="text-sm text-content-primary capitalize">
                                        {user?.app_metadata?.provider ?? 'email'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'organization' && (
                    <div className="rounded-2xl border border-surface-border bg-surface-card p-6 space-y-6">
                        <h2 className="text-lg font-semibold text-content-primary flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-content-muted" />
                            Organization
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                                    Organization Name
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-4 py-2.5">
                                    <Building2 className="h-4 w-4 text-content-muted" />
                                    <span className="text-sm text-content-primary">
                                        {profile?.orgName ?? '—'}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                                    Subscription Tier
                                </label>
                                <div className="pt-1">
                                    <TierBadge tier={profile?.tier ?? 'free'} />
                                </div>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                                    Organization ID
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-4 py-2.5">
                                    <Shield className="h-4 w-4 text-content-muted" />
                                    <span className="text-sm text-content-primary font-mono">
                                        {profile?.orgId ?? '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'billing' && (
                    <div className="rounded-2xl border border-surface-border bg-surface-card p-6 space-y-6">
                        <h2 className="text-lg font-semibold text-content-primary flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-content-muted" />
                            Billing & Subscription
                        </h2>

                        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-sm font-semibold text-content-primary">
                                        Current Plan
                                    </p>
                                    <p className="text-xs text-content-secondary mt-0.5">
                                        Your organization is on the{' '}
                                        <span className="font-medium text-brand-400 capitalize">
                                            {profile?.tier ?? 'free'}
                                        </span>{' '}
                                        plan.
                                    </p>
                                </div>
                                <TierBadge tier={profile?.tier ?? 'free'} />
                            </div>

                            <div className="h-px bg-surface-border my-4" />

                            <div className="text-xs text-content-muted">
                                <p className="mb-2">Plan limits:</p>
                                <ul className="space-y-1">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                        {profile?.tier === 'enterprise' ? 'Unlimited' :
                                            profile?.tier === 'pro' ? '50' : '5'} contracts
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                        AI-powered risk analysis
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                        Semantic search across all contracts
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                        Automated expiration alerts
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <p className="text-xs text-content-muted italic">
                            Stripe billing integration coming soon. Contact support to upgrade your plan.
                        </p>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
