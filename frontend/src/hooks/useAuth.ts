/**
 * useAuth.ts
 *
 * Thin facade over the AuthContext + Supabase auth methods.
 *
 * Provides:
 *  - session, user, isLoading, isAuthenticated  (from AuthContext)
 *  - signInWithPassword(email, password)
 *  - signInWithMagicLink(email)
 *  - signInWithGoogle()
 *  - signOut()
 *
 * Components should import from this hook — NOT call supabase.auth directly.
 * This keeps auth logic in one place and makes pages testable.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/app/providers';

// ─── Return type ──────────────────────────────────────────────

export interface UseAuthReturn {
    // State (from context)
    session: ReturnType<typeof useAuthContext>['session'];
    user: ReturnType<typeof useAuthContext>['user'];
    isLoading: boolean;
    isAuthenticated: boolean;

    // Actions (loading state per-action)
    isPending: boolean;
    signInWithPassword: (email: string, password: string) => Promise<void>;
    signInWithMagicLink: (email: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
    const { session, user, isLoading, isAuthenticated } = useAuthContext();
    const navigate = useNavigate();
    const [isPending, setIsPending] = useState(false);

    // ── Email + password ──────────────────────────────────────

    async function signInWithPassword(email: string, password: string): Promise<void> {
        setIsPending(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                // Surface friendly messages for common error codes
                if (error.message.includes('Invalid login credentials')) {
                    toast.error('Incorrect email or password.');
                } else if (error.message.includes('Email not confirmed')) {
                    toast.error('Please verify your email before signing in.');
                } else {
                    toast.error(error.message);
                }
                return;
            }

            // Session is set by onAuthStateChange in providers.tsx —
            // router AuthGuard will redirect once session is detected
            toast.success('Signed in successfully!');
            navigate('/dashboard', { replace: true });
        } catch {
            toast.error('An unexpected error occurred. Please try again.');
        } finally {
            setIsPending(false);
        }
    }

    // ── Magic link (passwordless) ─────────────────────────────

    async function signInWithMagicLink(email: string): Promise<void> {
        setIsPending(true);
        try {
            const redirectTo = `${window.location.origin}/auth/callback`;

            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: redirectTo,
                    shouldCreateUser: false, // Don't auto-create accounts from magic links
                },
            });

            if (error) {
                toast.error(error.message);
                return;
            }

            toast.success(`Magic link sent to ${email}. Check your inbox!`, {
                duration: 8000,
            });
        } catch {
            toast.error('Failed to send magic link. Please try again.');
        } finally {
            setIsPending(false);
        }
    }

    // ── Google OAuth ──────────────────────────────────────────

    async function signInWithGoogle(): Promise<void> {
        setIsPending(true);
        try {
            const redirectTo = `${window.location.origin}/auth/callback`;

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (error) {
                toast.error(error.message);
                setIsPending(false);
            }
            // On success, browser is redirected by Supabase — no further action needed
        } catch {
            toast.error('Google sign-in failed. Please try again.');
            setIsPending(false);
        }
    }

    // ── Sign out ──────────────────────────────────────────────

    async function signOut(): Promise<void> {
        setIsPending(true);
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                toast.error('Sign-out failed. Please try again.');
            } else {
                // Cache is cleared by providers.tsx onAuthStateChange
                navigate('/auth/login', { replace: true });
            }
        } catch {
            toast.error('An unexpected error occurred during sign-out.');
        } finally {
            setIsPending(false);
        }
    }

    return {
        session,
        user,
        isLoading,
        isAuthenticated,
        isPending,
        signInWithPassword,
        signInWithMagicLink,
        signInWithGoogle,
        signOut,
    };
}

export default useAuth;
