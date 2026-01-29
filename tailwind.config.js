/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.tsx",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        lego: {
          yellow: '#EAB308',
          red: '#ef4444',
          blue: '#3b82f6',
          green: '#22c55e'
        }
      }
    },
  },
  plugins: [],
}