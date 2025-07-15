import { crx } from '@crxjs/vite-plugin'
import { defineConfig } from 'vite'
import tailwindcss from 'tailwindcss'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    sourcemap: 'inline',
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss('./tailwind.config.ts'),
      ],
    },
  },
})
