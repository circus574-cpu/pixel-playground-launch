import { test, expect, openHudTool, basicAttack, type Page } from "./fixtures";
import { preparedDevelopment } from "../scripts/combat/developmentFixtures";
import { RACES, RACE_IDS } from "../src/game/world/races";
import { FIELDWORK } from "../src/game/development/fieldwork/catalog";
import { DEVELOPMENT_ENCOUNTERS } from "../src/game/development/expeditions/catalog";
import type { Player } from "../src/game/session";

test.use({
  hasTouch: true,
  isMobile: true,
  viewport: { width: 852, height: 393 },
  video: "retain-on-failure",
});
async function saved(page: Page) {
  return page.evaluate(() => {
    const item = Object.entries(localStorage).find(([key, bytes]) => {
      if (key.includes("recovery")) return false;
      try {
        return JSON.parse(bytes).format === "superior-character";
      } catch {
        return false;
      }
    });
    return item ? { key: item[0], value: JSON.parse(item[1]) as { player: Player } } : null;
  });
}
async function openDevelopment(page: Page, tab: "Świat" | "Wyprawy") {
  const closeNpc = page.getByRole("button", { name: "Zamknij rozmowę", exact: true });
  if (await closeNpc.isVisible()) await closeNpc.tap();
  if (!(await page.locator(".ki-development").count())) {
    await openHudTool(page, "Umiejętności", "touch");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).tap();
  }
  await page.getByRole("tab", { name: tab, exact: true }).tap();
}
async function approach(page: Page, kind: "field" | "expedition", id: string) {
  await openDevelopment(page, kind === "field" ? "Świat" : "Wyprawy");
  const card = page.locator(`[data-${kind}-id="${id}"]`),
    canvas = page.locator(".ki-canvas").first();
  const point = {
    x: Number(await card.getAttribute("data-target-x")),
    y: Number(await card.getAttribute("data-target-y")),
    interior: (await card.getAttribute("data-target-interior")) || "outside",
  };
  await card.getByRole("button", { name: /^Podejdź/ }).tap();
  await expect
    .poll(
      async () => {
        const closeNpc = page.getByRole("button", { name: "Zamknij rozmowę", exact: true });
        if (await closeNpc.isVisible()) await closeNpc.tap();
        return (
          (await canvas.getAttribute("data-interior")) === point.interior &&
          Math.hypot(
            Number(await canvas.getAttribute("data-player-x")) - point.x,
            Number(await canvas.getAttribute("data-player-y")) - point.y,
          ) < 90
        );
      },
      { timeout: 120000 },
    )
    .toBe(true);
  await openDevelopment(page, kind === "field" ? "Świat" : "Wyprawy");
  return card;
}
async function clickWorld(page: Page, p: { x: number; y: number }) {
  const canvas = page.locator(".ki-canvas").first();
  const screen = await canvas.evaluate((el, p) => {
    const b = el.getBoundingClientRect(),
      d = (el as HTMLElement).dataset,
      z = Number(d["cameraZoom"]);
    return {
      x: b.x + (p.x - Number(d["cameraX"]) - b.width / 2) * z + b.width / 2,
      y: b.y + (p.y - Number(d["cameraY"]) - b.height / 2) * z + b.height / 2,
    };
  }, p);
  await page.touchscreen.tap(screen.x, screen.y);
}
for (const race of RACE_IDS)
  test(`controlled late-game prerequisites, real world activity and expedition: ${race}`, async ({
    page,
  }, info) => {
    test.setTimeout(420000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: "Wybierz: " + RACES[race].name, exact: true }).tap();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).tap();
    const canvas = page.locator(".ki-canvas").first();
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    await expect.poll(async () => !!(await saved(page))).toBe(true);
    const initial = (await saved(page))!,
      development = preparedDevelopment(race, initial.key);
    await info.attach("controlled-prerequisites", {
      body: JSON.stringify({
        race,
        level: 40,
        earnedCampaignCheckpoint: false,
        explanation:
          "Ranks, six chapters and personal weapon are declared prerequisites. New field/expedition outcomes start empty and must be earned by actual runtime inputs.",
      }),
      contentType: "application/json",
    });
    await page.evaluate(
      ({ key, development }) => {
        const raw = JSON.parse(localStorage.getItem(key)!);
        raw.version = 7;
        raw.player.level = 40;
        raw.player.xp = 0;
        raw.player.hp = 100000;
        raw.player.ki = 100000;
        raw.player.quests.steps = "done";
        raw.player.development = development;
        raw.player.weapon = "heritage";
        raw.player.equipment = { ...raw.player.equipment, weapon: "heritage" };
        raw.player.items.potion = 3;
        localStorage.setItem(key, JSON.stringify(raw));
      },
      { key: initial.key, development },
    );
    await page.reload();
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    const def = FIELDWORK.find((d) => d.race === race && d.tier === 1)!;
    let card = await approach(page, "field", def.id);
    await card.getByRole("button", { name: /^Rozpocznij:/ }).tap();
    for (let step = 0; step < def.steps; step++) {
      if ((await saved(page))!.value.player.development?.fieldwork[def.id]?.done) break;
      card = await approach(page, "field", def.id);
      if (def.mode === "circuit")
        await card.getByRole("button", { name: `Węzeł ${step + 1}`, exact: true }).tap();
      else if (def.mode === "measure") {
        const desired = {
          x: Number(await card.getAttribute("data-target-x")),
          y: Number(await card.getAttribute("data-target-y")),
        };
        await page.getByRole("button", { name: "Zamknij okno", exact: true }).tap();
        for (let attempt = 0; attempt < 15; attempt++) {
          const progress =
            (await saved(page))!.value.player.development!.fieldwork[def.id]?.step ?? 0;
          if (progress > step) break;
          const targets = JSON.parse(
            (await canvas.getAttribute("data-practice-targets")) ?? "[]",
          ) as { id: string; x: number; y: number }[];
          const target = targets.find((t) => Math.hypot(t.x - desired.x, t.y - desired.y) < 5);
          expect(target).toBeDefined();
          await clickWorld(page, target!);
          await basicAttack(page).tap();
          await page.waitForTimeout(200);
        }
      } else {
        await page.getByRole("button", { name: "Zamknij okno", exact: true }).tap();
      }
      await expect
        .poll(
          async () => (await saved(page))!.value.player.development!.fieldwork[def.id]?.step ?? 0,
          { timeout: 30000 },
        )
        .toBeGreaterThan(step);
    }
    expect((await saved(page))!.value.player.development!.fieldwork[def.id]?.done).toBe(true);
    const exp = `E-${RACES[race].world}-22-single`;
    card = await approach(page, "expedition", exp);
    await card.getByRole("button", { name: "Rozpocznij wyprawę", exact: true }).tap();
    const variant = DEVELOPMENT_ENCOUNTERS.find(
      (d) => d.race === race && d.level === 22 && d.role === "heavy",
    )!;
    await expect(canvas).toHaveAttribute("data-enemy-visuals", new RegExp(variant.species));
    const objective = page.locator(".ki-development-objective");
    await expect(objective).toBeVisible();
    const objectiveBox = (await objective.boundingBox())!,
      menuBox = (await page.locator("nav.ki-menu").boundingBox())!;
    expect(objectiveBox.y).toBeGreaterThanOrEqual(menuBox.y + menuBox.height);
    expect(objectiveBox.width).toBeGreaterThanOrEqual(44);
    const renderer = info.project.name === "software-webgl" ? "WebGL" : "Canvas";
    await expect
      .poll(async () => JSON.parse((await canvas.getAttribute("data-metrics")) ?? "{}").renderer)
      .toBe(renderer);

    for (let n = 0; n < 90; n++) {
      expect(errors).toEqual([]);
      if ((await saved(page))!.value.player.development!.completedExpeditions[exp]) break;
      const enemies = JSON.parse((await canvas.getAttribute("data-enemies")) ?? "[]") as {
        id: string;
        x: number;
        y: number;
        hp: number;
      }[];
      const enemy = enemies.find((e) => e.id.startsWith("development-expedition:") && e.hp > 0);
      if (enemy) {
        await clickWorld(page, { x: enemy.x, y: enemy.y - 8 });
        await basicAttack(page).tap();
      } else
        await canvas.evaluate((node) =>
          node.dispatchEvent(
            new CustomEvent("ki:command", {
              detail: {
                type: "expedition",
                action: "go",
                id: `E-${document.querySelector<HTMLElement>(".ki-canvas")!.dataset["world"]}-22-single`,
              },
            }),
          ),
        );
      const potion = page.locator('[data-ability="potion"]').first(),
        health = page.getByRole("meter", { name: "Zdrowie", exact: true });
      if (
        Number(await health.getAttribute("aria-valuenow")) <
          Number(await health.getAttribute("aria-valuemax")) * 0.5 &&
        (await potion.isEnabled())
      )
        await potion.tap();
      await page.waitForTimeout(250);
    }
    await expect
      .poll(async () => (await saved(page))!.value.player.development!.completedExpeditions[exp], {
        timeout: 30000,
      })
      .toBe(true);
    expect((await saved(page))!.value.player.development!.encounterKnowledge[variant.id]).toBe(
      "defeated",
    );
    await page.screenshot({ path: info.outputPath(`${race}-world-activity-and-expedition.png`) });
    await page.reload();
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    expect((await saved(page))!.value.player.development!.fieldwork[def.id]?.done).toBe(true);
    expect((await saved(page))!.value.player.development!.completedExpeditions[exp]).toBe(true);
    expect(errors).toEqual([]);
  });
