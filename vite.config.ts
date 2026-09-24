import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  optimizeDeps: {
    // Required for mtcute per official docs
    exclude: ["@mtcute/wasm"],
  },
  define: {
    global: "globalThis",
  },
  server: {
    port: 5173,
  },
});
