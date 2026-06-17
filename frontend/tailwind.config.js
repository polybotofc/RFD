/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        roblox: {
          dark: '#0f0f23',
          darker: '#0a0a16',
          primary: '#1e1e3f',
          secondary: '#2d2d5a',
          accent: '#ff4444',
          success: '#00b050',
          warning: '#ff9800',
          text: '#ffffff',
          muted: '#b0b0c0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};