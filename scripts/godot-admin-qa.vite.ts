import { mergeConfig, type ConfigEnv, type UserConfig } from "vite";
import base from "../vite.config";

/** Local QA only: the real app with /ws proxied to the game server on 7420 (Android admin panel run). */
export default async (env: ConfigEnv): Promise<UserConfig> => {
  const resolved = typeof base === "function" ? await base(env) : await base;
  return mergeConfig(resolved, {
    server: {
      port: 5191,
      strictPort: true,
      proxy: { "/ws": { target: "http://127.0.0.1:7420", ws: true } },
    },
  });
};
