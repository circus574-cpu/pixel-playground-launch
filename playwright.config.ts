import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 60_000 },
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/stage3-results.json" }]],
  use: {
    baseURL: process.env["KI_QA_BASE_URL"] ?? "http://127.0.0.1:4174",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"]
        ? { executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"] }
        : existsSync("/usr/bin/chromium")
          ? { executablePath: "/usr/bin/chromium" }
          : {}),
      // Canvas mode avoids software WebGL contention in headless CI; same Phaser adapter.
      args: process.env["KI_QA_WEBGL"]
        ? [
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ]
        : ["--no-sandbox", "--disable-webgl"],
    },
  },
  ...(process.env["KI_QA_BASE_URL"]
    ? {}
    : {
        webServer: {
          command:
            "npm run build:playtest && npx vite preview --config scripts/playtest.vite.ts --host 127.0.0.1 --port 4174",
          url: "http://127.0.0.1:4174/scripts/playtest.html",
          reuseExistingServer: !process.env["CI"],
        },
      }),
});
