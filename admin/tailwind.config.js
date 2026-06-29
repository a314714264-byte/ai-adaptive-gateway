/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        panel: {
          primary: '#1e1e2e',
          secondary: '#262637',
          card: '#2a2a3c',
          border: '#363650',
        },
        accent: '#f59e0b',
        success: '#22c55e',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
