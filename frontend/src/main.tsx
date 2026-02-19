import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Lazy-load the App to keep this entry point tiny
const App = React.lazy(() => import('./app/App.js'));

const rootEl = document.getElementById('root');

if (!rootEl) {
    throw new Error('Root element #root not found in index.html');
}

ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
        <React.Suspense
            fallback={
                <div className="flex h-dvh items-center justify-center bg-surface">
                    <div className="flex flex-col items-center gap-4">
                        {/* Animated brand logo mark */}
                        <div className="relative h-14 w-14">
                            <div className="absolute inset-0 rounded-2xl bg-gradient-brand animate-pulse-slow" />
                            <div className="absolute inset-1 rounded-xl bg-surface flex items-center justify-center">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    className="h-6 w-6 text-brand-400"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="text-sm text-content-muted animate-pulse">
                            Loading ContractGuard…
                        </div>
                    </div>
                </div>
            }
        >
            <App />
        </React.Suspense>
    </React.StrictMode>,
);
