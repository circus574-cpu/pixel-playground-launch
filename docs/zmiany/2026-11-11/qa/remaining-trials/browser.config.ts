import { defineConfig } from "@playwright/test";
import base from "../../../../../playwright.config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  ...base,
  testDir: fileURLToPath(new URL("../../../../../e2e", import.meta.url)),
  outputDir: fileURLToPath(
    new URL("../../../../../test-results-development-final", import.meta.url),
  ),
  reporter: [["list"], ["json", { outputFile: "/tmp/development-final-browser.json" }]],
  use: { ...base.use, video: { mode: "on", size: { width: 1024, height: 720 } } },
  webServer: [],
});
