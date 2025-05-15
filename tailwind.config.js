/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#003399',
        'light-blue': '#007bff',
        'hover-blue': '#0056b3',
        'light-bg': '#f0f0f0',
        'input-bg': '#e9f5ff',
        'viewer-bg': '#d0d0d0',
      },
    },
  },
  plugins: [],
}
