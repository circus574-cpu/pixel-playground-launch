import { openHudTool, superiorLand } from "./fixtures";
import { test, expect } from "./fixtures";
import { RACES, RACE_IDS } from "../src/game/world/races";
import { distance } from "../src/game/navigation";
const path =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
for (const race of RACE_IDS)
  test("browser collider and camera: " + race, async ({ page }) => {
    const worldId = RACES[race].world;
    const world = superiorLand(worldId);
    const npcs = world.npcs;
    const nav = world.nav;
    // Authored colliders (buildings, rocks, trees) near the safe arrival of the generated land.
    const obstacles = world.colliders.filter((o) => distance(o, world.spawn) < 1500);
    const candidates = obstacles
      .flatMap((o) => [
        { x: o.x - 30, y: o.y + o.height / 2, key: "ArrowRight" },
        { x: o.x + o.width + 30, y: o.y + o.height / 2, key: "ArrowLeft" },
        { x: o.x + o.width / 2, y: o.y - 30, key: "ArrowDown" },
        { x: o.x + o.width / 2, y: o.y + o.height + 30, key: "ArrowUp" },
      ])
      .filter(
        (p) =>
          nav.walkable(p) &&
          nav.path(world.spawn, p).length > 0 &&
          npcs.every((n) => distance(n, p) > 100) &&
          world.enemies.every((n) => distance(n, p) > 220),
      )
      .sort((a, b) => distance(a, world.spawn) - distance(b, world.spawn));
    const target = candidates[0]!;
    expect(target).toBeDefined();
    await page.goto(path);
    await page.getByRole("button", { name: "Wybierz: " + RACES[race].name, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    await expect(page.locator(".ki-hud")).toBeVisible();
    const canvas = page.locator(".ki-canvas");
    await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
    const position = async () => ({
      x: Number(await canvas.getAttribute("data-player-x")),
      y: Number(await canvas.getAttribute("data-player-y")),
    });
    expect(nav.walkable(await position())).toBe(true);
    // Use the production movement command adapter, then actual keyboard input against the wall.
    // No coordinates, progression or collision data are injected into the live session.
    await canvas.evaluate(
      (el, p) =>
        el.dispatchEvent(
          new CustomEvent("ki:command", { detail: { type: "move", x: p.x, y: p.y } }),
        ),
      { x: target.x, y: target.y },
    );
    await expect
      .poll(async () => distance(await position(), target), { timeout: 60000 })
      .toBeLessThan(8);
    const before = await position();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.keyboard.down(target.key);
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(100);
      expect(nav.walkable(await position())).toBe(true);
    }
    await page.keyboard.up(target.key);
    const travelled = distance(before, await position());
    expect(travelled).toBeGreaterThan(5);
    expect(travelled).toBeLessThan(35);
    await expect(page.getByTestId("ki-map-you")).toBeVisible();
    expect((await page.locator("canvas").boundingBox())!.width).toBe(1280);
    await openHudTool(page, "Przybliż mapę");
    await expect(canvas).toHaveAttribute("data-zoom", "0.7");
  });
