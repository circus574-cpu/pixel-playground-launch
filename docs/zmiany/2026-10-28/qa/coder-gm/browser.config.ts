import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "browser.spec.ts",
  outputDir: "/tmp/ki-gm-component-browser-results",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "/tmp/ki-gm-component-browser.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4185",
    trace: "retain-on-failure",
    launchOptions: { args: ["--no-sandbox", "--disable-webgl"] },
  },
});
