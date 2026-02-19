/**
 * Sidebar.tsx
 *
 * Primary navigation sidebar.
 *
 * Desktop: fixed 256px wide, always visible.
 * Mobile:  slides in from left as an overlay (controlled by AppShell).
 */
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    FileText,
    Search,
    Bell,
    Upload,
    ShieldCheck,
    LogOut,
    X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/app/providers';
import { cn, initials } from '@/lib/utils';
import NotificationBell from './NotificationBell';
import toast from 'react-hot-toast';

// ─── Nav items ────────────────────────────────────────────────

const NAV_ITEMS = [
    {
        label: 'Dashboard',
        to: '/dashboard',
        icon: LayoutDashboard,
        id: 'nav-dashboard',
    },
    {
        label: 'Contracts',
        to: '/contracts',
        icon: FileText,
        id: 'nav-contracts',
    },
    {
        label: 'Upload',
        to: '/contracts/upload',
        icon: Upload,
        id: 'nav-upload',
    },
    {
        label: 'Search',
        to: '/search',
        icon: Search,
        id: 'nav-search',
    },
    {
        label: 'Alerts',
        to: '/alerts',
        icon: Bell,
        id: 'nav-alerts',
    },
] as const;

// ─── Types ────────────────────────────────────────────────────

interface SidebarProps {
    open: boolean;
    onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────

export default function Sidebar({ open, onClose }: SidebarProps) {
    const { user } = useAuthContext();
    const navigate = useNavigate();

    async function handleSignOut() {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error('Sign-out failed. Please try again.');
        } else {
            navigate('/auth/login');
        }
    }

    const sidebarContent = (
        <aside
            id="app-sidebar"
            className={cn(
                // Base
                'flex h-full w-64 flex-col bg-surface-card border-r border-surface-border',
                // Desktop: static in layout flow
                'lg:relative lg:translate-x-0',
            )}
            aria-label="Main navigation"
        >
            {/* ── Logo ─────────────────────────────────────── */}
            <div className="flex h-16 items-center gap-3 px-5 border-b border-surface-border shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-sm">
                    <ShieldCheck className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-content-primary leading-none">
                        ContractGuard
                    </p>
                    <p className="text-[10px] text-content-muted mt-0.5 tracking-wide uppercase">
                        AI
                    </p>
                </div>

                {/* Mobile close button */}
                <button
                    type="button"
                    id="sidebar-close-btn"
                    onClick={onClose}
                    className="ml-auto btn-ghost p-1.5 lg:hidden"
                    aria-label="Close sidebar"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* ── Nav links ────────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
                {NAV_ITEMS.map(({ label, to, icon: Icon, id }) => (
                    <NavLink
                        key={to}
                        to={to}
                        id={id}
                        end={to === '/dashboard'}
                        onClick={onClose}
                        className={({ isActive }) =>
                            cn(
                                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                                'transition-all duration-150 group',
                                isActive
                                    ? 'bg-brand-500/15 text-brand-400 shadow-glow-sm'
                                    : 'text-content-secondary hover:bg-surface-elevated hover:text-content-primary',
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <Icon
                                    className={cn(
                                        'h-4 w-4 shrink-0 transition-colors',
                                        isActive ? 'text-brand-400' : 'text-content-muted group-hover:text-content-secondary',
                                    )}
                                    strokeWidth={isActive ? 2.5 : 1.75}
                                />
                                <span>{label}</span>

                                {/* Active indicator dot */}
                                {isActive && (
                                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-400" />
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* ── User footer ──────────────────────────────── */}
            <div className="shrink-0 border-t border-surface-border p-3">
                {/* Notification bell */}
                <div className="mb-2">
                    <NotificationBell />
                </div>

                {/* User info + sign out */}
                <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-elevated transition-colors">
                    {/* Avatar */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600/30 text-brand-400 text-xs font-semibold">
                        {user?.email ? initials(user.email.split('@')[0]!) : '?'}
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-content-primary truncate">
                            {user?.email?.split('@')[0] ?? 'User'}
                        </p>
                        <p className="text-[10px] text-content-muted truncate">
                            {user?.email ?? ''}
                        </p>
                    </div>

                    <button
                        type="button"
                        id="sidebar-signout-btn"
                        onClick={handleSignOut}
                        className="btn-ghost p-1.5 shrink-0 text-content-muted hover:text-red-400"
                        title="Sign out"
                        aria-label="Sign out"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );

    return (
        <>
            {/* Desktop — always visible, part of layout flow */}
            <div className="hidden lg:flex lg:shrink-0">
                {sidebarContent}
            </div>

            {/* Mobile — slide-in overlay */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="mobile-sidebar"
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
                        className="fixed inset-y-0 left-0 z-30 lg:hidden"
                    >
                        {sidebarContent}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
