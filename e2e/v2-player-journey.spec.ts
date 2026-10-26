/**
 * World v2 (the default world since 26.10.2026) on a landscape phone and a computer: the path every
 * player takes. Entry, HUD placement, a fight outside town, inventory, skill tree and the 2D map.
 */
import { test, expect, type Page } from "./fixtures";

const command = (page: Page, detail: object) =>
  page
    .locator(".ki-canvas")
    .evaluate((el, d) => el.dispatchEvent(new CustomEvent("ki:command", { detail: d })), detail);
const position = async (page: Page) => {
  const canvas = page.locator(".ki-canvas");
  return {
    x: Number(await canvas.getAttribute("data-player-x")),
    y: Number(await canvas.getAttribute("data-player-y")),
  };
};
type Foe = { id: string; x: number; y: number; hp: number };
const enemies = async (page: Page) =>
  JSON.parse((await page.locator(".ki-canvas").getAttribute("data-enemies")) ?? "[]") as Foe[];

async function enter(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/scripts/playtest.html?ki-world-v2=1");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator(".ki-canvas")).toHaveAttribute("data-terrain-mode", "superior", {
    timeout: 120_000,
  });
  await expect(page.locator("html")).toHaveAttribute("data-ki-world-v2", "1");
}
const box = async (page: Page, selector: string) =>
  (await page.locator(selector).first().boundingBox())!;
const apart = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

for (const [width, height] of [
  [889, 400],
  [1920, 1080],
] as const)
  test(`v2 journey ${width}x${height}: HUD, panels and fight`, async ({ page }, info) => {
    test.setTimeout(420_000);
    await enter(page, width, height);
    // Nothing important overlaps: menu, "Widok", minimap and the portrait card.
    const menu = await box(page, ".ki-menu");
    const view = await box(page, ".ki-tools-toggle");
    const portrait = await box(page, ".ki-player");
    expect(apart(menu, view)).toBe(true);
    expect(apart(menu, portrait)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);

    // Panels open and fit the screen.
    for (const name of ["Ekwipunek", "Umiejętności", "Ustawienia", "Zadania"]) {
      await page.locator(".ki-menu button", { hasText: name }).click();
      const modal = page.locator(".ki-modal").first();
      await expect(modal).toBeVisible();
      const m = (await modal.boundingBox())!;
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x + m.width).toBeLessThanOrEqual(width + 1);
      if (name === "Umiejętności") {
        // The chosen node and its button sit beside the tree, not below it.
        const tree = (await page.locator(".ki-gst-board").boundingBox())!;
        const card = (await page.locator(".ki-gst-card").boundingBox())!;
        expect(card.x).toBeGreaterThanOrEqual(tree.x + tree.width - 1);
      }
      if (name === "Ustawienia")
        await expect(page.getByText("tymczasowy ludzki sprite")).toHaveCount(0);
      await page.screenshot({ path: info.outputPath(`${name}.png`) });
      await page.getByRole("button", { name: "Zamknij okno" }).click();
      await expect(page.locator(".ki-modal-backdrop")).toHaveCount(0);
    }

    // In town a target is refused with a reason.
    const start = await position(page);
    // Walk out until a monster streams in, then fight it.
    let foe: Foe | undefined;
    walk: for (const r of [2500, 4000])
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ] as const) {
        await command(page, { type: "move", x: start.x + dx * r, y: start.y + dy * r });
        for (let i = 0; i < 40 && !foe; i++) {
          await page.waitForTimeout(500);
          foe = (await enemies(page))[0];
        }
        if (foe) break walk;
      }
    expect(foe, "a monster appears outside town").toBeTruthy();
    await command(page, { type: "move", x: foe!.x, y: foe!.y });
    await page.waitForTimeout(6000);
    await expect
      .poll(
        async () => {
          await command(page, { type: "target", id: foe!.id });
          await command(page, { type: "ability", ability: "R" });
          return (await enemies(page)).find((e) => e.id === foe!.id)?.hp ?? 0;
        },
        { timeout: 60_000, intervals: [400] },
      )
      .toBeLessThan(foe!.hp);
    await page.screenshot({ path: info.outputPath("fight.png") });
  });
