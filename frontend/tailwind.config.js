/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base colors - Dark mode
        'kds-bg': '#0f172a',
        'kds-bg-secondary': '#1e293b',
        'kds-surface': '#334155',
        'kds-border': '#475569',
        
        // Text colors
        'kds-text-primary': '#f1f5f9',
        'kds-text-secondary': '#cbd5e1',
        'kds-text-muted': '#94a3b8',
        
        // Status colors
        'kds-pending': {
          DEFAULT: '#3b82f6',
          light: '#60a5fa',
          dark: '#2563eb',
        },
        'kds-confirmed': {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
          dark: '#d97706',
        },
        'kds-cooking': {
          DEFAULT: '#f97316',
          light: '#fb923c',
          dark: '#ea580c',
        },
        'kds-ready': {
          DEFAULT: '#10b981',
          light: '#34d399',
          dark: '#059669',
        },
        'kds-delivered': {
          DEFAULT: '#6b7280',
          light: '#9ca3af',
          dark: '#4b5563',
        },
        
        // Alert colors
        'kds-danger': '#ef4444',
        'kds-warning': '#eab308',
        'kds-success': '#22c55e',
        'kds-info': '#06b6d4',
      },
      
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          '"Fira Sans"',
          '"Droid Sans"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          '"SF Mono"',
          'Monaco',
          '"Cascadia Code"',
          '"Roboto Mono"',
          'Consolas',
          '"Courier New"',
          'monospace',
        ],
      },
      
      boxShadow: {
        'order-card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.18)',
        'order-card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.18)',
      },
      
      borderRadius: {
        'card': '0.75rem',
        'badge': '0.5rem',
      },
      
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin': 'spin 1s linear infinite',
        'slide-up': 'slide-up 0.3s ease-out',
      },
    },
  },
  plugins: [],
}