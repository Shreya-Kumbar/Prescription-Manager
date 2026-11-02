/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F7F9FC',
        surface: '#FFFFFF',
        primary: {
          DEFAULT: '#0F9F91',
          hover: '#0B8278',
          light: '#E6F7F5',
        },
        secondary: '#6BA8E5',
        lavender: '#EEE9FF',
        text: {
          DEFAULT: '#172B3A',
          secondary: '#64748B',
          light: '#94A3B8',
        },
        border: '#E5EAF0',
        darkbg: '#0B132B',
        darksurface: '#131C31',
        darkcard: '#162238',
        darkborder: '#233044',
        success: {
          DEFAULT: '#15803D',
          light: '#DCFCE7',
        },
        warning: {
          DEFAULT: '#B45309',
          light: '#FEF3C7',
        },
        error: {
          DEFAULT: '#DC2626',
          light: '#FEE2E2',
        },
        info: {
          DEFAULT: '#1D4ED8',
          light: '#DBEAFE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        'card-lg': '0 4px 16px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        card: '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        skeleton: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}
