/**
 * App.tsx — Root application component
 *
 * Composes:
 *  1. Providers (QueryClient, Auth, Toaster)
 *  2. AppRouter (React Router v6 createBrowserRouter)
 */
import { Providers } from './providers';
import { AppRouter } from './router';

export default function App() {
    return (
        <Providers>
            <AppRouter />
        </Providers>
    );
}
