import base from "../../../../../playwright.config";
import { fileURLToPath } from "node:url";

// Independent output keeps the original desktop/WebGL evidence intact.
export default {
  ...base,
  testDir: fileURLToPath(new URL("../../../../../e2e", import.meta.url)),
  outputDir: fileURLToPath(
    new URL("../../../../../test-results-development-mobile", import.meta.url),
  ),
  reporter: [["list"], ["json", { outputFile: "/tmp/development-mobile-results.json" }]],
  projects: [
    {
      name: "gameplay",
      testMatch: "**/racial-trials.spec.ts",
      use: { ...base.use, viewport: { width: 852, height: 393 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: [],
};
