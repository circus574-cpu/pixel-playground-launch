import { basicAttack, learnSkill, openHudTool } from "./fixtures";
import { test, expect, type Page } from "./fixtures";
import { RACES, type RaceId } from "../src/game/world/races";
import { WORLDS } from "../src/game/world/worlds";

// End-to-end PvE for the three worlds not covered by stage3-pve.spec.ts.
// All interactions go through the actual game UI or its production movement adapter.
// No save manipulation, injected kills, fake loot, or bypassed combat.
const races: {
  id: RaceId;
  guide: string;
  guideGo?: string;
  /** Smallest KI drop that proves the skill was cast (Szybki Unik costs 8). */
  minSpend?: number;
  hunter: string;
  skill: string;
}[] = [
  {
    id: "planetary",
    guide: "Aira",
    guideGo: "Airy",
    hunter: "Ren",
    skill: "Szybki Unik",
    minSpend: 6,
  },
  {
    id: "sage",
    guide: "Sora",
    hunter: "Ishin",
    skill: "Świetlista Bariera",
  },
  {
    id: "android",
    guide: "LYRA-7",
    hunter: "AXON",
    skill: "Tarcza Plazmowa",
  },
  {
    id: "legend",
    guide: "Kaena",
    hunter: "Rokan",
    skill: "Wybuch Ki",
  },
];
const npcName = (world: (typeof WORLDS)[keyof typeof WORLDS], id: string) =>
  world.npcs.find((n) => n.id === id)!.name;
