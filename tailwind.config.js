/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#FACC15', dark: '#EAB308', soft: '#FEF9C3' },
        ink: { DEFAULT: '#171717', soft: '#404040' },
        surface: '#F8F9FB',
        kpi: { green: '#16A34A', greenbg: '#DCFCE7', yellow: '#CA8A04', yellowbg: '#FEF08A', red: '#DC2626', redbg: '#FEE2E2' },
      },
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { xl: '14px', '2xl': '18px' },
      boxShadow: { card: '0 1px 2px rgba(23,23,23,.04), 0 1px 3px rgba(23,23,23,.06)' },
    },
  },
  plugins: [],
};
