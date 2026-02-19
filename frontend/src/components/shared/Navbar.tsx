/**
 * Navbar.tsx
 *
 * Top navigation bar — always visible inside the authenticated shell.
 *
 * Contains:
 *  - Hamburger menu button (mobile only)
 *  - Page title (dynamic, derived from current route)
 *  - Search shortcut button (⌘K / Ctrl+K → navigates to /search)
 *  - Notification bell (desktop duplicate — also in sidebar footer)
 *  - User avatar dropdown
 */
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useEffect, useCallback } from 'react';
import { Menu, Search, ChevronRight } from 'lucide-react';
import { useAuthContext } from '@/app/providers';
import { cn, initials } from '@/lib/utils';
import NotificationBell from './NotificationBell';

// ─── Route → title map ────────────────────────────────────────

function usePageTitle(): { title: string; breadcrumbs: Array<{ label: string; to?: string }> } {
    const { pathname } = useLocation();

    if (pathname === '/dashboard') {
        return { title: 'Dashboard', breadcrumbs: [{ label: 'Dashboard' }] };
    }
    if (pathname === '/contracts/upload') {
        return {
            title: 'Upload Contract',
            breadcrumbs: [
                { label: 'Contracts', to: '/contracts' },
                { label: 'Upload' },
            ],
        };
    }
    if (pathname.startsWith('/contracts/') && pathname !== '/contracts') {
        return {
            title: 'Contract Detail',
            breadcrumbs: [
                { label: 'Contracts', to: '/contracts' },
                { label: 'Detail' },
            ],
        };
    }
    if (pathname === '/contracts') {
        return { title: 'Contracts', breadcrumbs: [{ label: 'Contracts' }] };
    }
    if (pathname === '/search') {
        return { title: 'Semantic Search', breadcrumbs: [{ label: 'Search' }] };
    }
    if (pathname === '/alerts') {
        return { title: 'Alerts', breadcrumbs: [{ label: 'Alerts' }] };
    }

    return { title: 'ContractGuard', breadcrumbs: [] };
}

// ─── Types ────────────────────────────────────────────────────

interface NavbarProps {
    onMenuClick: () => void;
}

// ─── Component ────────────────────────────────────────────────

export default function Navbar({ onMenuClick }: NavbarProps) {
    const { user } = useAuthContext();
    const navigate = useNavigate();
    const { title, breadcrumbs } = usePageTitle();

    // ⌘K / Ctrl+K → navigate to search
    const handleSearchShortcut = useCallback(
        (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                navigate('/search');
            }
        },
        [navigate],
    );

    useEffect(() => {
        document.addEventListener('keydown', handleSearchShortcut);
        return () => document.removeEventListener('keydown', handleSearchShortcut);
    }, [handleSearchShortcut]);

    const userInitials = user?.email
        ? initials(user.email.split('@')[0]!)
        : '?';

    return (
        <header
            id="app-navbar"
            className="flex h-16 shrink-0 items-center gap-4 border-b border-surface-border bg-surface-card/80 backdrop-blur-sm px-4 lg:px-6"
        >
            {/* Mobile menu button */}
            <button
                type="button"
                id="navbar-menu-btn"
                onClick={onMenuClick}
                className="btn-ghost p-2 lg:hidden"
                aria-label="Open navigation menu"
                aria-controls="app-sidebar"
            >
                <Menu className="h-5 w-5" />
            </button>

            {/* Page title / breadcrumbs */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
                {breadcrumbs.length > 1 ? (
                    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
                        {breadcrumbs.map((crumb, i) => (
                            <span key={i} className="flex items-center gap-1.5">
                                {i > 0 && (
                                    <ChevronRight className="h-3.5 w-3.5 text-content-muted shrink-0" />
                                )}
                                {crumb.to ? (
                                    <Link
                                        to={crumb.to}
                                        className="text-content-secondary hover:text-content-primary transition-colors"
                                    >
                                        {crumb.label}
                                    </Link>
                                ) : (
                                    <span className="text-content-primary font-medium">
                                        {crumb.label}
                                    </span>
                                )}
                            </span>
                        ))}
                    </nav>
                ) : (
                    <h1 className="text-base font-semibold text-content-primary truncate">
                        {title}
                    </h1>
                )}
            </div>

            {/* Right-side actions */}
            <div className="flex shrink-0 items-center gap-2">
                {/* Search shortcut button */}
                <button
                    type="button"
                    id="navbar-search-btn"
                    onClick={() => navigate('/search')}
                    className={cn(
                        'hidden items-center gap-2 rounded-xl border border-surface-border',
                        'bg-surface-elevated px-3 py-1.5 text-sm text-content-muted',
                        'hover:border-brand-500/40 hover:text-content-secondary transition-all duration-150',
                        'sm:flex',
                    )}
                    aria-label="Open search (Ctrl+K)"
                >
                    <Search className="h-3.5 w-3.5" />
                    <span>Search</span>
                    <kbd className="ml-1 rounded border border-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-content-muted">
                        ⌘K
                    </kbd>
                </button>

                {/* Notification bell — hidden on mobile (shown in sidebar) */}
                <div className="hidden lg:block">
                    <NotificationBell />
                </div>

                {/* User avatar */}
                <div
                    id="navbar-user-avatar"
                    className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full',
                        'bg-brand-600/30 text-brand-400 text-xs font-semibold',
                        'ring-2 ring-transparent hover:ring-brand-500/50 transition-all cursor-pointer',
                    )}
                    title={user?.email ?? 'User'}
                    aria-label={`User: ${user?.email ?? 'Unknown'}`}
                >
                    {userInitials}
                </div>
            </div>
        </header>
    );
}
