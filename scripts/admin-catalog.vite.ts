import { defineConfig, mergeConfig } from "vite";
import playtest from "./playtest.vite";
export default mergeConfig(
  playtest,
  defineConfig({
    build: {
      outDir: ".admin-catalog-dist",
      copyPublicDir: false,
      rollupOptions: { input: "scripts/admin-catalog.html" },
    },
  }),
);