const path =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
async function state(page: Page) {
  return page.evaluate(() => {
    const key = "ki-legends:adventure:v1";
    const id = localStorage.getItem(key + ":active-character");
    return JSON.parse(localStorage.getItem(key + ":character:" + id) ?? "null")?.player;
  });
}
async function visit(page: Page, name: string) {
  await page.getByRole("button", { name: "Otwórz mapę świata", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
  // Shopkeepers stand inside their buildings: the walk through the door can take a while.
  await expect(page.getByRole("dialog", { name: /Rozmowa:/ })).toBeVisible({ timeout: 120000 });
}
async function close(page: Page) {
  await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
}
async function move(page: Page, x: number, y: number) {
  await page.locator(".ki-canvas").evaluate(
    (el, p) => {
      el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", x: p.x, y: p.y } }));
    },
    { x, y },
  );
  await expect
    .poll(
      async () => {
        const p = await state(page);
        return Math.hypot(p.x - x, p.y - y);
      },
      { timeout: 90000 },
    )
    .toBeLessThan(95);
}
async function clickRenderedEnemy(page: Page, id: string, offsetY: number) {
  const point = await page.locator(".ki-canvas").evaluate(
    (el, p) => {
      const data = (el as HTMLElement).dataset;
      const enemy = (
        JSON.parse(data["enemies"] ?? "[]") as { id: string; x: number; y: number; hp: number }[]
      ).find((e) => e.id === p.id && e.hp > 0);
      if (!enemy) return null;
      const zoom = Number(data["zoom"] ?? 0.62);
      // Phaser zooms around the camera centre, not the top-left scroll origin.
      return {
        x: (enemy.x - Number(data["cameraX"]) - el.clientWidth / 2) * zoom + el.clientWidth / 2,
        y:
          (enemy.y + p.offsetY - Number(data["cameraY"]) - el.clientHeight / 2) * zoom +
          el.clientHeight / 2,
      };
    },
    { id, offsetY },
  );
  if (!point) return;
  const hit = await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.tagName, point);
  expect(hit, "Rendered enemy must be exposed to a real player click").toBe("CANVAS");
  await page.locator("canvas").click({ position: point });
}

for (const race of races) {
  test(`real PvE journey: ${race.id} — quests, 3 kills, loot, equipment, merchant and smith`, async ({
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
    const world = WORLDS[RACES[race.id].world];
    await page.goto(path);
    await page
      .getByRole("button", { name: "Wybierz: " + RACES[race.id].name, exact: true })
      .click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    await expect(page.locator('.ki-canvas[data-world="' + world.id + '"]')).toBeVisible();
    await page.getByRole("button", { name: new RegExp("Rozmowa · " + race.guide) }).click();
    await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
    await close(page);
    await page.getByRole("button", { name: world.market.action, exact: true }).click();
    await expect
      .poll(async () => (await state(page))?.quests.steps, { timeout: 120000 })
      .toBe("ready");
    await openHudTool(page, "Dziennik");
    await page
      .getByRole("button", { name: "Idź do " + (race.guideGo ?? race.guide), exact: true })
      .click();
    await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
    await close(page);
    await visit(
      page,
      "Idź do " + race.hunter + " · " + world.npcs.find((n) => n.id === "hunter")!.role,
    );
    await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
    await close(page);
    expect((await state(page)).quests.boars).toBe("active");
    // Select three distinct, rendered enemies. They are not defeated via test hooks.
    for (let index = 0; index < 3; index++) {
      const enemy = world.enemies[index]!;
      await move(page, enemy.x - 130, enemy.y + 90);
      let selected = false;
      for (const dy of [-30, -20, -40, -10, -25, -35]) {
        if (await page.locator(".ki-target").count()) {
          selected = true;
          break;
        }
        await clickRenderedEnemy(page, "boar-" + index, dy);
        await page.waitForTimeout(300);
      }
      selected ||= (await page.locator(".ki-target").count()) > 0;
      expect(selected, `Unable to target rendered enemy ${index + 1} in ${world.id}`).toBe(true);
      for (let attempt = 0; attempt < 45; attempt++) {
        if ((await state(page)).kills > index) break;
        const button = basicAttack(page);
        if (await button.isEnabled()) await button.click();
        await page.waitForTimeout(450);
      }
      await expect.poll(async () => (await state(page)).kills, { timeout: 60000 }).toBe(index + 1);
      await page.getByRole("button", { name: /Podnieś łup/ }).click();
      await expect
        .poll(async () => (await state(page)).items.tusk, { timeout: 30000 })
        .toBe(index + 1);
      await page.screenshot({
        path: info.outputPath(world.id + "-combat-" + (index + 1) + ".png"),
      });
    }
    // The kills bring level 2: learn the first skill of the race through the real tree panel.
    await learnSkill(page, race.skill);
    const ki = page.getByRole("meter", { name: "Energia KI", exact: true });
    await expect
      .poll(async () => Number(await ki.getAttribute("aria-valuenow")))
      .toBeGreaterThan(15);
    const kiBefore = Number(await ki.getAttribute("aria-valuenow"));
    await page.getByRole("button", { name: race.skill, exact: true }).click();
    await expect
      .poll(async () => Number(await ki.getAttribute("aria-valuenow")))
      .toBeLessThan(kiBefore - (race.minSpend ?? 10));
    const kiSpent = Number(await ki.getAttribute("aria-valuenow"));
    await expect
      .poll(async () => Number(await ki.getAttribute("aria-valuenow")))
      .toBeGreaterThan(kiSpent + 2);
    await visit(
      page,
      "Idź do " + race.hunter + " · " + world.npcs.find((n) => n.id === "hunter")!.role,
    );
    await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
    await close(page);
    await visit(
      page,
      "Idź do " + npcName(world, "smith") + " · " + world.npcs.find((n) => n.id === "smith")!.role,
    );
    await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
    await close(page);
    await openHudTool(page, "Ekwipunek");
    await page.getByRole("button", { name: "Załóż", exact: true }).click();
    await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
    await visit(
      page,
      "Idź do " + npcName(world, "smith") + " · " + world.npcs.find((n) => n.id === "smith")!.role,
    );
    await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
    await page.getByRole("button", { name: "Ulepsz ostrze · 15 monet", exact: true }).click();
    await close(page);
    await visit(
      page,
      "Idź do " +
        npcName(world, "merchant") +
        " · " +
        world.npcs.find((n) => n.id === "merchant")!.role,
    );
    const goldBefore = (await state(page)).gold;
    await page.getByRole("button", { name: "Kup · 8", exact: true }).click();
    expect((await state(page)).gold).toBe(goldBefore - 8);
    await page.getByRole("button", { name: "Sprzedaj · 5", exact: true }).click();
    await page.getByRole("button", { name: "Kup · 25", exact: true }).click();
    await close(page);
    await openHudTool(page, "Ekwipunek");
    await page.getByRole("button", { name: "Załóż", exact: true }).click();
    await expect(page.getByRole("button", { name: "Zdejmij pancerz", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
    const p = await state(page);
    expect(p.quests).toEqual({ steps: "done", boars: "done", gear: "done" });
    expect(p.upgrade).toBe(1);
    expect(p.level).toBeGreaterThanOrEqual(2);
    expect(p.items.tusk).toBe(2);
    expect(p.armor).toBe("vest");
    await page.reload();
    await expect(page.locator(".ki-hud")).toBeVisible();
    const restored = await state(page);
    expect(restored.quests).toEqual(p.quests);
    expect(restored.weapon).toBe("sword");
    expect(restored.armor).toBe("vest");
    expect(restored.items).toEqual(p.items);
    expect(errors).toEqual([]);
  });
}
