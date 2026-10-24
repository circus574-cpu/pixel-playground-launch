/** Smoke test of the generated standalone explorer, including Jupyter's file sandbox. */
import { chromium } from "@playwright/test";
const target = process.argv[2];
if (!target) throw new Error("Usage: node scripts/worldgen/check-viewer.mjs URL [SCREENSHOT.png]");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/viewer.html", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": "sandbox allow-scripts" },
    });
  });
  await page.goto(target);
  await page.waitForFunction(() => document.querySelector("#facts").textContent.includes("×"));
  const count = await page.locator("#regions option").count();
  if (count !== 10) throw Error("Missing landmasses");
  await page.selectOption("#regions", "verdant");
  await page.waitForFunction(() =>
    document.querySelector("#facts").textContent.startsWith("Verdantia"),
  );
  await page.waitForFunction(() => {
    const i = document.querySelector("#terrain");
    return i.complete && i.naturalWidth > 0;
  });
  const background = await page
    .locator("#overlay")
    .evaluate((c) => getComputedStyle(c).backgroundColor);
  if (background !== "rgba(0, 0, 0, 0)") throw Error("Overlay hides the terrain image");
  const visible = await page.locator("#locations option").count();
  await page.check("#secrets");
  await page.waitForFunction(
    (n) => document.querySelectorAll("#locations option").length > n,
    visible,
  );
  const all = await page.locator("#locations option").count();
  await page.selectOption("#locations", {
    label: (await page.locator("#locations option").allTextContents()).find((x) =>
      x.includes("(maze)"),
    ),
  });
  await page.waitForFunction(() => document.querySelector("#maze").width > 1);
  await page.check("#solve");
  await page.check("#spawns");
  const spawns = await page.evaluate(() => spawnData.overworld.length);
  if (!spawns) throw Error("Missing separate spawn overlay");
  await page.locator("#zoom").fill("2");
  await page.locator("#zoom").dispatchEvent("input");
  const width = await page.locator("#map").evaluate((c) => c.style.width);
  if (width !== "200%") throw Error("Map zoom is broken");
  await page.locator("#zoom").fill("1");
  await page.locator("#zoom").dispatchEvent("input");
  if (errors.length) throw Error(errors.join("\n"));
  if (process.argv[3]) await page.screenshot({ path: process.argv[3], fullPage: true });
  console.log(
    JSON.stringify({
      passed: true,
      jupyterSandbox: true,
      landmasses: count,
      visibleLocations: visible,
      allLocations: all,
      overworldSpawns: spawns,
      mazeCanvas: await page.locator("#maze").evaluate((c) => [c.width, c.height]),
      errors,
    }),
  );
} finally {
  await browser.close();
}
