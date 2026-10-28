import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const canvasArgs = ["--no-sandbox", "--disable-webgl"];
const webglArgs = [
  "--no-sandbox",
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
];
const appTests = [
  "**/globe-handoff.spec.ts",
  "**/private-sketch.spec.ts",
  "**/map-performance.spec.ts",
];
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
      args: process.env["KI_QA_WEBGL"] ? webglArgs : canvasArgs,
    },
  },
  projects: [
    {
      name: "gameplay",
      testIgnore: [
        ...appTests,
        "**/globe-rendering.spec.ts",
        "**/gpu-webgl-smoke.spec.ts",
        "**/city-webgl.spec.ts",
      ],
    },
    {
      name: "software-webgl",
      testMatch: [
        "**/city-webgl.spec.ts",
        "**/combat-bosses.spec.ts",
        "**/combat-skills.spec.ts",
        "**/combat-v3.spec.ts",
        "**/combat-v3-superior.spec.ts",
        "**/argon-mobile.spec.ts",
        "**/gpu-webgl-smoke.spec.ts",
        "**/hero-lifecycle.spec.ts",
        "**/world-rendering.spec.ts",
        "**/superior-world.spec.ts",
      ],
      use: { launchOptions: { args: webglArgs } },
    },
    {
      name: "application-canvas",
      testMatch: appTests,
      use: {
        baseURL: process.env["KI_QA_APP_URL"] ?? "http://127.0.0.1:4176",
        launchOptions: { args: canvasArgs },
      },
    },
    {
      name: "application-webgl",
      testMatch: [
        "**/globe-handoff.spec.ts",
        "**/globe-rendering.spec.ts",
        "**/map-performance.spec.ts",
      ],
      use: {
        baseURL: process.env["KI_QA_APP_URL"] ?? "http://127.0.0.1:4176",
        launchOptions: { args: webglArgs },
      },
    },
  ],
  webServer: [
    ...(process.env["KI_QA_BASE_URL"]
      ? []
      : [
          {
            command:
              "npm run build:playtest && npx vite preview --config scripts/playtest.vite.ts --host 127.0.0.1 --port 4174",
            url: "http://127.0.0.1:4174/scripts/playtest.html",
            reuseExistingServer: !process.env["CI"],
          },
        ]),
    ...(process.env["KI_QA_APP_URL"]
      ? []
      : [
          {
            command:
              "npx vite --config scripts/application-qa.vite.ts --host 127.0.0.1 --port 4176",
            url: "http://127.0.0.1:4176",
            env: {
              SESSION_SECRET: "ki-legends-local-qa-session-only-20261021",
              SITE_PASSWORD: "ki-legends-local-qa-only",
            },
            reuseExistingServer: !process.env["CI"],
          },
        ]),
  ],
});
