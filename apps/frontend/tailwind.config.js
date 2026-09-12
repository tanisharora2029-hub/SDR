/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#06060c',
          900: '#0d0d1b',
          850: '#111124',
          800: '#18182c',
          700: '#262642'
        },
        space: {
          950: '#06060c',
          900: '#0a0a14',
          850: '#0e0e1a',
          800: '#141424',
          700: '#1e1e36',
          600: '#2a2a4a'
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81'
        },
        violet: {
          glow: '#9333ea',
          electric: '#7c3aed'
        },
        cyan: {
          electric: '#38bdf8'
        }
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(124, 58, 237, 0.3)',
        'glow-md': '0 0 25px -4px rgba(124, 58, 237, 0.4)',
        'glow-lg': '0 0 45px -5px rgba(124, 58, 237, 0.5)',
        'glow-blue': '0 0 25px -4px rgba(56, 189, 248, 0.35)',
        'glass-bevel': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        'active-pill': '0 0 20px 2px rgba(124, 58, 237, 0.45)'
      },
      animation: {
        'float-slow': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 7s ease-in-out 2s infinite',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'radar-sweep': 'radarSweep 4s linear infinite',
        'shimmer': 'shimmer 2.5s linear infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.03)' },
        },
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      }
    },
  },
  plugins: [],
}
