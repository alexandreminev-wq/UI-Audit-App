import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Separate build config for content script
 * Outputs a single-file IIFE (no imports, no chunks)
 * Required because Chrome content scripts run as classic scripts, not ES modules
 */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false, // Do not delete main build outputs
    lib: {
      entry: resolve(__dirname, "src/content/contentScript.ts"),
      formats: ["iife"],
      name: "ContentScript", // Global name for IIFE
      fileName: () => "contentScript.js"
    },
    rollupOptions: {
      output: {
        entryFileNames: "contentScript.js",
        inlineDynamicImports: true, // Prevent chunk splitting
      }
    },
    sourcemap: true
  }
});
