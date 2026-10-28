import { test, expect, openHudTool, type Page } from "./fixtures";
import { HERITAGE_BY_ID, PROJECT_BY_ID } from "../src/game/development/heritage/catalog";
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
async function openHeritage(page: Page, selected?: string) {
  if (!(await page.locator(".ki-development").count())) {
    await openHudTool(page, "Umiejętności");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).click();
  }
  const tab = page.getByRole("tab", { name: "Dziedzictwo", exact: true });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  if (selected)
    await page
      .locator('.ki-development-tabs[aria-label="Rozdziały i projekty"] button')
      .filter({ hasText: selected })
      .click();
}
async function approach(page: Page, index: number, selected?: string, singleLeg = false) {
  for (let phase = 0; phase < 4; phase++) {
    await openHeritage(page, selected);
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
    if (singleLeg) {
      await openHeritage(page, selected);
      return;
    }
  }
  await openHeritage(page, selected);
  await expect(
    page
      .locator(".ki-development-target")
      .nth(index)
      .getByRole("button", { name: /^Podejdź:/ }),
  ).toBeDisabled();
}

test("real Verdantia delivery checkpoints, reload and second-stage personal weapon", async ({
  page,
}, info) => {
  test.setTimeout(1200000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/scripts/playtest.html?ki-world-v2=1");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const canvas = page.locator(".ki-canvas").first();
  await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
  await page.getByRole("button", { name: /^Rozmowa ·/ }).click();
  await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Podejdź/ })
    .click();
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
  for (const id of ["H-V01", "P-V1", "H-V02"] as const) {
    const def = id === "P-V1" ? PROJECT_BY_ID.get(id)! : HERITAGE_BY_ID.get(id)!;
    await openHeritage(page, def.name);
    await approach(page, 0, def.name);
    await page.getByRole("button", { name: "Przyjmij zlecenie", exact: true }).click();
    const progress = async () => {
      const h = (await saved(page)).development!.heritage;
      return id === "P-V1" ? h.projects[id]! : h.quests[id]!;
    };
    await expect.poll(async () => (await progress()).status).toBe("active");
    for (let guard = 0; guard < 80; guard++) {
      const p = await progress();
      if (p.status === "ready") break;
      expect(p.status).toBe("active");
      const goal = def.goals[p.step]!;
      if (goal.kind === "projects") {
        await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
        await expect.poll(async () => (await progress()).step).not.toBe(p.step);
        await openHeritage(page, def.name);
        continue;
      }
      if (goal.kind === "escort") {
        expect(goal.combat).toBe(false);
        await approach(page, 0, def.name);
        await page
          .getByRole("button", { name: "Rozpocznij lub wznów eskortę dostawy", exact: true })
          .click();
        for (let checkpoint = p.goal.sequence; checkpoint < goal.checkpoints; checkpoint++) {
          await approach(page, 0, def.name, true);
          await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
          await expect
            .poll(
              async () => {
                const current = await progress();
                return current.step !== p.step || current.goal.sequence > checkpoint;
              },
              { timeout: 120000 },
            )
            .toBe(true);
          await page.screenshot({
            path: info.outputPath("verdantia-delivery-checkpoint-" + (checkpoint + 1) + ".png"),
          });
          if (checkpoint === 0) {
            expect((await progress()).step).toBe(p.step);
            expect((await progress()).goal.sequence).toBe(1);
            await page.reload();
            await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
            expect((await progress()).goal.sequence).toBe(1);
            await openHeritage(page, def.name);
            await approach(page, 0, def.name);
            await page
              .getByRole("button", { name: "Rozpocznij lub wznów eskortę dostawy", exact: true })
              .click();
          }
        }
        await openHeritage(page, def.name);
        continue;
      }
      const index = goal.kind === "forge" ? 0 : p.goal.sequence;
      await approach(page, index, def.name);
      const target = page.locator(".ki-development-target").nth(index);
      if (goal.kind === "talk")
        await target.getByRole("button", { name: goal.responses[0]!.label, exact: true }).click();
      else if (goal.kind === "inspect")
        await target
          .getByRole("button", { name: "Zbadaj znak lub przedmiot", exact: true })
          .click();
      else if (goal.kind === "recover")
        await target
          .getByRole("button", { name: "Odzyskaj: " + goal.materialName, exact: true })
          .click();
      else if (goal.kind === "craft")
        await target.getByRole("button", { name: /^Wykonaj pracę/ }).click();
      else if (goal.kind === "solve")
        await target
          .getByRole("button", {
            name: goal.puzzles[index]!.options.find((a) => a.id === goal.puzzles[index]!.answerId)!
              .label,
            exact: true,
          })
          .click();
      else if (goal.kind === "consent")
        await target
          .getByRole("button", { name: "Uzyskaj zgodę na zapis anonimowy", exact: true })
          .click();
      else if (goal.kind === "forge")
        await target
          .getByRole("button", {
            name: forgeProcedure(goal, "planetary")[p.goal.sequence]!.label,
            exact: true,
          })
          .click();
      else throw Error("Unimplemented real delivery prerequisite " + goal.kind);
      await expect.poll(async () => JSON.stringify(await progress())).not.toBe(JSON.stringify(p));
    }
    expect((await progress()).status).toBe("ready");
    if ("choices" in def)
      await page.getByRole("button", { name: def.choices[0]!.label, exact: true }).click();
    else
      await page
        .getByRole("button", { name: "Zakończ projekt i odbierz praktykę", exact: true })
        .click();
    await expect.poll(async () => (await progress()).status).toBe("done");
  }
  const p = await saved(page);
  expect(p.development!.heritage.weapon!.stage).toBe(2);
  expect(p.development!.heritage.weapon!.history).toEqual(["H-V01", "H-V02"]);
  expect(p.development!.practiceEarned).toBe(550);
  await page.screenshot({ path: info.outputPath("verdantia-second-chapter-claimed.png") });
  await page.reload();
  await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
  expect((await saved(page)).development!.heritage.weapon).toEqual(p.development!.heritage.weapon);
  expect(errors).toEqual([]);
});
