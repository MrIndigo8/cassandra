import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        border: 'var(--color-border)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          light: 'var(--color-primary-light)',
        },
        secondary: 'var(--color-secondary)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          light: 'var(--color-accent-light)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          light: 'var(--color-success-light)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          light: 'var(--color-danger-light)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          light: 'var(--color-warning-light)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        dream: '#818CF8',
        premonition: '#F59E0B',
        feeling: '#EC4899',
        vision: '#A78BFA',
        match: '#10B981',
        anxiety: {
          low: '#10B981',
          mid: '#F59E0B',
          high: '#F97316',
          critical: '#EF4444',
        },
        'day-bg': '#F8FAFC',
        'day-surface': '#FFFFFF',
        'day-border': '#E2E8F0',
        'day-text': '#1E293B',
        'day-text-secondary': '#64748B',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        likePop: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.25)' },
        },
        pulseRed: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.4)', opacity: '0.4' },
        },
        pulseGlow: {
          '0%, 100%': {
            transform: 'scale(1)',
            opacity: '0.8',
            boxShadow: '0 0 8px rgba(239,68,68,0.4)',
          },
          '50%': {
            transform: 'scale(1.4)',
            opacity: '0.4',
            boxShadow: '0 0 20px rgba(239,68,68,0.6)',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
        borderPulse: {
          '0%, 100%': { borderColor: 'rgba(249,115,22,0.3)' },
          '50%': { borderColor: 'rgba(249,115,22,1)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'like-pop': 'likePop 0.25s ease-in-out',
        'pulse-red': 'pulseRed 2s ease-in-out infinite',
        ripple: 'ripple 0.6s ease-out',
        breathe: 'breathe 4s ease-in-out infinite',
        'border-pulse': 'borderPulse 2s ease-in-out infinite',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(139, 92, 246, 0.3)',
        'glow-md': '0 0 20px rgba(139, 92, 246, 0.4)',
        'glow-match': '0 0 15px rgba(16, 185, 129, 0.3)',
        'glow-danger': '0 0 12px rgba(239, 68, 68, 0.4)',
        /** Мягкая глубина для карточек ленты / лендинга */
        card: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 4px 24px -6px rgba(0,0,0,0.45)',
        'card-hover':
          '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 12px 40px -8px rgba(99, 102, 241, 0.2)',
        soft: '0 2px 12px -2px rgba(0,0,0,0.35)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
export default config;
