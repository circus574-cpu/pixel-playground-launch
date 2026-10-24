import { test as base } from "@playwright/test";
import { readFileSync } from "node:fs";
import { browserNavigation, type GridData } from "../src/game/world/generated/browserTerrain";
import type { Obstacle } from "../src/game/movement";
import { MONSTER_BASE } from "../src/game/monsters/base.generated";
import { monsterDef } from "../src/game/monsters/catalog";
import { expect } from "@playwright/test";
export { expect };
export type { Page, CDPSession } from "@playwright/test";
/** Attach failures without modifying the game or assuming a browser failure proves a game bug. */
export const test = base.extend<{ diagnostics: void }>({
  diagnostics: [
    async ({ page }, use, info) => {
      const logs: string[] = [];
      page.on("console", (m) => {
        if (["error", "warning"].includes(m.type())) logs.push(m.type() + ": " + m.text());
      });
      page.on("pageerror", (error) => logs.push("pageerror: " + error.message));
      await use();
      if (info.status !== info.expectedStatus) {
        const observed = await page
          .evaluate(() => {
            const el = document.querySelector<HTMLElement>(".ki-canvas");
            return {
              url: location.href,
              viewport: [innerWidth, innerHeight],
              canvas: el ? { ...el.dataset } : null,
            };
          })
          .catch(() => null);
        await info.attach("game-failure-context", {
          body: JSON.stringify(
            {
              test: info.title,
              expected: info.expectedStatus,
              actual: info.status,
              errors: info.errors,
              observed,
              logs,
            },
            null,
            2,
          ),
          contentType: "application/json",
        });
        if (!page.isClosed())
          await info.attach("game-failure-screenshot", {
            body: await page.screenshot().catch(() => Buffer.alloc(0)),
            contentType: "image/png",
          });
      }
    },
    { auto: true },
  ],
});

/** Mobile tools are deliberately folded; follow the same taps as a player. */
export async function openHudTool(
  page: import("@playwright/test").Page,
  name: string,
  input: "mouse" | "touch" = "mouse",
) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible())) {
    const menu = page.getByRole("button", { name: "Menu gry", exact: true });
    if (input === "touch") await menu.tap();
    else await menu.click();
  }
  if (input === "touch") await button.tap();
  else await button.click();
  const toggle = page.getByRole("button", { name: "Menu gry", exact: true });
  if (
    (name === "Oddal mapę" || name === "Przybliż mapę") &&
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) === "true"
  )
    await toggle.click();
}

export const SAVE_BASE = "ki-legends:adventure:v1";
/** Character slots of the single Superior world (owner-authorised reset of the older slots). */
export const WORLD_SAVE = SAVE_BASE + ":superior-world-v1";
const superior = JSON.parse(readFileSync("public/game/worlds/superior-v1/index.json", "utf8")) as {
  features: { id: string; arrival: { x: number; y: number } }[];
};
/** Where a new character of this land appears on the Superior planet. */
export const superiorArrival = (land: string) =>
  superior.features.find((f) => f.id === land)!.arrival;
/**
 * The generated land as the browser sees it: real size, the player navigation
 * field built from the same CPU grids, the safe arrival and authored spawn slots.
 */
export function superiorLand(land: string) {
  const dir = `public/game/worlds/superior-v1/${land}/`,
    read = (f: string) => JSON.parse(readFileSync(dir + f, "utf8")) as unknown;
  const { geometry } = read("world.json") as { geometry: { width: number; height: number } };
  const colliders = read("collision.json") as Obstacle[];
  const nav = browserNavigation(
    geometry.width,
    geometry.height,
    read("navigation.json") as GridData,
    read("terrain.json") as GridData,
    colliders,
  );
  const { overworld } = read("spawns.json") as {
    overworld: { id: string; x: number; y: number }[];
  };
  const { npcs } = read("world.json") as { npcs: { id: string; x: number; y: number }[] };
  return {
    colliders,
    npcs,
    width: geometry.width,
    height: geometry.height,
    nav,
    spawn: nav.safe(superiorArrival(land)),
    enemies: overworld,
  };
}
/** Attack of the weakest creature that can defeat a first-level hero within a test (not the capital slimes). */
export const DEFEAT_ATTACK = 12;
type SpawnSlot = { id: string; kind: string; x: number; y: number };
/** A creature that stays visible and in reach (no hiding, burrowing, fleeing or standing still). */
const VOLATILE = ["ambush", "burrow", "dive", "fleeAfterHits", "ghost", "still"];
function steady(kind: string, also: string[] = []) {
  const t = monsterDef(kind).traits as Record<string, unknown>;
  return ![...VOLATILE, ...also].some((k) => t[k]);
}
/** Authored overworld spawn slots of a land, nearest to its arrival first; live enemies share the ids. */
function spawnsByDistance(land: string) {
  const a = superiorArrival(land);
  const { overworld } = JSON.parse(
    readFileSync(`public/game/worlds/superior-v1/${land}/spawns.json`, "utf8"),
  ) as { overworld: SpawnSlot[] };
  const far = (s: SpawnSlot) => Math.hypot(s.x - a.x, s.y - a.y);
  return [...overworld].sort((p, q) => far(p) - far(q));
}
/**
 * The spawn slot nearest to a land's arrival. `minAttack` skips the harmless first-level creatures
 * beside the capital when a test needs a real defeat.
 */
