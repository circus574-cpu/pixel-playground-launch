import { mergeConfig, type ConfigEnv, type UserConfig } from "vite";
import base from "../../../vite.config";

/** Dev server for the local player walkthrough: the page on :5190 talks to the game server on :7420 through the /ws proxy. */
export default async (env: ConfigEnv): Promise<UserConfig> => {
  const resolved = typeof base === "function" ? await base(env) : await base;
  return mergeConfig(resolved, {
    server: { proxy: { "/ws": { target: "http://127.0.0.1:7420", ws: true } } },
  });
};
