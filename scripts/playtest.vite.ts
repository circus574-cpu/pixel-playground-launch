import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/** Isolated local playtest of the real Index component; never deploys production. */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  server: { open: "/scripts/playtest.html" },
  build: {
    outDir: ".playtest-dist",
    rollupOptions: { input: "scripts/playtest.html" },
  },
});
