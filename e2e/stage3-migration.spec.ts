import { openHudTool } from "./fixtures";
import { test, expect } from "./fixtures";
const path =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
test("C: an archival Stage 2 save stays untouched and is never offered in the Superior world", async ({
  page,
}) => {
  // Owner-authorised reset: older slots remain archival, never active or migrated.
  const raw = JSON.stringify({
    version: 1,
    revision: "stage2-fixture",
    player: {
      level: 1,
      xp: 40,
      hp: 120,
      ki: 50,
      gold: 177,
      x: 1572,
      y: 1160.5,
      items: { potion: 3, tusk: 0, sword: 0, vest: 0 },
      weapon: null,
      armor: null,
      upgrade: 0,
      quests: { steps: "done", boars: "locked", gear: "locked" },
      visited: true,
      kills: 0,
      cooldowns: { flame: 0, pulse: 0, shield: 0, attack: 0, potion: 0 },
      shield: 0,
      dead: false,
    },
  });
  await page.addInitScript((value) => {
    if (localStorage.getItem("ki-legends:adventure:v1") === null)
      localStorage.setItem("ki-legends:adventure:v1", value);
  }, raw);
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("ZACHOWANY ZAPIS ETAPU 2")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kontynuuj podróż", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator('.ki-canvas[data-world="verdant"]')).toBeVisible();
  await expect(page.locator(".ki-player-name")).toContainText("PLANETARNI");
  const state = await page.evaluate(() => {
    const base = "ki-legends:adventure:v1:superior-world-v1";
    const id = localStorage.getItem(base + ":active-character");
    return {
      original: localStorage.getItem("ki-legends:adventure:v1"),
      fresh: JSON.parse(localStorage.getItem(base + ":character:" + id) ?? "null"),
    };
  });
  expect(state.original).toBe(raw);
  expect(state.fresh.format).toBe("superior-character");
  expect(state.fresh.player.level).toBe(1);
  expect(state.fresh.player.gold).not.toBe(177);
  await openHudTool(page, "Ustawienia");
  await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
  await page.getByRole("button", { name: "Nowa podróż", exact: true }).click();
  await page.getByRole("button", { name: "Wybierz: Mędrcy", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator('.ki-canvas[data-world="aether"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ki-legends:adventure:v1"))).toBe(raw);
});
