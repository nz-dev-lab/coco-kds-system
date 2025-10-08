/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // KDS color scheme
        'kds-bg': '#1a1d29',
        'kds-card': '#242835',
        'kds-border': '#2d3142',
        'kds-pending': '#3b82f6',
        'kds-confirmed': '#f59e0b',
        'kds-cooking': '#f97316',
        'kds-ready': '#10b981',
      },
    },
  },
  plugins: [],
}