// Real application in Chromium. HTTP fixtures are local; server-side admission is tested separately in service-access.test.ts.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.QA_APP ?? "http://127.0.0.1:4311";
const output = process.env.KI_QA_OUTPUT ?? "/tmp/ki-service-browser";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const evidence = [];
try {
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [852, 393],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let closed = true;
    let characters = 0;
    await page.route("**/ws/godot/status", (route) =>
      route.fulfill({
        json: {
          maintenance: closed,
          canEnter: !closed,
          message: "Rozbudowujemy świat KI LEGENDS. Serwer jest w trakcie konserwacji.",
        },
      }),
    );
    await page.route("**/ws/characters**", (route) => {
      characters++;
      return route.fulfill({ status: 503, json: { error: "MAINTENANCE" } });
    });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Serwer w trakcie konserwacji" }).waitFor();
    assert.equal(characters, 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
    );
    await page.screenshot({ path: `${output}/maintenance-${width}x${height}.png`, fullPage: true });
    await page.getByRole("link", { name: "Logowanie administratora" }).click();
    await page.getByRole("heading", { name: "Zaloguj się", exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/konto");
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Serwer w trakcie konserwacji" }).waitFor();
    closed = false;
    await page
      .getByRole("heading", { name: "KI LEGENDS", exact: true })
      .waitFor({ timeout: 12000 });
    assert.deepEqual(errors, []);
    evidence.push({
      width,
      height,
      blockedCharactersRequests: characters,
      loginReachable: true,
      reopened: true,
      pageErrors: errors,
    });
    await context.close();
  }
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify(
      {
        passed: evidence.length,
        failed: 0,
        viewports: evidence,
        physicalPhoneTested: false,
        api: "local HTTP fixtures",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
