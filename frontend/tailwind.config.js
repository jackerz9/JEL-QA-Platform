/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        jel: {
          orange: '#F97316',
          'orange-dark': '#EA580C',
          navy: '#0F172A',
          'navy-light': '#1E293B',
          'navy-lighter': '#334155',
        },
      },
    },
  },
  plugins: [],
};
