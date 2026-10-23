import { basicAttack, learnSkill, openHudTool } from "./fixtures";
import { test, expect, type Page } from "./fixtures";
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
async function clickWorld(page: Page, x: number, y: number) {
  const point = await page.locator(".ki-canvas").evaluate(
    (el, { x, y }) => {
      const zoom = Number((el as HTMLElement).dataset["zoom"] ?? 0.62),
        px = Number((el as HTMLElement).dataset["playerX"]),
        py = Number((el as HTMLElement).dataset["playerY"]);
      const width = el.clientWidth,
        height = el.clientHeight;
      const scrollX = Math.max(0, Math.min(3072 - width / zoom, px - width / zoom / 2)),
        scrollY = Math.max(0, Math.min(2048 - height / zoom, py - height / zoom / 2));
      return { x: (x - scrollX) * zoom, y: (y - scrollY) * zoom };
    },
    { x, y },
  );
  await page.locator("canvas").click({ position: point });
}

test("D: real forest UI — Ren, three boars, skill tree, XP, loot, merchant, smith and reload", async ({
  page,
}, info) => {
  test.setTimeout(480000);
  page.setDefaultTimeout(30000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator('.ki-canvas[data-world="verdant"]')).toBeVisible();
  await page.getByRole("button", { name: /Rozmowa · Aira/ }).click();
  await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
  await page.getByRole("button", { name: "Podejdź do rynku", exact: true }).click();
  await expect
    .poll(async () => (await saved(page))?.quests.steps, { timeout: 120000 })
    .toBe("ready");
  await openHudTool(page, "Dziennik");
  await page.getByRole("button", { name: "Idź do Airy", exact: true }).click();
  await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
  await close(page);
  await visit(page, "Idź do Ren · Strażnik lasu");
  await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
  await close(page);
  console.log("PVE: Ren quest accepted");
  // Click the actual body on the rendered canvas. Read-only coordinates determine camera space.
  // Small search offsets accommodate ordinary patrol motion; there is no state injection.
  const homes = [
    [2050, 1030],
    [2100, 1620],
    [1850, 1800],
  ];
  for (let index = 0; index < 3; index++) {
    const [hx, hy] = homes[index]!;
    await clickWorld(page, hx! - 130, hy! + 90);
    await page.waitForTimeout(1800);
    let targeted = false;
    for (const [dx, dy] of [
      [0, -40],
      [-40, -40],
      [40, -40],
      [0, 5],
      [-40, 5],
      [40, 5],
    ]) {
      if (await page.locator(".ki-target").count()) {
        targeted = true;
        break;
      }
      await clickWorld(page, hx! + dx!, hy! + dy!);
      await page.waitForTimeout(250);
    }
    if (!targeted) targeted = (await page.locator(".ki-target").count()) > 0;
    expect(targeted, "cannot select rendered boar " + index).toBe(true);
    const ki = (await saved(page)).ki;
    // Range is intentionally checked by the game. Autoattack continues while skills are pressed.
    for (let attempt = 0; attempt < 40; attempt++) {
      if ((await saved(page)).kills > index) break;
      const attack = basicAttack(page);
      if (await attack.isEnabled()) await attack.click();
      await page.waitForTimeout(500);
    }
    await expect.poll(async () => (await saved(page)).kills, { timeout: 60000 }).toBe(index + 1);
    await page.getByRole("button", { name: /Podnieś łup/ }).click();
    await expect
      .poll(async () => (await saved(page)).items.tusk, { timeout: 30000 })
      .toBe(index + 1);
    console.log("PVE: boar and loot", index + 1, "KI before", ki);
    await page.screenshot({ path: info.outputPath("combat-loot-" + index + ".png") });
  }
  // Three kills plus the first quest reach level 2: spend the new skill point through the real panel,
  // then use the learned skill and verify that it spends KI.
  expect((await saved(page)).level).toBeGreaterThanOrEqual(2);
  await learnSkill(page, "Szybki Unik");
  const kiMeter = page.getByRole("meter", { name: "Energia KI", exact: true });
  const kiBefore = Number(await kiMeter.getAttribute("aria-valuenow"));
  await page.getByRole("button", { name: "Szybki Unik", exact: true }).click();
  await expect
    .poll(async () => Number(await kiMeter.getAttribute("aria-valuenow")))
    .toBeLessThan(kiBefore - 4);
  expect((await saved(page)).skills).toContain("A1");
  await visit(page, "Idź do Ren · Strażnik lasu");
  await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
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
  await page.getByRole("button", { name: "Kup · 8", exact: true }).click();
  await page.getByRole("button", { name: "Sprzedaj · 5", exact: true }).click();
  await page.getByRole("button", { name: "Kup · 25", exact: true }).click();
  await close(page);
  await openHudTool(page, "Ekwipunek");
  await page.getByRole("button", { name: "Załóż", exact: true }).click();
  await expect(page.getByRole("button", { name: "Zdejmij pancerz", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
  await openHudTool(page, "Ustawienia");
  await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
  await page.getByRole("button", { name: "Kontynuuj podróż", exact: true }).click();
  const before = await saved(page);
  expect(before.quests).toEqual({ steps: "done", boars: "done", gear: "done" });
  expect(before.upgrade).toBe(1);
  expect(before.armor).toBe("vest");
  expect(before.level).toBeGreaterThanOrEqual(2);
  expect(before.items.tusk).toBe(2);
  await page.reload();
  await expect(page.locator('.ki-canvas[data-world="verdant"]')).toBeVisible();
  const after = await saved(page);
  expect(after.quests).toEqual(before.quests);
  expect(after.items).toEqual(before.items);
  expect(after.gold).toBe(before.gold);
  expect(errors).toEqual([]);
});
