/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: {
        hans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fef2f2',
          500: '#dc2626',
          600: '#b91c1c',
          700: '#991b1b',
        },
      },
    },
  },
  plugins: [],
};
