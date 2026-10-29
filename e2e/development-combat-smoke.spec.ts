import { test, expect, basicAttack } from "./fixtures";
import { readFileSync } from "node:fs";
import { browserNavigation, type GridData } from "../src/game/world/generated/browserTerrain";
import type { Obstacle } from "../src/game/movement";
import { MONSTER_BASE } from "../src/game/monsters/base.generated";
import { monsterDef } from "../src/game/monsters/catalog";
const indexV2 = JSON.parse(readFileSync("public/game/worlds/superior-v2/index.json", "utf8")) as {
  features: { id: string; arrival: { x: number; y: number } }[];
};
function currentLand(id: string) {
  const root = `public/game/worlds/superior-v2/${id}/`;
  const read = (name: string) => JSON.parse(readFileSync(root + name, "utf8")) as unknown;
  const source = read("world.json") as { geometry: { width: number; height: number } };
  const nav = browserNavigation(
    source.geometry.width,
    source.geometry.height,
    read("navigation.json") as GridData,
    read("terrain.json") as GridData,
    read("collision.json") as Obstacle[],
  );
  const arrival = indexV2.features.find((f) => f.id === id)!.arrival;
  const slots = (
    read("spawns.json") as { overworld: { id: string; kind: string; x: number; y: number }[] }
  ).overworld;
  const levels = new Map(MONSTER_BASE.map((m) => [m.id, m.level]));
  const candidates = slots
    .filter((s) => {
      const traits = monsterDef(s.kind).traits;
      return (
        levels.get(s.kind) === 1 &&
        !traits.pack &&
        !traits.ambush &&
        !traits.burrow &&
        !traits.ghost &&
        !traits.still &&
        !traits.dive &&
        !traits.fleeAfterHits
      );
    })
    .sort(
      (a, b) =>
        Math.hypot(a.x - arrival.x, a.y - arrival.y) - Math.hypot(b.x - arrival.x, b.y - arrival.y),
    );
  return { nav, arrival, slot: candidates[0]! };
}
import { RACES, RACE_IDS } from "../src/game/world/races";
for (const race of RACE_IDS)
  test(`fresh ${race}: walk out and hit an actual streamed creature without save patches`, async ({
    page,
  }, info) => {
    test.setTimeout(360000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: "Wybierz: " + RACES[race].name, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    const health = page.getByRole("meter", { name: "Zdrowie", exact: true });
    const maximumHp = Number(await health.getAttribute("aria-valuemax"));

    await expect(page.locator("html")).toHaveAttribute("data-ki-world-v2", "1");
    const { nav, arrival, slot } = currentLand(RACES[race].world);
    expect(slot).toBeDefined();
    expect(
      Math.hypot(
        Number(await canvas.getAttribute("data-player-x")) - arrival.x,
        Number(await canvas.getAttribute("data-player-y")) - arrival.y,
      ),
    ).toBeLessThan(30);
    const destination = nav.safe({ x: slot.x + 35, y: slot.y });
    expect(
      nav.path(arrival, destination).length,
      "actual v2 route to the authored creature",
    ).toBeGreaterThan(0);
    // This is the same production command emitted by a world click. It walks with A*, never teleports.
    await canvas.evaluate(
      (node, point) =>
        node.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", ...point } })),
      destination,
    );
    await expect
      .poll(
        async () =>
          Math.hypot(
            Number(await canvas.getAttribute("data-player-x")) - destination.x,
            Number(await canvas.getAttribute("data-player-y")) - destination.y,
          ),
        { timeout: 180000 },
      )
      .toBeLessThan(110);
    type Enemy = { id: string; x: number; y: number; hp: number; mode: string };
    const enemies = async () =>
      JSON.parse((await canvas.getAttribute("data-enemies")) ?? "[]") as Enemy[];
    await expect
      .poll(async () => (await enemies()).some((e) => e.id === slot.id && e.hp > 0), {
        timeout: 60000,
      })
      .toBe(true);
    const before = (await enemies()).find((e) => e.id === slot.id)!;
    for (const offset of [-25, -8, 8]) {
      const list = await enemies(),
        enemy = list.find((e) => e.id === slot.id && e.hp > 0);
      if (!enemy) break;
      const box = (await canvas.boundingBox())!,
        zoom = Number(await canvas.getAttribute("data-camera-zoom"));
      const sx = Number(await canvas.getAttribute("data-camera-x")),
        sy = Number(await canvas.getAttribute("data-camera-y"));
      const x = (enemy.x - sx - box.width / 2) * zoom + box.width / 2;
      const y = (enemy.y + offset - sy - box.height / 2) * zoom + box.height / 2;
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(box.width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(box.height);
      await page.mouse.click(box.x + x, box.y + y);
      if ((await canvas.getAttribute("data-target-id")) === slot.id) break;
    }
    await basicAttack(page).click();
    await expect
      .poll(
        async () => {
          const enemy = (await enemies()).find((e) => e.id === slot.id);
          return enemy ? enemy.hp : before.hp; // Disappearing is not proof of damage.
        },
        { timeout: 60000 },
      )
      .toBeLessThan(before.hp);
    await expect
      .poll(async () => Number(await health.getAttribute("aria-valuenow")), { timeout: 60000 })
      .toBeLessThan(maximumHp);
    await page.screenshot({ path: info.outputPath(`${race}-fresh-real-combat.png`) });
    expect(errors).toEqual([]);
  });
