import { mergeConfig, type ConfigEnv, type UserConfig } from "vite";
import base from "../vite.config";

/** Local QA only: the real app with /ws proxied to the account QA server. */
export default async (env: ConfigEnv): Promise<UserConfig> => {
  const resolved = typeof base === "function" ? await base(env) : await base;
  return mergeConfig(resolved, { server: { proxy: { "/ws": "http://127.0.0.1:7457" } } });
};
