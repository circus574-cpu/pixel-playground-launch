import { openHudTool, test, expect, type Page } from "./fixtures";
const path =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
async function saved(page: Page) {
  return page.evaluate(() => {
    const base = "ki-legends:adventure:v1",
      id = localStorage.getItem(base + ":active-character");
    return JSON.parse(localStorage.getItem(base + ":character:" + id) ?? "null")?.player;
  });
}
async function visit(page: Page, name: string) {
  await page.getByRole("button", { name: "Otwórz mapę świata", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Rozmowa:/ })).toBeVisible();
}
async function close(page: Page) {
  await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
}
// Combat/defeat/loot retain their real scenarios in three-races-pve and hero-lifecycle.
// Verdantia is intentionally a safe city now: its progression must use city services.
test("D: real city UI — introduction, first weapon, equipment quest, smith, trade and reload", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(path);
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const canvas = page.locator(".ki-canvas");
  await expect(canvas).toHaveAttribute("data-world", "verdant");
  await expect(canvas).toHaveAttribute("data-enemies", "[]");
  await page.getByRole("button", { name: /Rozmowa · Aira/ }).click();
  await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
  await page.getByRole("button", { name: "Podejdź do rynku", exact: true }).click();
  await expect.poll(async () => (await saved(page))?.quests.steps).toBe("ready");
  await openHudTool(page, "Dziennik");
  await page.getByRole("button", { name: "Idź do Airy", exact: true }).click();
  await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
  await close(page);
  expect((await saved(page)).gold).toBe(60);
  await visit(page, "Idź do Mio · Kupczyni");
  await page.getByRole("button", { name: "Kup · 40", exact: true }).click();
  await close(page);
  await visit(page, "Idź do Taro · Kowal");
  await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
  await close(page);
  await openHudTool(page, "Ekwipunek");
  await page.getByRole("button", { name: "Załóż", exact: true }).click();
  await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
  await visit(page, "Idź do Taro · Kowal");
  await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
  await page.getByRole("button", { name: "Ulepsz ostrze · 15 monet", exact: true }).click();
  await close(page);
  await visit(page, "Idź do Mio · Kupczyni");
  await page.getByRole("button", { name: "Sprzedaj · 3", exact: true }).click();
  await page.getByRole("button", { name: "Kup · 8", exact: true }).click();
  await expect(page.getByRole("button", { name: "Kup · 25", exact: true })).toBeDisabled();
  await close(page);
  const before = await saved(page);
  expect(before.quests).toEqual({ steps: "done", boars: "locked", gear: "done" });
  expect(before.upgrade).toBe(1);
  expect(before.weapon).toBe("sword");
  expect(before.gold).toBe(0);
  expect(before.xp).toBe(80);
  await page.screenshot({ path: info.outputPath("city-progression.png") });
  await page.reload();
  await expect(canvas).toHaveAttribute("data-interior", "shop");
  const after = await saved(page);
  expect(after.quests).toEqual(before.quests);
  expect(after.items).toEqual(before.items);
  expect(after.gold).toBe(before.gold);
  expect(after.upgrade).toBe(1);
  expect(errors).toEqual([]);
});
