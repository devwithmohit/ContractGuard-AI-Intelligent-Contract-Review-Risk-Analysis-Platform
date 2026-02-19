/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // ── Brand palette ─────────────────────────────
                brand: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',   // Primary indigo
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                    950: '#1e1b4b',
                },

                // ── Semantic risk colors ───────────────────────
                risk: {
                    low: '#22c55e',   // green-500
                    medium: '#f59e0b',   // amber-500
                    high: '#f97316',   // orange-500
                    critical: '#ef4444',   // red-500
                },

                // ── Surface colors (dark-first) ────────────────
                surface: {
                    DEFAULT: '#0f0f1a',    // Page background
                    card: '#16162a',    // Card / panel background
                    elevated: '#1e1e35',    // Dropdown, modal, elevated surfaces
                    border: '#2a2a45',    // Subtle border
                    muted: '#3a3a5c',    // Muted border / dividers
                },

                // ── Text ──────────────────────────────────────
                content: {
                    primary: '#f1f0ff',  // Headings
                    secondary: '#a9a8c9',  // Body text
                    muted: '#6b6a8d',  // Placeholders, captions
                    inverse: '#0f0f1a',  // Text on light backgrounds
                },
            },

            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },

            fontSize: {
                '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
            },

            borderRadius: {
                '4xl': '2rem',
            },

            boxShadow: {
                glow: '0 0 20px rgba(99, 102, 241, 0.3)',
                'glow-sm': '0 0 10px rgba(99, 102, 241, 0.2)',
                'glow-red': '0 0 20px rgba(239, 68, 68, 0.3)',
                'glow-green': '0 0 20px rgba(34, 197, 94, 0.2)',
                card: '0 4px 24px rgba(0, 0, 0, 0.4)',
                'card-hover': '0 8px 40px rgba(0, 0, 0, 0.6)',
            },

            backgroundImage: {
                'gradient-brand': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                'gradient-dark': 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
                'gradient-card': 'linear-gradient(135deg, #16162a 0%, #1e1e35 100%)',
                'gradient-risk-low': 'linear-gradient(135deg, #052e16 0%, #14532d 100%)',
                'gradient-risk-med': 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
                'gradient-risk-hi': 'linear-gradient(135deg, #431407 0%, #7c2d12 100%)',
                'gradient-risk-crit': 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)',
            },

            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'fade-up': 'fadeUp 0.4s ease-out',
                'slide-in-right': 'slideInRight 0.3s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'shimmer': 'shimmer 2s infinite',
            },

            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                fadeUp: {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideInRight: {
                    '0%': { opacity: '0', transform: 'translateX(24px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },

            transitionTimingFunction: {
                spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            },
        },
    },
    plugins: [],
};
