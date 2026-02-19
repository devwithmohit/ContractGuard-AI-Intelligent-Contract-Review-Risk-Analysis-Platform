import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLoader from '@/components/shared/PageLoader';

export default function CallbackPage() {
    const navigate = useNavigate();

    useEffect(() => {
        // Full OAuth token exchange implemented in Module F4.
        // For now, redirect home.
        const t = setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
        return () => clearTimeout(t);
    }, [navigate]);

    return <PageLoader />;
}
