import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    // Linked TS source package — let Vite transform it instead of pre-bundling.
    optimizeDeps: {
      exclude: ["@tjcages/shader-dev"],
    },
    ssr: {
      noExternal: ["@tjcages/shader-dev"],
    },
    server: {
      fs: {
        allow: ["..", "/Users/ty/Desktop/shader-dev"],
      },
    },
  },
});
