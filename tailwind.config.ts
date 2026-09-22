import type { Config } from 'tailwindcss'

/**
 * The fiberX brand system.
 *
 * Both hues are sampled from the supplied logo: the violet of the wordmark and the
 * orange of the X. Every surface, border and text colour is expressed as a CSS
 * variable in `style.css` so that light and dark are one palette with two
 * definitions, rather than two sets of hard-coded classes scattered over the app.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        // The violet wordmark: the primary action and identity colour.
        primary: {
          50: '#f2effa',
          100: '#e5dff5',
          200: '#cabfeb',
          300: '#a894dc',
          400: '#8468c9',
          500: '#6847b3',
          600: '#4a2b8c',
          700: '#3d2373',
          800: '#2f1b59',
          900: '#231442',
          950: '#160c2b',
        },
        // The orange X: accent, highlights, and "earned" semantics.
        accent: {
          50: '#fef4f0',
          100: '#fde6dd',
          200: '#fbccba',
          300: '#f8a98c',
          400: '#f58a62',
          500: '#f26b3e',
          600: '#e14e1d',
          700: '#bb3d14',
          800: '#953216',
          900: '#782c16',
          950: '#411307',
        },
        // Semantic tokens resolved from CSS variables, so a single class works in
        // both themes and no component needs a `dark:` twin for colour alone.
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-muted': 'rgb(var(--c-surface-muted) / <alpha-value>)',
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        hairline: 'rgb(var(--c-border) / <alpha-value>)',
        content: 'rgb(var(--c-text) / <alpha-value>)',
        'content-muted': 'rgb(var(--c-text-muted) / <alpha-value>)',
        'content-subtle': 'rgb(var(--c-text-subtle) / <alpha-value>)',
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        // One stack for both scripts: Tajawal carries Arabic, Inter carries Latin,
        // and each falls back to the other so mixed strings never lose a glyph.
        sans: ['Inter', 'Tajawal', 'system-ui', 'sans-serif'],
        arabic: ['Tajawal', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card: '0.875rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 12 32 / 0.04), 0 1px 3px 0 rgb(16 12 32 / 0.06)',
        raised: '0 4px 12px -2px rgb(16 12 32 / 0.10), 0 2px 6px -2px rgb(16 12 32 / 0.06)',
        overlay: '0 20px 40px -12px rgb(16 12 32 / 0.28)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config
