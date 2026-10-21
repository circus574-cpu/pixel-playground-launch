import { defineConfig, mergeConfig } from "vite";
import applicationConfig from "../vite.config";

// Exercise real SSR routes and server functions without development reloads
// racing Playwright navigations. Keep the ordinary developer server unchanged.
export default defineConfig(async (env) =>
  mergeConfig(await applicationConfig(env), {
    cacheDir: "node_modules/.vite-application-qa",
    server: { hmr: false },
  }),
);
