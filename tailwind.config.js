/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: '#08090D',
          void: '#050608',
          surface: '#10121C',
          card: '#151826',
          elevated: '#1A1E30',
          border: '#23283E',
          subtle: '#2E3552'
        },
        brand: {
          crimson: '#E11D48',
          rose: '#F43F5E',
          violet: '#8B5CF6',
          purple: '#A855F7',
          cyan: '#06B6D4',
          amber: '#F59E0B',
          gold: '#D97706',
          emerald: '#10B981'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      aspectRatio: {
        '16/9': '16 / 9',
      }
    },
  },
  plugins: [],
}
