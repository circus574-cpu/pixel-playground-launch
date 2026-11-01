import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  build: {
    outDir: ".online-playtest-dist",
    rollupOptions: { input: "scripts/online-playtest.html" },
  },
  preview: {
    host: "127.0.0.1",
    port: 5188,
    strictPort: true,
    proxy: { "/ws": { target: "http://127.0.0.1:7449", ws: true } },
  },
  server: {
    host: "127.0.0.1",
    port: 5188,
    proxy: { "/ws": { target: "http://127.0.0.1:7449", ws: true } },
  },
});
