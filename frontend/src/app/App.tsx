/**
 * App.tsx — Root application component
 *
 * Full implementation happens in Module F3 (App Shell & Routing).
 * This stub lets `bun run dev` boot successfully for F1 validation.
 */
export default function App() {
    return (
        <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-surface">
            {/* Glow orb */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
            </div>

            {/* Logo mark */}
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-brand shadow-glow">
                <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-white" aria-hidden="true">
                    <path
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>

            {/* Wordmark */}
            <div className="text-center">
                <h1 className="text-3xl font-bold tracking-tight text-gradient">
                    ContractGuard AI
                </h1>
                <p className="mt-2 text-content-secondary">
                    Intelligent Contract Review &amp; Risk Analysis
                </p>
            </div>

            {/* Module progress indicator */}
            <div className="card px-6 py-4 text-center max-w-sm">
                <p className="text-xs font-mono text-content-muted">
                    🚀 Module F1 — Foundation &amp; Config
                </p>
                <p className="mt-1 text-sm text-content-secondary">
                    Vite + React + Tailwind scaffold ready.
                    Full UI coming in Modules F2–F8.
                </p>
            </div>
        </div>
    );
}
