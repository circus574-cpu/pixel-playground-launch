import { test, expect, openHudTool } from "./fixtures";
import { RACE_IDS, RACES } from "../src/game/world/races";
import { newPlayer } from "../src/game/session";
import { skillId, NODES } from "../src/game/progression/catalog";
const path =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");

async function expectRenderer(page: import("@playwright/test").Page, project: string) {
  await expect
    .poll(async () => {
      const raw = await page.locator(".ki-canvas").getAttribute("data-metrics");
      return raw ? JSON.parse(raw).renderer : null;
    })
    .toBe(project === "software-webgl" ? "WebGL" : "Canvas");
}

for (const race of RACE_IDS)
  for (const mobile of [false, true]) {
    test(`${race}: progression UI, learning, allocation and reload (${mobile ? "mobile" : "desktop"})`, async ({
      page,
    }, info) => {
      await page.setViewportSize(
        mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      );
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const player = newPlayer(race);
      player.level = 20;
      // Explicit saved-character fixture to exercise migration and level-gated UI.
      // This is not evidence of earning 20 levels through PvE.
      const original = JSON.stringify({ version: 3, revision: "e2e-source", player });
      await page.addInitScript(
        ({ original }) => {
          const base = "ki-legends:adventure:v1",
            key = base + ":character:progression-qa";
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, original);
            localStorage.setItem(base + ":active-character", "progression-qa");
          }
        },
        { original },
      );
      await page.goto(path);
      await expect(page.locator("canvas")).toBeVisible();
      await expect(page.locator(".ki-hud")).toBeVisible();
      await expectRenderer(page, info.project.name);
      await openHudTool(page, "Rozwój postaci");
      const dialog = page.getByRole("dialog", { name: "Rozwój postaci", exact: true });
      await expect(dialog).toBeVisible();
      await page.getByRole("button", { name: "Włącz rozwój rasy", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Włącz rozwój rasy", exact: true }),
      ).toHaveCount(0);
      await expect(page.locator(".ki-skill-points strong")).toHaveText("19");
      const first = NODES[skillId(race, "A1")]!;
      await dialog.getByRole("button", { name: first.name + " · poziom 2", exact: true }).click();
      await dialog.getByRole("button", { name: /Naucz się/ }).click();
      await expect(page.locator(".ki-skill-points strong")).toHaveText("18");
      await expect(dialog.locator(".ki-skill-learned")).toHaveText(/poznana/);
      await expect(dialog.getByLabel("Umiejętność na miejscu 1")).toHaveValue(first.id);
      for (const other of RACE_IDS) {
        await dialog.getByRole("button", { name: new RegExp("^" + RACES[other].name) }).click();
        await expect(dialog.locator(".ki-tree-intro h2")).toHaveText(RACES[other].name);
      }
      await dialog.getByRole("button", { name: new RegExp("^" + RACES[race].name) }).click();
      await expect(dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).resolves.toBe(true);
      await dialog.getByRole("tab", { name: "Statystyki", exact: true }).click();
      await dialog.getByLabel("Poziom podglądu statystyk").fill("20");
      await expect(dialog.locator(".ki-growth-level strong")).toHaveText("20");
      await dialog.getByRole("tab", { name: "Drzewko", exact: true }).click();
      await dialog.evaluate((e) => {
        e.scrollTop = 0;
      });
      await page.screenshot({
        path: info.outputPath(`${race}-${mobile ? "mobile" : "desktop"}.png`),
      });
      await page.getByRole("button", { name: "Wróć do gry", exact: true }).click();
      await expect(
        page.getByRole("navigation", { name: "Umiejętności rasy", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: first.name, exact: true })).toBeVisible();
      const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("ki-legends:adventure:v1:character:progression-qa")!),
      );
      expect(saved.version).toBe(4);
      expect(saved.player.progression.learned).toContain(first.id);
      expect(
        await page.evaluate(() =>
          localStorage.getItem(
            "ki-legends:recovery:before-v4:ki-legends:adventure:v1:character:progression-qa",
          ),
        ),
      ).toBe(original);
      await page.reload();
      await expect(page.locator(".ki-hud")).toBeVisible();
      await openHudTool(page, "Rozwój postaci");
      await expect(page.locator(".ki-skill-points strong")).toHaveText("18");
      await expect(page.getByLabel("Umiejętność na miejscu 1")).toHaveValue(first.id);
      expect(errors).toEqual([]);
    });
  }

