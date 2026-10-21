import { expect, test, type Page } from "./fixtures";
import { Navigation, distance } from "../src/game/navigation";
import { WORLDS, worldObstacles } from "../src/game/world/worlds";

const entry = "/scripts/playtest.html";
const heroes = [
  { race: "Mędrcy", world: "aether", actor: "hero-sage", texture: "hero-sage-page" },
  {
    race: "Planetarni",
    world: "verdant",
    actor: "hero-planetary",
    texture: "hero-planetary-page",
  },
] as const;

async function playerPosition(page: Page) {
  return page.locator(".ki-canvas").evaluate((el) => ({
    x: Number((el as HTMLElement).dataset["playerX"]),
    y: Number((el as HTMLElement).dataset["playerY"]),
  }));
}

// This suite exercises the actual renderer in software WebGL. It deliberately
// does not set frame-rate or 180ms travel-distance targets on SwiftShader;
// comprehensive eight-direction input tests still run in the full Canvas suite.
for (const hero of heroes) {
  for (const width of [1280, 390]) {
    test(`software WebGL loads and moves ${hero.race} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(entry + (hero.world === "verdant" ? "?ki-hero-art=1" : ""));
      await page.getByRole("button", { name: `Wybierz: ${hero.race}`, exact: true }).click();
      await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();

      const actor = page.locator(".ki-canvas");
      await expect(actor).toHaveAttribute("data-world", hero.world);
      await expect(actor).toHaveAttribute("data-actor-visual", hero.actor);
      await expect(actor).toHaveAttribute("data-texture-ids", new RegExp(hero.texture));
      await expect(actor).toHaveAttribute("data-animation-frame", new RegExp(`^${hero.actor}/idle/`));
      await expect(actor).toHaveAttribute("data-metrics", /.+/);
      await expect
        .poll(async () => {
          const metrics = await actor.getAttribute("data-metrics");
          return metrics ? (JSON.parse(metrics) as { renderer: string }).renderer : null;
        })
        .toBe("WebGL");

      const world = WORLDS[hero.world];
      const nav = new Navigation(world.width, world.height, worldObstacles(world));
      const before = await playerPosition(page);
      const offsets = [
        [100, 0],
        [0, 100],
        [-100, 0],
        [0, -100],
        [70, 70],
        [-70, 70],
        [70, -70],
        [-70, -70],
      ];
      const target = offsets
        .map(([dx, dy]) => ({ x: before.x + dx!, y: before.y + dy! }))
        .find((point) => nav.walkable(point) && nav.path(before, point).length > 0);
      expect(target).toBeDefined();
      await actor.evaluate((el, point) => {
        el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", ...point } }));
      }, target!);

      await expect
        .poll(async () => distance(before, await playerPosition(page)), { timeout: 60000 })
        .toBeGreaterThan(5);
      await expect
        .poll(() => actor.getAttribute("data-animation-frame"), { timeout: 30000 })
        .toMatch(new RegExp(`^${hero.actor}/(walk|idle)/`));
      expect(errors).toEqual([]);
    });
  }
}
