import tailwindcss from "tailwindcss";
import { defineConfig } from "wxt";
import pkg from "./package.json";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  manifestVersion: 3,
  srcDir: "src",
  alias: {
    "@": "/src",
  },
  manifest: {
    browser_specific_settings: {
      gecko: {
        id: "glovolowfodmaphelper@goranninkovic.com",
      },
    },
    name: "Glovo Low-FODMAP Helper",
    version: pkg.version,
    description:
      "Ističe Low-FODMAP proizvode i omogućava sakrivanje ostalih na Glovo prodavnicama.",
    permissions: ["storage"],
    host_permissions: [
      "https://glovoapp.com/*",
      "https://glovo-fodmap-api.fly.dev/*",
      process.env.NODE_ENV === "development" ? "*://*/*" : "",
    ],

    commands: {
      "toggle-hide-products": {
        suggested_key: {
          default: "Ctrl+Shift+H",
          mac: "MacCtrl+Shift+H",
        },
        description: "Sakrij/Prikaži Non-Low-FODMAP proizvode",
      },
    },
  },
  outDir: "dist",
  vite() {
    return {
      build: {
        minify: "terser",
        sourcemap: process.env.NODE_ENV === "development" ? "inline" : false,
      },
      css: {
        postcss: {
          plugins: [tailwindcss("./tailwind.config.ts")],
        },
      },
    };
  },
});