export function nearestSpawn(land: string, minAttack = 0) {
  const base = new Map(MONSTER_BASE.map((m) => [m.id, m]));
  return spawnsByDistance(land).find((s) => {
    const atk = base.get(s.kind)?.atk ?? 0;
    // Strong enough to defeat a first-level hero, but not in one or two hits before the potion.
    // It must also attack a passive hero unprovoked.
    return !minAttack || (atk >= minAttack && atk <= minAttack * 3 && steady(s.kind, ["provoked"]));
  })!;
}
/** The nearest creature that notices and chases a hero on its own (not a provoked-only slime). */
export function nearestHunter(land: string) {
  return spawnsByDistance(land).find((s) => steady(s.kind, ["provoked"]))!;
}
/** The nearest distinct first-level creatures a new hero can defeat for the hunt quest. */
export function huntTargets(land: string, count: number) {
  const base = new Map(MONSTER_BASE.map((m) => [m.id, m]));
  return spawnsByDistance(land)
    .filter((s) => (base.get(s.kind)?.level ?? 99) <= 1 && steady(s.kind, ["pack"]))
    .slice(0, count);
}
/** Basic attack of the active race (Cios Szlaku, Pocisk Ki, Strzał Impulsowy, Uderzenie Żaru). */
export const basicAttack = (page: import("@playwright/test").Page) =>
  page.locator('button[data-ability="R"]');
/** Current maximum HP shown by the HUD (it depends on the race and level). */
export async function maxHp(page: import("@playwright/test").Page) {
  return String(
    await page.getByRole("meter", { name: "Zdrowie", exact: true }).getAttribute("aria-valuemax"),
  );
}
/**
 * Rewrites fields of the active character's save and reloads, so the game reads an ordinary save.
 * The specs use this for states that need many minutes of play (a learned skill needs a level);
 * the old tab refuses to overwrite a save that changed behind its back, so the patch survives.
 */
export async function patchActiveCharacter(
  page: import("@playwright/test").Page,
  patch: Record<string, unknown>,
) {
  await page.evaluate(
    ({ base, patch }) => {
      const key = base + ":character:" + localStorage.getItem(base + ":active-character");
      const raw = JSON.parse(localStorage.getItem(key)!);
      Object.assign(raw.player, patch);
      localStorage.setItem(key, JSON.stringify(raw));
    },
    { base: WORLD_SAVE, patch },
  );
  await page.reload();
  await base_expectHud(page);
}
async function base_expectHud(page: import("@playwright/test").Page) {
  const { expect } = await import("@playwright/test");
  await expect(page.locator(".ki-hud")).toBeVisible();
}
/** Learns a skill-tree node through the real "Umiejętności" panel. */
export async function learnSkill(page: import("@playwright/test").Page, name: string) {
  await openHudTool(page, "Umiejętności");
  await page
    .getByRole("article", { name, exact: true })
    .getByRole("button", { name: /Poznaj/ })
    .click();
  await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
}

/** Nothing hostile may stand inside a safe settlement; wild creatures live beyond its border. */
export async function expectCityClear(canvas: import("@playwright/test").Locator) {
  const { expect } = await import("@playwright/test");
  const land = (await canvas.getAttribute("data-world")) ?? "verdant";
  const world = JSON.parse(
    readFileSync(`public/game/worlds/superior-v1/${land}/world.json`, "utf8"),
  ) as { settlements: { bounds: { x: number; y: number; width: number; height: number } }[] };
  const list = JSON.parse((await canvas.getAttribute("data-enemies")) ?? "[]") as {
    x: number;
    y: number;
  }[];
  const inside = (e: { x: number; y: number }) =>
    world.settlements.some(
      ({ bounds: b }) => e.x >= b.x && e.x <= b.x + b.width && e.y >= b.y && e.y <= b.y + b.height,
    );
  expect(list.filter(inside)).toEqual([]);
}
