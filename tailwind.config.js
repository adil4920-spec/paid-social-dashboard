/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          indigo: '#5b4fe9',
          coral:  '#ff7a59',
        },
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card:       '0 1px 3px rgba(0,0,0,0.08)',
        'card-hover':'0 4px 12px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
