import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Isolated local playtest of the real Index component; never deploys production. */
export default defineConfig({
  plugins: [react()],
  server: { open: "/scripts/playtest.html" },
  build: {
    outDir: ".playtest-dist",
    rollupOptions: { input: "scripts/playtest.html" },
  },
});
