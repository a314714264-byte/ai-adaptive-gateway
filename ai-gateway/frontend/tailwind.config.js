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
        bg: {
          primary: '#0f0f0f',
          secondary: '#1a1a1a',
          card: '#1e1e1e',
        },
        text: {
          primary: '#e5e5e5',
          secondary: '#9ca3af',
        },
        accent: {
          DEFAULT: '#10b981',
          hover: '#059669',
        },
        border: '#2a2a2a',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
