/**
 * CallbackPage.tsx
 *
 * Handles the post-authentication redirect from Supabase after:
 *  - OAuth (Google) — token is in the URL hash (#access_token=...)
 *  - Magic link     — token is in the URL query (?token=...&type=magiclink)
 *
 * Supabase detects the token in the URL automatically when
 * `detectSessionInUrl: true` (set in lib/supabase.ts).
 * We just need to wait for the SIGNED_IN event and redirect.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type CallbackState = 'loading' | 'success' | 'error';

export default function CallbackPage() {
    const navigate = useNavigate();
    const [state, setState] = useState<CallbackState>('loading');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        // Check for error in URL params (Supabase passes errors as query params)
        const params = new URLSearchParams(window.location.search);
        const urlError = params.get('error_description') ?? params.get('error');
        if (urlError) {
            setState('error');
            setErrorMessage(decodeURIComponent(urlError.replace(/\+/g, ' ')));
            return;
        }

        // Listen for auth state change — Supabase processes the token automatically
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') {
                setState('success');
                // Small delay so the user sees the success state
                setTimeout(() => navigate('/dashboard', { replace: true }), 800);
            }
            if (event === 'USER_UPDATED') {
                // Magic links trigger USER_UPDATED after SIGNED_IN
                setState('success');
                setTimeout(() => navigate('/dashboard', { replace: true }), 800);
            }
        });

        // Safety timeout — if nothing happens in 10s, show error
        const timeout = setTimeout(() => {
            setState((prev) => {
                if (prev === 'loading') {
                    setErrorMessage('Authentication timed out. Please try signing in again.');
                    return 'error';
                }
                return prev;
            });
        }, 10_000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, [navigate]);

    return (
        <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-surface px-4">
            {/* Animated logo mark */}
            <div className="relative flex h-16 w-16 items-center justify-center">
                <div
                    className={cn(
                        'absolute inset-0 rounded-2xl transition-colors duration-500',
                        state === 'error' ? 'bg-red-600/20' : 'bg-gradient-brand',
                        state === 'loading' && 'animate-pulse-slow',
                    )}
                />
                <div className="absolute inset-1 flex items-center justify-center rounded-xl bg-surface">
                    {state === 'error' ? (
                        <AlertCircle className="h-7 w-7 text-red-400 animate-fade-in" />
                    ) : (
                        <ShieldCheck
                            className={cn(
                                'h-7 w-7 transition-colors duration-300',
                                state === 'success' ? 'text-green-400' : 'text-brand-400',
                            )}
                        />
                    )}
                </div>
            </div>

            {/* Status text */}
            <div className="text-center">
                {state === 'loading' && (
                    <div className="animate-fade-in">
                        <p className="text-base font-semibold text-content-primary">
                            Completing sign-in…
                        </p>
                        <p className="mt-1 text-sm text-content-muted">
                            We're verifying your credentials. Just a moment.
                        </p>
                        {/* Dotted animated indicator */}
                        <div className="mt-4 flex justify-center gap-1.5">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce"
                                    style={{ animationDelay: `${i * 150}ms` }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {state === 'success' && (
                    <div className="animate-fade-up">
                        <p className="text-base font-semibold text-green-400">
                            Signed in successfully!
                        </p>
                        <p className="mt-1 text-sm text-content-muted">
                            Redirecting to your dashboard…
                        </p>
                    </div>
                )}

                {state === 'error' && (
                    <div className="animate-fade-up">
                        <p className="text-base font-semibold text-red-400">
                            Authentication failed
                        </p>
                        <p className="mt-1 text-sm text-content-secondary max-w-sm">
                            {errorMessage || 'Something went wrong. Please try again.'}
                        </p>
                        <button
                            id="callback-retry-btn"
                            type="button"
                            onClick={() => navigate('/auth/login', { replace: true })}
                            className="btn-primary mt-6"
                        >
                            Back to sign in
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
