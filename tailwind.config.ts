import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'var(--font-mono)',
          'JetBrains Mono',
          'ui-monospace',
          'Menlo',
          'monospace',
        ],
        rajdhani: [
          'var(--font-rajdhani)',
          'Rajdhani',
          'sans-serif',
        ],
        orbitron: [
          'var(--font-orbitron)',
          'Orbitron',
          'sans-serif',
        ],
      },
      maxWidth: {
        chat: '720px',
      },
      width: {
        sidebar: '260px',
      },
      borderRadius: {
        composer: '24px',
        bubble: '20px',
        card: '20px',
        button: '12px',
        code: '14px',
      },
      fontSize: {
        'ui-sm': ['13px', '1.4'],
        'ui-base': ['15px', '1.4'],
        body: ['16px', '1.55'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        pulse: 'pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    typography,
  ],
}

export default config
