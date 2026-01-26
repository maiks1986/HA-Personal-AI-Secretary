/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          teal: '#128c7e',
          light: '#25d366',
          blue: '#34b7f1',
          bg: '#f0f2f5',
          panel: '#ffffff',
          bubble: '#d9fdd3'
        }
      }
    },
  },
  plugins: [],
}
