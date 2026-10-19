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
        raycast: {
          bg: '#141517',
          card: '#1a1b1e',
          hover: '#24262b',
          border: '#2a2c33',
          accent: '#e5484d',
          text: '#ededed',
          subtext: '#8f93a0',
        }
      },
      boxShadow: {
        'raycast': '0 20px 70px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        'glow': '0 0 20px -5px rgba(229, 72, 77, 0.3)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
