/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#f7f4ef',
        'bg-surface': '#faf8f5',
        'bg-panel': '#f2ede6',
        'bg-card': '#ffffff',
        'bg-input': '#fdfcfa',
        'bg-hover': '#f0ebe3',
        'border-base': '#e8e0d4',
        'border-strong': '#d4c8b8',
        'txt-primary': '#1f1510',
        'txt-secondary': '#5a4c3c',
        'txt-muted': '#9a8c7c',
        'txt-placeholder': '#c4b49a',
        acc: '#BC6C5F',
        'acc-hover': '#a45a4e',
        'acc-light': '#faecea',
        ok: '#5a9a7a',
        err: '#c0392b',
        warn: '#b8860b',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        sm: '10px',
        md: '14px',
        lg: '20px',
        xl: '28px',
        pill: '999px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(26,18,8,0.06), 0 1px 2px rgba(26,18,8,0.04)',
        md: '0 4px 16px rgba(26,18,8,0.08), 0 1px 4px rgba(26,18,8,0.04)',
        lg: '0 12px 40px rgba(26,18,8,0.10), 0 2px 8px rgba(26,18,8,0.05)',
        acc: '0 2px 8px rgba(188,108,95,0.18)',
        'acc-lg': '0 4px 16px rgba(188,108,95,0.28)',
      },
    },
  },
  plugins: [],
};
