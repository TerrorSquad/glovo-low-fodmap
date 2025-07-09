import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  build: {
    target: 'esnext',
    sourcemap: 'inline',
    minify: false,
    rollupOptions: {
      input: {
        content: 'src/content.ts',
        popup: 'popup.html',
        background: 'src/background.ts',
        injector: 'src/injector.ts',
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
      },
    },
  }
});
