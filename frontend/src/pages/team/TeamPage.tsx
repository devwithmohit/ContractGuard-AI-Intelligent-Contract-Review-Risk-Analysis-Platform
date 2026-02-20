/**
 * TeamPage.tsx
 *
 * Team management page — view org members, roles, and invitations.
 * Phase 7 of the workflow guide: Team Collaboration.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Users,
    UserPlus,
    Crown,
    Shield,
    User,
    Mail,
    Copy,
    CheckCircle2,
} from 'lucide-react';
import { useAuthContext } from '@/app/providers';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Role display config ──────────────────────────────────────

const ROLE_CONFIG = {
    owner: {
        label: 'Owner',
        icon: Crown,
        color: 'text-amber-400 bg-amber-500/10 ring-amber-500/30',
    },
    admin: {
        label: 'Admin',
        icon: Shield,
        color: 'text-brand-400 bg-brand-500/10 ring-brand-500/30',
    },
    member: {
        label: 'Member',
        icon: User,
        color: 'text-gray-400 bg-gray-500/10 ring-gray-500/30',
    },
} as const;

// ─── Component ────────────────────────────────────────────────

export default function TeamPage() {
    const { user, profile } = useAuthContext();
    const [inviteEmail, setInviteEmail] = useState('');

    const currentRole = profile?.role ?? 'member';
    const roleConfig = ROLE_CONFIG[currentRole as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.member;
    const RoleIcon = roleConfig.icon;

    function handleCopyOrgId() {
        if (profile?.orgId) {
            navigator.clipboard.writeText(profile.orgId);
            toast.success('Organization ID copied to clipboard');
        }
    }

    function handleInvite(e: React.FormEvent) {
        e.preventDefault();
        // Placeholder — team invitation will be implemented with email service
        toast.success(`Invitation will be sent to ${inviteEmail} (coming soon)`);
        setInviteEmail('');
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-content-primary flex items-center gap-3">
                    <Users className="h-6 w-6 text-brand-400" />
                    Team
                </h1>
                <p className="mt-1 text-sm text-content-secondary">
                    Manage your organization's team members and roles.
                </p>
            </div>

            {/* Org info card */}
            <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-content-primary">
                        {profile?.orgName ?? 'My Organization'}
                    </h2>
                    <button
                        onClick={handleCopyOrgId}
                        className="flex items-center gap-1.5 text-xs text-content-muted hover:text-content-secondary transition-colors"
                        title="Copy organization ID"
                    >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Org ID
                    </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-surface-border bg-surface-elevated p-4 text-center">
                        <p className="text-2xl font-bold text-content-primary">1</p>
                        <p className="text-xs text-content-muted mt-1">Total Members</p>
                    </div>
                    <div className="rounded-xl border border-surface-border bg-surface-elevated p-4 text-center">
                        <p className="text-2xl font-bold text-content-primary capitalize">{profile?.tier ?? 'free'}</p>
                        <p className="text-xs text-content-muted mt-1">Plan</p>
                    </div>
                    <div className="rounded-xl border border-surface-border bg-surface-elevated p-4 text-center">
                        <p className="text-2xl font-bold text-content-primary capitalize">{currentRole}</p>
                        <p className="text-xs text-content-muted mt-1">Your Role</p>
                    </div>
                </div>
            </div>

            {/* Current members */}
            <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
                <h2 className="text-lg font-semibold text-content-primary mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-content-muted" />
                    Members
                </h2>

                {/* Current user — always shown */}
                <div className="flex items-center gap-4 rounded-xl border border-surface-border bg-surface-elevated p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600/30 text-brand-400 text-sm font-semibold">
                        {user?.email ? user.email[0]?.toUpperCase() : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-content-primary truncate">
                            {user?.email ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-content-muted">You</p>
                    </div>
                    <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1',
                        roleConfig.color,
                    )}>
                        <RoleIcon className="h-3 w-3" />
                        {roleConfig.label}
                    </span>
                </div>
            </div>

            {/* Invite members */}
            {(currentRole === 'owner' || currentRole === 'admin') && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-surface-border bg-surface-card p-6"
                >
                    <h2 className="text-lg font-semibold text-content-primary mb-4 flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-content-muted" />
                        Invite Team Members
                    </h2>

                    <form onSubmit={handleInvite} className="flex gap-3">
                        <div className="relative flex-1">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-content-muted" />
                            <input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="colleague@company.com"
                                className="input w-full pl-10"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!inviteEmail.trim()}
                            className="btn-primary shrink-0"
                        >
                            <UserPlus className="h-4 w-4 mr-1.5" />
                            Send Invite
                        </button>
                    </form>

                    <p className="mt-3 text-xs text-content-muted">
                        Team members will receive an email invitation to join your organization.
                    </p>
                </motion.div>
            )}

            {/* Permissions info */}
            <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
                <h2 className="text-lg font-semibold text-content-primary mb-4">
                    Role Permissions
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                    {Object.entries(ROLE_CONFIG).map(([key, config]) => {
                        const Icon = config.icon;
                        return (
                            <div key={key} className="rounded-xl border border-surface-border bg-surface-elevated p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1', config.color)}>
                                        <Icon className="h-3 w-3" />
                                        {config.label}
                                    </span>
                                </div>
                                <ul className="space-y-1.5 text-xs text-content-secondary">
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3 w-3 text-green-400" />
                                        View all contracts
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3 w-3 text-green-400" />
                                        Upload & analyze
                                    </li>
                                    {(key === 'admin' || key === 'owner') && (
                                        <li className="flex items-center gap-1.5">
                                            <CheckCircle2 className="h-3 w-3 text-green-400" />
                                            Manage team
                                        </li>
                                    )}
                                    {key === 'owner' && (
                                        <li className="flex items-center gap-1.5">
                                            <CheckCircle2 className="h-3 w-3 text-green-400" />
                                            Billing & settings
                                        </li>
                                    )}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
