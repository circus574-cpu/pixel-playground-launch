import { test, expect, openHudTool, type Page } from "./fixtures";
import { RACES, RACE_IDS } from "../src/game/world/races";
import { HERITAGE_BY_ID } from "../src/game/development/heritage/catalog";
import { questId } from "../src/game/development/heritage/types";
import { forgeProcedure } from "../src/game/development/heritage/reducer";
import type { Player } from "../src/game/session";

async function saved(page: Page): Promise<Player> {
  return page.evaluate(() => {
    const entry = Object.entries(localStorage).find(([key, value]) => {
      if (key.startsWith("ki-legends:recovery:") || !key.includes(":superior-world-v2:character:"))
        return false;
      try {
        return JSON.parse(value).format === "superior-character";
      } catch {
        return false;
      }
    });
    if (!entry) throw Error("No actual character save");
    return JSON.parse(entry[1]).player;
  });
}
async function openHeritage(page: Page) {
  if (await page.locator('.ki-development-tabs [aria-selected="true"]').count()) return;
  await openHudTool(page, "Umiejętności");
  await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).click();
  await page.getByRole("tab", { name: "Dziedzictwo", exact: true }).click();
}
async function approach(page: Page, index: number) {
  for (let phase = 0; phase < 4; phase++) {
    await openHeritage(page);
    const target = page.locator(".ki-development-target").nth(index);
    const go = target.getByRole("button", { name: /^Podejdź:/ });
    if (await go.isDisabled()) return;
    const point = {
      x: Number(await target.getAttribute("data-target-x")),
      y: Number(await target.getAttribute("data-target-y")),
      interior: await target.getAttribute("data-target-interior"),
    };
    const canvas = page.locator(".ki-canvas").first();
    const before = await canvas.getAttribute("data-interior");
    await go.click();
    await expect
      .poll(
        async () => {
          const interior = await canvas.getAttribute("data-interior");
          if (interior !== before) return true;
          return (
            interior === point.interior &&
            Math.hypot(
              Number(await canvas.getAttribute("data-player-x")) - point.x,
              Number(await canvas.getAttribute("data-player-y")) - point.y,
            ) < 120
          );
        },
        { timeout: 120000 },
      )
      .toBe(true);
  }
  await openHeritage(page);
  await expect(
    page
      .locator(".ki-development-target")
      .nth(index)
      .getByRole("button", { name: /^Podejdź:/ }),
  ).toBeDisabled();
}
for (const race of RACE_IDS) {
  test(`actual first heritage chapter, personal weapon and reload: ${race}`, async ({
    page,
  }, info) => {
    test.setTimeout(900000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: "Wybierz: " + RACES[race].name, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas").first();
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    // The real old prologue is completed through its own UI; no progress/position patching.
    await page.getByRole("button", { name: /^Rozmowa ·/ }).click();
    await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
    const market = page.getByRole("dialog").getByRole("button", { name: /^Podejdź/ });
    await expect(market).toBeVisible();
    await market.click();
    await expect
      .poll(async () => (await saved(page)).quests.steps, { timeout: 120000 })
      .toBe("ready");
    await openHudTool(page, "Dziennik");
    await page
      .locator(".ki-adventure-panel")
      .getByRole("button", { name: /^Idź do/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
    expect((await saved(page)).quests.steps).toBe("done");
    const id = questId(race, 1),
      definition = HERITAGE_BY_ID.get(id)!;
    await openHeritage(page);
    await approach(page, 0);
    await page.getByRole("button", { name: "Przyjmij zlecenie", exact: true }).click();
    await expect
      .poll(async () => (await saved(page)).development?.heritage.quests[id]?.status)
      .toBe("active");
    for (let guard = 0; guard < 60; guard++) {
      const p = await saved(page),
        progress = p.development!.heritage.quests[id]!;
      if (progress.status === "ready") break;
      expect(progress.status).toBe("active");
      const goal = definition.goals[progress.step]!;
      const index = goal.kind === "forge" ? 0 : progress.goal.sequence;
      await approach(page, index);
      const target = page.locator(".ki-development-target").nth(index);
      const old = JSON.stringify(progress);
      if (goal.kind === "talk")
        await target.getByRole("button", { name: goal.responses[0]!.label, exact: true }).click();
      else if (goal.kind === "inspect")
        await target
          .getByRole("button", { name: "Zbadaj znak lub przedmiot", exact: true })
          .click();
      else if (goal.kind === "consent")
        await target
          .getByRole("button", { name: "Uzyskaj zgodę na zapis anonimowy", exact: true })
          .click();
      else if (goal.kind === "solve") {
        const puzzle = goal.puzzles[index]!;
        await target
          .getByRole("button", {
            name: puzzle.options.find((a) => a.id === puzzle.answerId)!.label,
            exact: true,
          })
          .click();
      } else if (goal.kind === "forge")
        await target
          .getByRole("button", {
            name: forgeProcedure(goal, race)[progress.goal.sequence]!.label,
            exact: true,
          })
          .click();
      else throw Error("Missing physical UI handler: " + goal.kind);
      await expect
        .poll(async () => JSON.stringify((await saved(page)).development!.heritage.quests[id]))
        .not.toBe(old);
    }
    expect((await saved(page)).development!.heritage.quests[id]!.status).toBe("ready");
    await openHeritage(page);
    await page.screenshot({ path: info.outputPath(race + "-heritage-choice.png") });
    await page.getByRole("button", { name: definition.choices[0]!.label, exact: true }).click();
    await expect
      .poll(async () => (await saved(page)).development!.heritage.quests[id]!.status)
      .toBe("done");
    const w = (await saved(page)).development!.heritage.weapon!;
    expect(w.stage).toBe(1);
    expect(w.history).toEqual([id]);
    expect((await saved(page)).development!.practiceEarned).toBe(150);
    await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
    await openHudTool(page, "Ekwipunek");
    await page.getByRole("button", { name: "Załóż osobistą broń", exact: true }).click();
    await expect.poll(async () => (await saved(page)).weapon).toBe("heritage");
    await page.screenshot({ path: info.outputPath(race + "-equipped-heritage.png") });
    await page.reload();
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    const restored = await saved(page);
    expect(restored.weapon).toBe("heritage");
    expect(restored.development!.heritage.weapon).toEqual(w);
    expect(restored.development!.heritage.quests[id]!.status).toBe("done");
    expect(errors).toEqual([]);
  });
}
