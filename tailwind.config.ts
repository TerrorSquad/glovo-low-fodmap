import { type Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/entrypoints/**/*.{html,js,ts,vue}',
    './src/components/**/*.{html,js,ts,vue}',
    './src/utils/**/*.{html,js,ts,vue}',
    './public/*.html',
  ],
  theme: {
    extend: {
      colors: {
        'fodmap-green': '#4CAF50',
        'fodmap-red': '#f44336',
        'fodmap-yellow': '#ff9800',
        'fodmap-gray': '#9e9e9e',
      },
      fontFamily: {
        system: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      width: {
        '80': '20rem',
      },
    },
  },
  plugins: [],
} satisfies Config

export default config
