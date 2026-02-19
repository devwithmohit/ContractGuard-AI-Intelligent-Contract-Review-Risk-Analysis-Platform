import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],

    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },

    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            // Forward all /api/* requests to the Fastify backend
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
            },
        },
    },

    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            output: {
                // Split vendor chunks for better caching
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    query: ['@tanstack/react-query'],
                    supabase: ['@supabase/supabase-js'],
                    charts: ['recharts'],
                    motion: ['framer-motion'],
                },
            },
        },
    },

    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react-router-dom',
            '@tanstack/react-query',
            '@supabase/supabase-js',
        ],
    },
});
