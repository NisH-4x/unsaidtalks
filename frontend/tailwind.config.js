/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: '#F6F3EE', raised: '#FFFDF9', sunk: '#EFEAE2' },
        ink: { DEFAULT: '#1B1A17', soft: '#3D3A34', muted: '#6B655C', faint: '#756E66' },
        line: { DEFAULT: '#E4DED4', strong: '#D3CBBE' },
        pine: {
          50: '#EEF5F3',
          100: '#DCEBE7',
          200: '#B7D6CF',
          300: '#8BBDB2',
          400: '#4F9688',
          500: '#2A7468',
          600: '#1F5F55',
          700: '#184C44',
          800: '#123A34',
          900: '#0C2925',
        },
        marigold: {
          50: '#FEF7EA',
          100: '#FDF0D9',
          200: '#FADDA8',
          300: '#F6C673',
          400: '#F2A93B',
          500: '#E08F17',
          600: '#B8730F',
          700: '#8F590C',
        },
        clay: {
          50: '#FCF1EE',
          100: '#F8E3DD',
          200: '#F0C3B7',
          400: '#DC7A62',
          500: '#C8553D',
          600: '#A9432E',
          700: '#86351F',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(27 26 23 / 0.04), 0 8px 24px -12px rgb(27 26 23 / 0.12)',
        bubble: '0 1px 1px rgb(27 26 23 / 0.06)',
      },
      keyframes: {
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'sheet-up': 'sheet-up 0.24s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'fade-in': 'fade-in 0.2s ease-out both',
        'pop-in': 'pop-in 0.16s ease-out both',
      },
    },
  },
  plugins: [],
};
