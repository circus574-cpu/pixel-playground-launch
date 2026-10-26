import { test, expect, patchActiveCharacter, superiorLand } from "./fixtures";

test.use({ hasTouch: true, isMobile: true });
const cases = [
  { width: 320, height: 568, world: "verdant", race: "Planetarni", skill: "B1" },
  { width: 360, height: 640, world: "aether", race: "Mędrcy", skill: "B1" },
  { width: 390, height: 844, world: "nexus", race: "Androidy", skill: "B1" },
  { width: 852, height: 393, world: "pyra", race: "Legendy", skill: "C1" },
];
for (const { width, height, race, skill, world } of cases) {
  test(`Argon two thumbs, cancel, menu, saved skills: ${race} ${width}x${height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height });
    const context = page.context();
    await page.goto("/scripts/playtest.html");
    await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).tap();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).tap();
    await expect(page.locator(".ki-hud")).toBeVisible();
    const land = superiorLand(world);
    let lane: { x: number; y: number } | undefined;
    for (let dy = -500; dy <= 500 && !lane; dy += 32) {
      for (let dx = -700; dx <= 100 && !lane; dx += 32) {
        const p = { x: land.spawn.x + dx, y: land.spawn.y + dy };
        if (land.nav.walkable(p) && land.nav.visible(p, { x: p.x + 1000, y: p.y })) lane = p;
      }
    }
    expect(lane, "fixture requires a collision-free movement lane").toBeDefined();
    await patchActiveCharacter(page, { level: 3, skills: ["R", skill], ki: 40, ...lane });
    const canvas = page.locator(".ki-canvas");
    const x = async () => Number(await canvas.getAttribute("data-player-x"));
    const cdp = await context.newCDPSession(page);
    const left = { x: Math.round(width * 0.13), y: Math.round(height * 0.72), id: 1 };
    const moved = { ...left, x: left.x + 38 };
    const start = async () => {
      const before = await x();
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [left] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [moved] });
      await expect.poll(x).toBeGreaterThan(before + 10);
    };
    const press = async (selector: string) => {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThan(width * 0.32);
      const right = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 };
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [moved, right],
      });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [right] });
      const after = await x();
      await expect(canvas).toHaveAttribute("data-joystick-x", "38");
      await expect.poll(x, { timeout: 8000 }).toBeGreaterThan(after + 12);
    };
    await start();
    await press('[data-ability="R"]');
    const action = page.locator(`[data-ability="${skill}"]`);
    const costText = await action.locator(".ki-ability-cost").innerText();
    expect(costText).toMatch(/^\d+ KI$/);
    await press(`[data-ability="${skill}"]`);
    await expect(action.locator(".ki-cooldown")).toBeVisible();
    await expect(action).toBeDisabled();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await page.waitForTimeout(300);
    const stopped = await x();
    await page.waitForTimeout(400);
    expect(Math.abs((await x()) - stopped)).toBeLessThan(2);
    await start();
    await page
      .locator("canvas")
      .dispatchEvent("pointercancel", { pointerType: "touch", pointerId: 1 });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);
    const canceled = await x();
    await page.waitForTimeout(400);
    expect(Math.abs((await x()) - canceled)).toBeLessThan(2);
    await page.getByRole("button", { name: "Ekwipunek", exact: true }).tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Zamknij okno", exact: true }).tap();
    await start();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.screenshot({ path: info.outputPath(`argon-${width}.png`) });
    await page.reload();
    await expect(action).toBeVisible();
  });
}

test("Argon v2 quest summary follows the real journal and survives reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/scripts/playtest.html?ki-world-v2=1");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).tap();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).tap();
  await expect(page.locator(".ki-hud")).toBeVisible();
  await page.getByRole("button", { name: "Dziennik", exact: true }).tap();
  const journal = page.getByRole("region", { name: "Przygody świata v2" });
  const card = journal
    .locator("article")
    .filter({ has: page.getByRole("button", { name: "Przyjmij zadanie", exact: true }) })
    .first();
  const title = (await card.locator("h3").innerText()).replace(/^◆\s*/, "");
  await card.getByRole("button", { name: "Przyjmij zadanie", exact: true }).tap();
  await expect(page.locator(".ki-quest strong")).toHaveText(title);
  await page.getByRole("button", { name: "Zamknij okno", exact: true }).tap();
  const saved = await page.evaluate(() => localStorage.getItem("ki_legends_save_v5"));
  expect(saved).toBeTruthy();
  await page.reload();
  await expect(page.locator(".ki-hud")).toBeVisible();
  await expect(page.locator(".ki-quest strong")).toHaveText(title);
  expect(await page.evaluate(() => localStorage.getItem("ki_legends_save_v5"))).toBe(saved);
});
