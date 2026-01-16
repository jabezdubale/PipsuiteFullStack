
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        surfaceHighlight: 'rgb(var(--color-surface-highlight) / <alpha-value>)',
        primary: '#3b82f6',
        profit: '#10b981', 
        loss: '#ef4444',   
        textMain: 'rgb(var(--color-text-main) / <alpha-value>)',
        textMuted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
