/**
 * AppShell.tsx
 *
 * The authenticated app layout — wraps all protected pages.
 * Renders the Sidebar + Navbar + a scrollable main content area.
 *
 * Layout grid:
 *   ┌──────────┬──────────────────────────────────┐
 *   │          │  Navbar (top bar)                 │
 *   │ Sidebar  ├──────────────────────────────────┤
 *   │          │  <Outlet /> (page content)        │
 *   └──────────┴──────────────────────────────────┘
 */
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import Navbar from '@/components/shared/Navbar';

export default function AppShell() {
    // Mobile sidebar toggle
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-dvh overflow-hidden bg-surface">
            {/* ── Sidebar ──────────────────────────────────────── */}
            <Sidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* ── Main area ─────────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top navbar */}
                <Navbar onMenuClick={() => setSidebarOpen(true)} />

                {/* Page content — scrollable */}
                <main
                    id="main-content"
                    className="flex-1 overflow-y-auto p-6 lg:p-8"
                >
                    <Outlet />
                </main>
            </div>

            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}
        </div>
    );
}
