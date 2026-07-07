import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    // wrangler preview serves the production build — keep the full dev panel
    // instead of shader-panel's production no-op stub.
    resolve: {
      conditions: ["development", "import", "module", "browser", "default"],
    },
    // Vite's dep pre-bundling breaks transformers.js's runtime worker/wasm
    // URL resolution — load it as-is instead.
    optimizeDeps: {
      exclude: ["@huggingface/transformers", "@mediapipe/tasks-vision"],
    },
    server: {
      fs: {
        allow: [".."],
      },
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8787",
          changeOrigin: true,
        },
      },
    },
  },
});
