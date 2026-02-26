/**
 * providers.tsx
 *
 * Composes all React context providers in the correct nesting order:
 *
 *   QueryClientProvider  ← TanStack Query (global cache)
 *     AuthProvider        ← Supabase session + user context
 *       Toaster           ← react-hot-toast (outside router so toasts work on auth errors too)
 *         {children}
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ─── QueryClient (singleton) ──────────────────────────────────

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is fresh for 60s — avoids redundant refetches on nav
            staleTime: 60 * 1000,
            // Keep unused data in cache for 5 min
            gcTime: 5 * 60 * 1000,
            // Don't retry on 4xx — only on network/5xx
            retry: (failureCount, error: unknown) => {
                const status = (error as { status?: number })?.status;
                if (status && status >= 400 && status < 500) return false;
                return failureCount < 2;
            },
            // Refetch when window regains focus (catches stale data after tab switch)
            refetchOnWindowFocus: true,
        },
        mutations: {
            // Don't retry mutations — we don't want duplicate side-effects
            retry: false,
        },
    },
});

// ─── Auth Context ─────────────────────────────────────────────

export interface UserProfile {
    id: string;
    email: string;
    orgId: string | null;
    orgName: string | null;
    role: string | null;
    tier: string | null;
}

interface AuthContextValue {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
});

export function useAuthContext(): AuthContextValue {
    return useContext(AuthContext);
}

/**
 * Call POST /api/v1/auth/setup after login.
 * Creates org for new users; returns profile for existing users.
 * Idempotent and safe to call on every session change.
 */
async function setupUser(accessToken: string): Promise<UserProfile | null> {
    try {
        const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
        const response = await fetch(`${baseUrl}/api/v1/auth/setup`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: '{}',
        });

        if (!response.ok) return null;

        const data = await response.json() as { user: UserProfile };
        return data.user;
    } catch {
        return null;
    }
}

function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load existing session on mount (no network call — reads from localStorage)
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.access_token) {
                setupUser(session.access_token).then((p) => {
                    setProfile(p);
                    setIsLoading(false);
                });
            } else {
                setIsLoading(false);
            }
        });

        // Subscribe to auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);

                if (session?.access_token) {
                    setupUser(session.access_token).then((p) => {
                        setProfile(p);
                        setIsLoading(false);
                    });
                } else {
                    setProfile(null);
                    setIsLoading(false);
                    // When user logs out, clear all TanStack Query cache so no
                    // stale data from the previous user persists
                    queryClient.clear();
                }
            },
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{
            session,
            user: session?.user ?? null,
            profile,
            isLoading,
            isAuthenticated: !!session,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Root Providers ───────────────────────────────────────────

export function Providers({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                {/* Toast notifications — positioned top-right, dark styled */}
                <Toaster
                    position="top-right"
                    gutter={8}
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: '#1e1e35',
                            color: '#f1f0ff',
                            border: '1px solid #2a2a45',
                            borderRadius: '12px',
                            fontSize: '14px',
                            maxWidth: '420px',
                        },
                        success: {
                            iconTheme: { primary: '#22c55e', secondary: '#1e1e35' },
                        },
                        error: {
                            iconTheme: { primary: '#ef4444', secondary: '#1e1e35' },
                            duration: 6000,
                        },
                    }}
                />

                {children}
            </AuthProvider>

            {/* Query devtools — only in development */}
            {import.meta.env.DEV && (
                <ReactQueryDevtools
                    initialIsOpen={false}
                    buttonPosition="bottom-left"
                />
            )}
        </QueryClientProvider>
    );
}

export { queryClient };