test("new character opens the four-race planner without granting levels or spending points", async ({
  page,
}) => {
  await page.goto(path);
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
  await openHudTool(page, "Rozwój postaci");
  await page.getByRole("tab", { name: "Statystyki", exact: true }).click();
  await page.getByLabel("Poziom podglądu statystyk").fill("20");
  await page.getByRole("button", { name: "Wróć do gry", exact: true }).click();
  await expect(page.locator(".ki-level")).toHaveText("1");
});

for (const race of RACE_IDS) {
  test(`${race}: real movement, learned skill and enemy defeat with racial rules`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const player = newPlayer(race, true);
    player.level = 2;
    const { learnSkill } = await import("../src/game/progression/model");
    learnSkill(race, 2, player.progression!, skillId(race, "A1"));
    const raw = JSON.stringify({ version: 4, revision: "combat-fixture-level-2", player });
    await page.addInitScript(
      ({ raw }) => {
        const base = "ki-legends:adventure:v1",
          key = base + ":character:combat-qa";
        localStorage.setItem(key, raw);
        localStorage.setItem(base + ":active-character", "combat-qa");
      },
      { raw },
    );
    await page.goto(path);
    await expect(page.locator(".ki-hud")).toBeVisible();
    await expectRenderer(page, info.project.name);
    const { WORLDS } = await import("../src/game/world/worlds");
    const home = WORLDS[RACES[race].world].enemies[0]!;
    await page
      .locator(".ki-canvas")
      .evaluate(
        (el, home) =>
          el.dispatchEvent(
            new CustomEvent("ki:command", { detail: { type: "move", x: home.x - 100, y: home.y } }),
          ),
        home,
      );
    await expect
      .poll(
        async () =>
          page.locator(".ki-canvas").evaluate((el, home) => {
            const d = (el as HTMLElement).dataset;
            return Math.hypot(Number(d["playerX"]) - (home.x - 100), Number(d["playerY"]) - home.y);
          }, home),
        { timeout: 60000 },
      )
      .toBeLessThan(90);
    // Use the same production targeting adapter as the canvas. This isolates
    // combat from camera/coordinate sampling lag under software WebGL.
    await page
      .locator(".ki-canvas")
      .evaluate((el) =>
        el.dispatchEvent(
          new CustomEvent("ki:command", { detail: { type: "target", id: "boar-0" } }),
        ),
      );
    await expect(page.getByRole("region", { name: "Wybrany przeciwnik" })).toBeVisible();
    await page.getByRole("button", { name: NODES[skillId(race, "A1")]!.name, exact: true }).click();
    await expect
      .poll(
        async () =>
          page
            .locator(".ki-canvas")
            .evaluate((el) => JSON.parse((el as HTMLElement).dataset["enemies"]!)[0].hp),
        { timeout: 30000 },
      )
      .toBe(0);
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("ki-legends:adventure:v1:character:combat-qa")!),
    );
    expect(saved.player.xp).toBe(20);
    expect(saved.player.progression.cooldowns[skillId(race, "A1")]).toBeGreaterThan(0);
  });
}

for (const size of [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 852, height: 393 },
]) {
  test(`racial HUD touch geometry ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    const player = newPlayer("android", true);
    const raw = JSON.stringify({ version: 4, revision: "hud-fixture", player });
    await page.addInitScript(
      ({ raw }) => {
        const base = "ki-legends:adventure:v1";
        localStorage.setItem(base + ":character:hud-qa", raw);
        localStorage.setItem(base + ":active-character", "hud-qa");
      },
      { raw },
    );
    await page.goto(path);
    await expect(page.locator(".ki-hud")).toBeVisible();
    const bar = (await page.locator(".ki-race-actionbar").boundingBox())!;
    const menu = (await page.getByRole("button", { name: "Menu gry", exact: true }).boundingBox())!;
    expect(menu.y + menu.height).toBeLessThanOrEqual(bar.y);
    expect(bar.x).toBeGreaterThanOrEqual(0);
    expect(bar.x + bar.width).toBeLessThanOrEqual(size.width);
    for (const button of await page.locator(".ki-race-skill").all()) {
      const b = (await button.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    const hp = (await page.getByRole("meter", { name: "Zdrowie", exact: true }).boundingBox())!;
    const ki = (await page.getByRole("meter", { name: "Energia KI", exact: true }).boundingBox())!;
    expect(hp.y + hp.height).toBeLessThanOrEqual(ki.y);
    await openHudTool(page, "Rozwój postaci");
    await expect(page.getByRole("dialog", { name: "Rozwój postaci", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
  });
}
