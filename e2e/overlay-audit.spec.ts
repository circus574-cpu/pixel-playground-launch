import {
  basicAttack,
  maxHp,
  nearestSpawn,
  liveEnemy,
  testCreature,
  openDirection,
  openHudTool,
  patchActiveCharacter,
} from "./fixtures";
import { test, expect, type Page, type CDPSession } from "./fixtures";
import { mkdir } from "node:fs/promises";
const path =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
const evidence = () => test.info().outputDir;
async function start(page: Page, race = "Legendy", query = "") {
  await page.goto(path + query);
  await page.getByRole("button", { name: "Wybierz: " + race, exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
}
async function settings(page: Page) {
  await openHudTool(page, "Ustawienia");
}
async function listenerCount(cdp: CDPSession) {
  const response = await cdp.send("Runtime.evaluate", {
    expression: "(getEventListeners(window).pagehide || []).length",
    includeCommandLineAPI: true,
    returnByValue: true,
  });
  return response.result.value as number;
}
function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
for (const [width, height] of [
  [1280, 900],
  [360, 800],
  [390, 844],
  [414, 896],
  [852, 393],
] as const)
  test(
    "clear world, dismiss/expire guidance, dialogs and persistent options " + width,
    async ({ page, context }) => {
      await mkdir(evidence(), { recursive: true });
      await page.setViewportSize({ width, height });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(path);
      const cdp = await context.newCDPSession(page),
        baseline = await listenerCount(cdp);
      await page.getByRole("button", { name: "Wybierz: Legendy", exact: true }).click();
      await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
      await expect(page.locator(".ki-hud")).toBeVisible();
      const canvas = page.locator(".ki-canvas");
      await expect(page.locator(".ki-game-feedback")).toHaveCount(0);
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-npc-labels")))
        .toBeLessThanOrEqual(1);
      await page.screenshot({ path: evidence() + "/clean-" + width + ".png" });
      await basicAttack(page).click();
      const message = page.getByRole("status", { name: "Komunikat gry", exact: true });
      await expect(message).toBeVisible();
      const box = (await message.boundingBox())!;
      for (const selector of [
        ".ki-player",
        ".ki-map",
        ".ki-actionbar",
        ".ki-context-actions",
        ".ki-view-controls",
      ]) {
        const other = await page.locator(selector).boundingBox();
        if (other) expect(overlaps(box, other), selector).toBe(false);
        else expect(selector).toBe(".ki-view-controls"); // Folded into the voluntary mobile menu.
      }
      // Painted hero: 160×160 display, (0.5, 0.95) foot anchor. Include camera
      // clamping on portrait maps when checking that guidance clears the body.
      const hero = await canvas.evaluate((el) => {
        const z = Number((el as HTMLElement).dataset["zoom"]),
          px = Number((el as HTMLElement).dataset["playerX"]),
          py = Number((el as HTMLElement).dataset["playerY"]);
        const sx = Math.max(0, Math.min(2400 - el.clientWidth / z, px - el.clientWidth / z / 2)),
          sy = Math.max(0, Math.min(1792 - el.clientHeight / z, py - el.clientHeight / z / 2));
        return {
          x: (px - sx) * z - 80 * z,
          y: (py - sy) * z - 152 * z,
          width: 160 * z,
          height: 160 * z,
        };
      });
      expect(overlaps(box, hero)).toBe(false);
      const textBox = (await message.locator("p").boundingBox())!;
      expect(
        await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, {
          x: textBox.x + 5,
          y: textBox.y + 5,
        }),
      ).toBe("CANVAS");
      await page.screenshot({ path: evidence() + "/message-" + width + ".png" });
      await expect(message).toHaveCount(0, { timeout: 6500 });
      await basicAttack(page).click();
      await expect(message).toBeVisible();
      await page.getByRole("button", { name: "Zamknij komunikat", exact: true }).click();
      await page.waitForTimeout(300);
      await expect(message).toHaveCount(0);
      await page.getByRole("button", { name: /Rozmowa · Kaena/ }).click();
      await expect(page.getByRole("dialog", { name: "Rozmowa: Kaena", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
      await expect(page.locator(".ki-npc-dialogue .ki-game-feedback")).toBeVisible();
      await expect(page.locator(".ki-notification-rail")).toHaveCount(0);
      await page.screenshot({ path: evidence() + "/dialogue-" + width + ".png" });
      await expect(page.locator(".ki-npc-dialogue .ki-game-feedback")).toHaveCount(0, {
        timeout: 6500,
      });
      await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
      await expect(message).toHaveCount(0);
      await settings(page);
      await page.getByRole("checkbox", { name: "Komunikaty w grze", exact: true }).uncheck();
      await page.getByRole("checkbox", { name: "Nazwy postaci w pobliżu", exact: true }).uncheck();
      await page.getByRole("checkbox", { name: "Duża minimapa", exact: true }).check();
      await page.getByText("Sterowanie i pomoc", { exact: true }).click();
      await page.screenshot({ path: evidence() + "/settings-" + width + ".png" });
      await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-world-labels", "false");
      await expect.poll(async () => Number(await canvas.getAttribute("data-npc-labels"))).toBe(0);
      await expect
        .poll(async () => (await page.locator(".ki-map").boundingBox())!.width)
        .toBe(height <= 500 ? 100 : width <= 760 ? 112 : 200);
      expect(
        overlaps(
          (await page.locator(".ki-map").boundingBox())!,
          (await page.locator(".ki-player").boundingBox())!,
        ),
      ).toBe(false);
      const menuToggle = page.getByRole("button", { name: "Menu gry", exact: true });
      const compact = await menuToggle.isVisible();
      if (compact) await menuToggle.click();
      expect(
        overlaps(
          (await page.locator(".ki-map").boundingBox())!,
          (await page.locator(".ki-view-controls").boundingBox())!,
        ),
      ).toBe(false);
      if (compact) await menuToggle.click();
      await basicAttack(page).click();
      await expect(message).toHaveCount(0);
      await openHudTool(page, "Czat lokalny");
      await expect(page.getByRole("log")).toContainText("Wybierz cel");
      await page.getByRole("tab", { name: "Ogólny", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Wiadomość lokalna", exact: true })
        .fill("Test widoczności gry");
      await page.getByRole("textbox", { name: "Wiadomość lokalna", exact: true }).press("Enter");
      await expect(page.getByRole("log")).toContainText("Test widoczności gry");
      await page.keyboard.press("Escape");
      await expect(page.locator(".ki-chat-open")).toHaveCount(0);
      await page.reload();
      await expect(page.locator(".ki-hud")).toBeVisible();
      await settings(page);
      await expect(
        page.getByRole("checkbox", { name: "Komunikaty w grze", exact: true }),
      ).not.toBeChecked();
      await expect(
        page.getByRole("checkbox", { name: "Nazwy postaci w pobliżu", exact: true }),
      ).not.toBeChecked();
      await expect(
        page.getByRole("checkbox", { name: "Duża minimapa", exact: true }),
      ).toBeChecked();
      await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
      await page.getByRole("button", { name: "Nowa podróż", exact: true }).click();
      await expect(page.locator("canvas")).toHaveCount(0);
      await expect.poll(() => listenerCount(cdp)).toBe(baseline);
      await page.getByRole("button", { name: "Wybierz: Mędrcy", exact: true }).click();
      await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
      await expect(page.locator(".ki-hud")).toBeVisible();
      await expect(canvas).toHaveAttribute("data-world-labels", "false");
      await expect(page.locator(".ki-game-feedback")).toHaveCount(0);
      await settings(page);
      await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
      await page.getByRole("button", { name: "Nowa podróż", exact: true }).click();
      await expect(page.locator("canvas")).toHaveCount(0);
      await expect.poll(() => listenerCount(cdp)).toBe(baseline);
      expect(errors).toEqual([]);
    },
  );

test("save failure stays actionable after normal guidance is disabled or dismissed", async ({
  page,
}) => {
  await start(page, "Planetarni");
  await settings(page);
  await page.getByRole("checkbox", { name: "Komunikaty w grze", exact: true }).uncheck();
  await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
  // This context deliberately simulates a full storage quota; no real player data is used.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.includes(":character:")) throw new DOMException("QA quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const warning = page.getByRole("alert", { name: "Problem z zapisem", exact: true });
  await expect(warning).toBeVisible();
  await page.getByRole("button", { name: "Zamknij ostrzeżenie o zapisie", exact: true }).click();
  await expect(warning).toHaveCount(0);
  await expect(page.getByLabel("Problem z zapisem", { exact: true })).toBeVisible();
  await settings(page);
  await expect(
    page.getByRole("dialog", { name: "Ustawienia", exact: true }).getByRole("alert"),
  ).toContainText("Nie udało się zapisać");
  await expect(page.locator(".ki-notification-rail")).toHaveCount(0);
  await page.screenshot({ path: evidence() + "/save-warning.png" });
});

test("death message ends on real respawn and subsequent movement works", async ({ page }) => {
  // A known creature waits just outside the safe capital (playtest-only QA spawn).
  test.setTimeout(480000);
  const creature = testCreature("pyra");
  await start(page, "Legendy", creature.query);
  const max = await maxHp(page);
  const canvas = page.locator(".ki-canvas");
  const arrivalX = Number(await canvas.getAttribute("data-player-x"));
  await canvas.evaluate(
    (el, home) =>
      el.dispatchEvent(
        new CustomEvent("ki:command", { detail: { type: "move", x: home.x, y: home.y + 85 } }),
      ),
    await liveEnemy(canvas, creature.id),
  );
  await expect(page.locator(".ki-death-overlay")).toBeVisible({ timeout: 240000 });
  await expect(page.locator(".ki-notification-rail .ki-game-feedback")).toHaveCount(0);
  await page.screenshot({ path: evidence() + "/death.png" });
  await expect(page.locator(".ki-death-overlay")).toHaveCount(0, { timeout: 60000 });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-player-x")))
    .toBeCloseTo(arrivalX, 0);
  await expect(page.getByRole("meter", { name: "Zdrowie", exact: true })).toHaveAttribute(
    "aria-valuenow",
    max,
  );
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  const position = async () => ({
    x: Number(await canvas.getAttribute("data-player-x")),
    y: Number(await canvas.getAttribute("data-player-y")),
  });
  const before = await position();
  // The respawn clip holds the hero in place; walk once it has finished.
  await expect(page.locator(".ki-canvas")).toHaveAttribute("data-animation-state", /^(idle|walk)$/);
  const free = openDirection("pyra", before);
  expect(free).toBeDefined();
  await page.keyboard.down(free);
  await page.waitForTimeout(700);
  await page.keyboard.up(free);
  await expect
    .poll(async () => {
      const p = await position();
      return Math.hypot(p.x - before.x, p.y - before.y);
    })
    .toBeGreaterThan(20);
});

for (const [width, height] of [
  [360, 800],
  [390, 844],
  [414, 896],
  [640, 480],
  [852, 393],
  [1280, 900],
] as const) {
  test(`combat messages leave the actual target panel clear at ${width}px`, async ({ page }) => {
    test.setTimeout(300000);
    await page.setViewportSize({ width, height });
    await start(page);
    // Combat targeting is correctly forbidden in the safe capital. Walk out
    // through the public movement adapter before checking the combat overlay.
    const outside = nearestSpawn("pyra");
    await page.locator(".ki-canvas").evaluate(
      (el, p) =>
        el.dispatchEvent(
          new CustomEvent("ki:command", {
            detail: { type: "move", x: p.x - 150, y: p.y + 90 },
          }),
        ),
      outside,
    );
    await expect
      .poll(
        () =>
          page
            .locator(".ki-canvas")
            .evaluate(
              (el, p) =>
                Math.hypot(
                  Number((el as HTMLElement).dataset["playerX"]) - (p.x - 150),
                  Number((el as HTMLElement).dataset["playerY"]) - (p.y + 90),
                ),
              outside,
            ),
        { timeout: 180000 },
      )
      .toBeLessThan(95);
    // Use the same public command adapter as a canvas click, without changing session state.
    await page.locator(".ki-canvas").evaluate(
      (el, id) =>
        el.dispatchEvent(
          new CustomEvent("ki:command", {
            detail: { type: "target", id },
          }),
        ),
      outside.id,
    );
    const target = page.locator(".ki-target"),
      message = page.getByRole("status", { name: "Komunikat gry", exact: true });
    await expect(target).toBeVisible();
    await expect(message).toBeVisible();
    expect(
      overlaps((await target.boundingBox())!, (await message.boundingBox())!),
      String(width),
    ).toBe(false);
    await page.screenshot({ path: evidence() + "/combat-" + width + ".png" });
  });
}
