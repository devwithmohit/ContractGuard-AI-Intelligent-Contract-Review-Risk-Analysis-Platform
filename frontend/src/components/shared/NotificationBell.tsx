/**
 * NotificationBell.tsx
 *
 * Shows the unread alert count as a badge on a bell icon.
 * Subscribes to Supabase Realtime Postgres Changes so the count
 * updates live when new alerts are inserted.
 *
 * Clicking navigates to /alerts.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/app/providers';
import { cn } from '@/lib/utils';

export default function NotificationBell() {
    const { user, isAuthenticated } = useAuthContext();
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);

    // ── Fetch initial unread count ─────────────────────────────
    useEffect(() => {
        if (!isAuthenticated || !user) return;

        // We'll drive the count from the X-Unread-Count header returned by
        // GET /api/v1/alerts. For now fetch with minimal params.
        async function fetchUnread() {
            try {
                const res = await fetch('/api/v1/alerts?is_read=false&limit=1', {
                    headers: {
                        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
                    },
                });
                if (res.ok) {
                    const count = res.headers.get('X-Unread-Count');
                    setUnreadCount(count ? parseInt(count, 10) : 0);
                }
            } catch {
                // Silently fail — badge is non-critical
            }
        }

        void fetchUnread();
    }, [isAuthenticated, user]);

    // ── Realtime subscription ──────────────────────────────────
    useEffect(() => {
        if (!isAuthenticated || !user) return;

        const channel = supabase
            .channel('alerts-badge')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'alerts',
                    // Filter to current user's org — requires RLS to be set up
                },
                (_payload) => {
                    // Increment optimistically; background fetch will correct if needed
                    setUnreadCount((prev) => prev + 1);
                },
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'alerts',
                },
                (_payload) => {
                    // When an alert is marked read/snoozed, decrement the count.
                    // A full refetch would be more accurate but adds latency.
                    setUnreadCount((prev) => Math.max(0, prev - 1));
                },
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [isAuthenticated, user]);

    const hasUnread = unreadCount > 0;
    const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);

    return (
        <button
            type="button"
            id="notification-bell-btn"
            onClick={() => navigate('/alerts')}
            className={cn(
                'relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5',
                'text-sm font-medium transition-all duration-150',
                hasUnread
                    ? 'text-brand-400 hover:bg-brand-500/10'
                    : 'text-content-secondary hover:bg-surface-elevated hover:text-content-primary',
            )}
            aria-label={
                hasUnread
                    ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}`
                    : 'No unread alerts'
            }
        >
            <div className="relative shrink-0">
                <Bell
                    className={cn(
                        'h-4 w-4 transition-colors',
                        hasUnread ? 'text-brand-400' : 'text-content-muted',
                    )}
                    strokeWidth={hasUnread ? 2.5 : 1.75}
                />

                {/* Unread badge */}
                {hasUnread && (
                    <span
                        className={cn(
                            'absolute -right-2 -top-2 flex min-w-[18px] items-center justify-center',
                            'rounded-full bg-red-500 px-1 py-px',
                            'text-[9px] font-bold text-white leading-none',
                            'shadow-glow-red ring-1 ring-surface-card',
                            'animate-fade-in',
                        )}
                        aria-hidden="true"
                    >
                        {displayCount}
                    </span>
                )}
            </div>

            <span>Alerts</span>

            {/* Pulse ring for new alerts */}
            {hasUnread && (
                <span className="ml-auto flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
            )}
        </button>
    );
}
