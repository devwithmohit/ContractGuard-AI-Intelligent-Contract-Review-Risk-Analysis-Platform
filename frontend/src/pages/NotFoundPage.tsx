import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
    return (
        <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-surface text-center px-4">
            {/* Large 404 */}
            <div className="relative">
                <p className="text-8xl font-black text-surface-border select-none">404</p>
                <p className="absolute inset-0 flex items-center justify-center text-8xl font-black text-gradient opacity-30 select-none">
                    404
                </p>
            </div>

            <div>
                <h1 className="text-2xl font-bold text-content-primary mb-2">Page not found</h1>
                <p className="text-content-muted max-w-sm">
                    The page you're looking for doesn't exist or has been moved.
                </p>
            </div>

            <Link to="/dashboard" className="btn-primary btn-lg gap-2">
                <Home className="h-4 w-4" />
                Back to Dashboard
            </Link>
        </div>
    );
}
