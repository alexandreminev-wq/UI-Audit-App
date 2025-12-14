import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        serviceWorker: resolve(__dirname, "src/background/serviceWorker.ts"),
        contentScript: resolve(__dirname, "src/content/contentScript.ts")
      },
      output: {
        entryFileNames: (chunk) => {
          // Force MV3-friendly names expected by manifest.json
          if (chunk.name === "serviceWorker") return "serviceWorker.js";
          if (chunk.name === "contentScript") return "contentScript.js";
          return "[name].js";
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
