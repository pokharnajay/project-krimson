/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      './src/pages/**/*.{js,jsx}',
      './src/components/**/*.{js,jsx}',
      './src/app/**/*.{js,jsx}',
    ],
    theme: {
      extend: {
        colors: {
          primary: '#1a1a1a',
          secondary: '#4a4a4a',
          accent: '#6b4edb',
          'claude-bg': '#f7f7f8',
          'claude-border': '#e5e5e6',
          'claude-text': '#2d2d2d',
          'claude-muted': '#73738c',
        },
        animation: {
          'spin-slow': 'spin 3s linear infinite',
        },
      },
    },
    plugins: [],
  }
