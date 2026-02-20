/**
 * router.tsx
 *
 * React Router v6 — createBrowserRouter with data-router API.
 *
 * Route structure:
 *
 *   /                     → LandingPage     (public)
 *   /auth/login           → LoginPage        (public, redirect if auth'd)
 *   /auth/callback        → CallbackPage     (public — OAuth / magic-link)
 *   /dashboard            → DashboardPage    (auth-guarded, AppShell)
 *   /contracts            → ContractListPage
 *   /contracts/:id        → ContractDetailPage
 *   /contracts/upload     → UploadPage
 *   /search               → SearchPage
 *   /alerts               → AlertsPage
 *   /settings             → SettingsPage
 *   /team                 → TeamPage
 *   *                     → NotFoundPage
 */
import {
    createBrowserRouter,
    RouterProvider,
    Navigate,
    Outlet,
} from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuthContext } from './providers';
import AppShell from './AppShell';
import PageLoader from '@/components/shared/PageLoader';

// ─── Lazy page imports ────────────────────────────────────────
// Each page is code-split into its own chunk for fast initial load.

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const CallbackPage = lazy(() => import('@/pages/auth/CallbackPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const ContractListPage = lazy(() => import('@/pages/contracts/ContractListPage'));
const ContractDetailPage = lazy(() => import('@/pages/contracts/ContractDetailPage'));
const UploadPage = lazy(() => import('@/pages/contracts/UploadPage'));
const SearchPage = lazy(() => import('@/pages/search/SearchPage'));
const AlertsPage = lazy(() => import('@/pages/alerts/AlertsPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const TeamPage = lazy(() => import('@/pages/team/TeamPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// ─── Auth guard ───────────────────────────────────────────────

/**
 * Wraps protected routes. Shows a loader while session is loading,
 * redirects to /auth/login if unauthenticated.
 */
function AuthGuard() {
    const { isAuthenticated, isLoading } = useAuthContext();

    if (isLoading) {
        return <PageLoader />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/auth/login" replace />;
    }

    return <Outlet />;
}

/**
 * Redirects already-authenticated users away from auth pages.
 */
function GuestGuard() {
    const { isAuthenticated, isLoading } = useAuthContext();

    if (isLoading) {
        return <PageLoader />;
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}

// ─── Suspense wrapper ─────────────────────────────────────────

function SuspensePage({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<PageLoader />}>
            {children}
        </Suspense>
    );
}

// ─── Router ───────────────────────────────────────────────────

const router = createBrowserRouter([
    // ── Public landing page ───────────────────────────────────
    {
        path: '/',
        element: (
            <SuspensePage>
                <LandingPage />
            </SuspensePage>
        ),
    },

    // ── Auth routes (public, redirect if already logged in) ───
    {
        element: <GuestGuard />,
        children: [
            {
                path: '/auth/login',
                element: (
                    <SuspensePage>
                        <LoginPage />
                    </SuspensePage>
                ),
            },
        ],
    },

    // Auth callback — always public (must process token before guard runs)
    {
        path: '/auth/callback',
        element: (
            <SuspensePage>
                <CallbackPage />
            </SuspensePage>
        ),
    },

    // ── Protected routes (require authentication) ─────────────
    {
        element: <AuthGuard />,
        children: [
            {
                element: <AppShell />,
                children: [

                    // Dashboard
                    {
                        path: '/dashboard',
                        element: (
                            <SuspensePage>
                                <DashboardPage />
                            </SuspensePage>
                        ),
                    },

                    // Contract list
                    {
                        path: '/contracts',
                        element: (
                            <SuspensePage>
                                <ContractListPage />
                            </SuspensePage>
                        ),
                    },

                    // Upload — specific path BEFORE :id so it doesn't get captured
                    {
                        path: '/contracts/upload',
                        element: (
                            <SuspensePage>
                                <UploadPage />
                            </SuspensePage>
                        ),
                    },

                    // Contract detail
                    {
                        path: '/contracts/:id',
                        element: (
                            <SuspensePage>
                                <ContractDetailPage />
                            </SuspensePage>
                        ),
                    },

                    // Semantic search
                    {
                        path: '/search',
                        element: (
                            <SuspensePage>
                                <SearchPage />
                            </SuspensePage>
                        ),
                    },

                    // Alerts
                    {
                        path: '/alerts',
                        element: (
                            <SuspensePage>
                                <AlertsPage />
                            </SuspensePage>
                        ),
                    },

                    // Settings
                    {
                        path: '/settings',
                        element: (
                            <SuspensePage>
                                <SettingsPage />
                            </SuspensePage>
                        ),
                    },

                    // Team
                    {
                        path: '/team',
                        element: (
                            <SuspensePage>
                                <TeamPage />
                            </SuspensePage>
                        ),
                    },
                ],
            },
        ],
    },

    // ── 404 catch-all ─────────────────────────────────────────
    {
        path: '*',
        element: (
            <SuspensePage>
                <NotFoundPage />
            </SuspensePage>
        ),
    },
]);

// ─── Export ───────────────────────────────────────────────────

export function AppRouter() {
    return <RouterProvider router={router} />;
}

export default router;
