import { crx, type ManifestV3Export } from '@crxjs/vite-plugin'
import { defineConfig } from 'vite'
import tailwindcss from 'tailwindcss'
import manifest from './src/manifest.json'
import pkg from './package.json'

function generateManifest(): ManifestV3Export {
  if (process.env.NODE_ENV === 'development') {
    // In development, use the local API endpoint
    manifest.host_permissions.push('http://localhost/*')
  }
  return {
    ...manifest,
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
  }
}
export default defineConfig({
  plugins: [crx({ manifest: generateManifest() })],
  build: {
    sourcemap: process.env.NODE_ENV === 'development'  ? 'inline' : false,
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss('./tailwind.config.ts'),
      ],
    },
  },
})
