import { test as base } from "@playwright/test";
import { readFileSync } from "node:fs";
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
