/**
 * supabase.ts
 *
 * Supabase browser client singleton.
 * Used for:
 *   - Auth (signIn, signOut, session management, onAuthStateChange)
 *   - Realtime (live alert subscriptions via Postgres Changes)
 *
 * DO NOT use this client for data queries — use the REST API client
 * (lib/api.ts) so all requests go through your Fastify backend with
 * proper auth, rate limiting, and audit logging.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        '[ContractGuard] Missing Supabase env vars.\n' +
        'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
    );
}

/**
 * Singleton Supabase client for the browser.
 * Auth state is persisted in localStorage and auto-refreshed.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Persist session across refreshes
        persistSession: true,
        // Automatically refresh the session when it expires
        autoRefreshToken: true,
        // Detect session from URL (for OAuth callbacks, email magic links)
        detectSessionInUrl: true,
        // Store in localStorage (default) — change to 'sessionStorage' for
        // high-security envs where you want session cleared on tab close
        storage: window.localStorage,
    },

    realtime: {
        // Only connect when explicitly subscribed (not globally)
        params: {
            eventsPerSecond: 10,
        },
    },

    global: {
        headers: {
            'x-application': 'contractguard-web',
        },
    },
});

/**
 * Get the current auth session (or null).
 * Use inside hooks, not at module-level — session may not be loaded yet.
 */
export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

/**
 * Get the current JWT access token string (or null).
 * Used by the API client interceptor.
 */
export async function getAccessToken(): Promise<string | null> {
    const session = await getSession();
    return session?.access_token ?? null;
}
