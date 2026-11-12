import base from "../../../../../playwright.config";
import { fileURLToPath } from "node:url";

// Reproducible landscape phone layout check of the production trial UI.
export default {
  ...base,
  testDir: fileURLToPath(new URL("../../../../../e2e", import.meta.url)),
  projects: [
    {
      name: "gameplay",
      testMatch: "**/racial-trials.spec.ts",
      use: { ...base.use, viewport: { width: 852, height: 393 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: [],
};
