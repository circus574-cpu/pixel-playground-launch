/** Reproducible public-site verification. No login credentials or game-state injection. */
import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
const proxyUrl = process.env["HTTPS_PROXY"] ?? process.env["HTTP_PROXY"];
export default defineConfig({
  testDir: fileURLToPath(new URL("../../../../../e2e", import.meta.url)),
  testMatch: "map-performance.spec.ts",
  outputDir: "/tmp/ki-map-production-browser-results",
  timeout: 240_000,
  expect: { timeout: 60_000 },
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "/tmp/ki-map-production-results.json" }]],
  use: {
    baseURL: "https://kilegends.pl",
    ...(proxyUrl ? { proxy: { server: new URL(proxyUrl).origin } } : {}),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "application-canvas",
      use: { launchOptions: { args: ["--no-sandbox", "--disable-webgl"] } },
    },
    {
      name: "application-webgl",
      use: {
        launchOptions: {
          args: [
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
  ],
});
