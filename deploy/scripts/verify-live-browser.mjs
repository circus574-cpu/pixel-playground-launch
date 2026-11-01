/** Real login and player input against production; never uploads credentials or traces. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  `${process.env.KI_QA_PLAYWRIGHT_ROOT}/node_modules/playwright/index.mjs`
);
const credentials = JSON.parse(await readFile(process.env.KI_QA_CREDENTIAL_FILE, "utf8"));
const output = process.env.KI_QA_OUTPUT;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const results = [];
let currentPage;
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage();
    currentPage = page;
    const errors = [],
      missing = [],
      packets = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400 && new URL(r.url()).pathname.startsWith("/game/"))
        missing.push(new URL(r.url()).pathname);
    });
    page.on("websocket", (ws) =>
      ws.on("framesent", (event) => {
        try {
          packets.push(JSON.parse(String(event.payload)).type);
        } catch {}
      }),
    );
    await page.goto("https://kilegends.pl/konto");
    await page.locator("input[name=email]").fill(credentials.email);
    await page.locator("input[name=password]").fill(credentials.password);
    await page.getByRole("button", { name: "Zaloguj", exact: true }).click();
    await page
      .getByRole("heading", { name: "Twoje konto", exact: true })
      .waitFor({ timeout: 30000 });
    for (const character of credentials.characters) {
      await page.goto("https://kilegends.pl/");
      const enter = () =>
        page
          .locator(".ki-slot")
          .filter({ has: page.getByRole("heading", { name: `QA${character.race}`, exact: true }) })
          .getByRole("button", { name: "Kontynuuj podróż", exact: true })
          .click();
      await enter();
      const canvas = page.locator(".ki-canvas").first();
      await page.waitForFunction(
        () => document.querySelector(".ki-canvas")?.getAttribute("data-player-x"),
        {},
        { timeout: 90000 },
      );
      assert.equal(
        await canvas.getAttribute("data-world"),
        { planetary: "verdant", sage: "aether", android: "nexus", legend: "pyra" }[character.race],
      );
      const x = Number(await canvas.getAttribute("data-player-x"));
      if (mobile) {
        const box = await canvas.boundingBox();
        const cdp = await context.newCDPSession(page);
        const point = { x: box.x + 84, y: box.y + box.height - 104, id: 1 };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ ...point, x: point.x + 48 }],
        });
        try {
          await page.waitForFunction(
            (start) =>
              Number(document.querySelector(".ki-canvas")?.getAttribute("data-player-x")) >
              start + 5,
            x,
            { timeout: 8000 },
          );
        } finally {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        }
      } else {
        const box = await canvas.boundingBox();
        await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
        await page.keyboard.down("d");
        try {
          await page.waitForFunction(
            (start) =>
              Number(document.querySelector(".ki-canvas")?.getAttribute("data-player-x")) >
              start + 5,
            x,
            { timeout: 8000 },
          );
        } finally {
          await page.keyboard.up("d");
        }
      }
      await page.waitForTimeout(350);
      const saved = await page.evaluate(async (id) => {
        const authKey = Object.keys(localStorage).find((k) => k.endsWith("-auth-token"));
        const token = JSON.parse(localStorage.getItem(authKey)).access_token;
        const response = await fetch(`/ws/characters/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw Error(`Character read HTTP ${response.status}`);
        return response.json();
      }, character.id);
      const moved = Number(await canvas.getAttribute("data-player-x"));
      assert.ok(moved > x + 5);
      assert.ok(Math.abs(saved.state.player.x - moved) < 45);
      const mode = mobile ? "touch-390x844" : "desktop-1280x720";
      await page.screenshot({ path: `${output}/${character.race}-${mode}.png` });
      await page.reload();
      await enter();
      await page.waitForFunction(
        () => document.querySelector(".ki-canvas")?.getAttribute("data-player-x"),
        {},
        { timeout: 90000 },
      );
      const restored = Number(
        await page.locator(".ki-canvas").first().getAttribute("data-player-x"),
      );
      assert.ok(
        Math.abs(restored - saved.state.player.x) < 45,
        "Reload must restore committed position",
      );
      results.push({ race: character.race, mode, movement: Math.round(moved - x), restored: true });
    }
    assert.deepEqual(errors, [], "No JavaScript exceptions");
    assert.deepEqual(missing, [], "No missing game assets");
    assert.ok(
      !packets.includes("position") && !packets.includes("auth"),
      "No legacy position relay",
    );
    await context.close();
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ passed: results.length, results, physicalPhone: false }, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: results.length,
      failed: 0,
      actualLogin: true,
      actualKeyboardAndTouch: true,
      physicalPhone: false,
    }),
  );
} catch (error) {
  if (currentPage && (await currentPage.locator(".ki-canvas").count())) {
    await currentPage.screenshot({ path: `${output}/failure-game.png` }).catch(() => {});
  }
  const message = String(error.message)
    .replaceAll(credentials.password, "[redacted]")
    .replaceAll(credentials.email, "[QA account]");
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify({ passed: results.length, message, results }, null, 2),
  );
  console.error(message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
