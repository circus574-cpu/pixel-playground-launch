import { test, expect } from "@playwright/test";
const path =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
test("C: a real v1 fixture migrates in the browser without changing the original", async ({
  page,
}) => {
  // A legacy fixture is necessary here: the current UI writes only v3. It is isolated to this context.
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
  await expect(page.locator(".ki-slot")).toContainText("ZACHOWANY ZAPIS ETAPU 2");
  await page.getByRole("button", { name: "Kontynuuj podróż", exact: true }).click();
  await expect(page.locator('.ki-canvas[data-world="verdant"]')).toBeVisible();
  await expect(page.locator(".ki-player-name")).toContainText("PLANETARNI");
  await page.getByRole("button", { name: /Rozmowa · Aira/ }).click();
  await expect(page.getByRole("dialog", { name: "Rozmowa: Aira", exact: true })).toBeVisible();
  const state = await page.evaluate(() => ({
    original: localStorage.getItem("ki-legends:adventure:v1"),
    migrant: JSON.parse(localStorage.getItem("ki-legends:adventure:v1:character:legacy") ?? "null"),
  }));
  expect(state.original).toBe(raw);
  expect(state.migrant.version).toBe(3);
  expect(state.migrant.player.race).toBe("planetary");
  expect(state.migrant.player.gold).toBe(177);
  expect(state.migrant.player.quests.steps).toBe("done");
  await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
  await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
  await page.getByRole("button", { name: "Nowa podróż", exact: true }).click();
  await page.getByRole("button", { name: "Wybierz: Mędrcy", exact: true }).click();
  await expect(page.locator('.ki-canvas[data-world="aether"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ki-legends:adventure:v1"))).toBe(raw);
});
