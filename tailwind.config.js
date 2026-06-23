/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        neon: {
          cyan: '#00d4ff',
          purple: '#a855f7',
          blue: '#6366f1',
          'cyan-dim': 'rgba(0, 212, 255, 0.15)',
          'purple-dim': 'rgba(168, 85, 247, 0.12)',
        },
        dark: {
          base: '#06061a',
          surface: 'rgba(6, 10, 35, 0.72)',
          border: 'rgba(0, 212, 255, 0.22)',
        },
      },
    },
  },
  plugins: [],
};
