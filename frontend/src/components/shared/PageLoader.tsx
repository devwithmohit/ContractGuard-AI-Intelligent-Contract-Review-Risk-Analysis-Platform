/**
 * PageLoader.tsx
 *
 * Full-screen animated loader shown while:
 *  - Auth session is being verified
 *  - Lazy page chunks are loading (Suspense fallback)
 *
 * Matches the branded splash in main.tsx for visual continuity.
 */
export default function PageLoader() {
    return (
        <div
            className="flex h-dvh w-full items-center justify-center bg-surface"
            role="status"
            aria-label="Loading page"
        >
            {/* Spinning ring */}
            <div className="relative h-14 w-14">
                {/* Static background */}
                <div className="absolute inset-0 rounded-full border-2 border-surface-border" />
                {/* Animated arc */}
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-500" />
                {/* Center logo mark */}
                <div className="absolute inset-2 flex items-center justify-center rounded-full bg-surface-card">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5 text-brand-400"
                        aria-hidden="true"
                    >
                        <path
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            </div>
        </div>
    );
}

/**
 * Inline variant — used inside a content area (not full screen).
 * Shows a smaller centered spinner without the full-page overlay.
 */
export function InlineLoader({ className = '' }: { className?: string }) {
    return (
        <div
            className={`flex items-center justify-center py-12 ${className}`}
            role="status"
            aria-label="Loading"
        >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-border border-t-brand-500" />
        </div>
    );
}
