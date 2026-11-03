import { test, expect, openHudTool, type Page } from "./fixtures";

async function owner(page: Page) {
  return page.evaluate(() => {
    for (const [key, value] of Object.entries(localStorage)) {
      if (key.includes("recovery")) continue;
      try {
        const save = JSON.parse(value);
        if (save.format === "superior-character") return save.player;
      } catch {
        /* A different browser preference. */
      }
    }
    throw new Error("No active Superior character save");
  });
}

async function walkToStation(page: Page, touch: boolean) {
  const stage = page.locator(".ki-trial-stage");
  const x = Number(await stage.getAttribute("data-trial-x"));
  const y = Number(await stage.getAttribute("data-trial-y"));
  const canvas = stage.locator(".ki-canvas");
  const point = await canvas.evaluate(
    (el, target) => {
      const node = el as HTMLElement,
        b = node.getBoundingClientRect();
      const zoom = Number(node.dataset["cameraZoom"]);
      return {
        x: b.x + (target.x - Number(node.dataset["cameraX"]) - b.width / 2) * zoom + b.width / 2,
        y: b.y + (target.y - Number(node.dataset["cameraY"]) - b.height / 2) * zoom + b.height / 2,
      };
    },
    { x, y },
  );
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await expect
    .poll(async () =>
      Math.hypot(
        Number(await canvas.getAttribute("data-player-x")) - x,
        Number(await canvas.getAttribute("data-player-y")) - y,
      ),
    )
    .toBeLessThan(65);
}

for (const [race, id, land] of [
  ["Planetarni", "TV10", "verdant"],
  ["Mędrcy", "TA01", "aether"],
  ["Androidy", "TN08", "nexus"],
  ["Legendy", "TP08", "pyra"],
] as const) {
  test(`${race}: real ${id}, one-time reward and reload`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas").first();
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    await openHudTool(page, "Umiejętności");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).click();
    await page.getByRole("button", { name: "Podejdź do trenera", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-interior", "arena");
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
    const before = await owner(page);
    await openHudTool(page, "Umiejętności");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).click();
    await page.getByRole("button", { name: "Próby", exact: true }).click();
    const card = page.locator(".ki-development-card").filter({
      has: page.getByRole("heading", { name: new RegExp(`^${id} ·`) }),
    });
    await card.getByRole("button", { name: "Instrukcja · 1", exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij próbę rasową", exact: true }).click();
    const stage = page.locator(".ki-trial-stage");
    await expect(stage.locator(".ki-canvas")).toHaveAttribute("data-player-x", /^\d/);
    await expect(stage.locator('[data-ability="R"]')).toBeVisible();
    if (id === "TP08") {
      for (let i = 0; i < 3; i++) {
        await expect(stage).toHaveAttribute("data-trial-phase", "strike");
        await stage.locator('[data-ability="R"]').click();
        await expect(stage).toHaveAttribute("data-trial-phase", "hold");
      }
    } else {
      const rounds = id === "TN08" ? 1 : 3;
      for (let i = 0; i < rounds; i++) {
        await walkToStation(page, false);
        await stage.getByRole("button", { name: "Zbadaj stanowisko", exact: true }).click();
        const materials = page.getByRole("dialog", { name: "Materiały próby", exact: true });
        await expect(materials).toBeVisible();
        if (i === 0)
          await page.screenshot({ path: info.outputPath(`${land}-trial-materials.png`) });
        const text = await materials.locator(".ki-trial-document").allTextContents();
        if (id === "TN08") {
          await materials
            .getByRole("checkbox", { name: "Skaner · 2 energii", exact: true })
            .check();
          await materials
            .getByRole("checkbox", { name: "Precyzja · 3 energii", exact: true })
            .check();
          await materials.getByRole("button", { name: "Sprawdź konstrukcję", exact: true }).click();
        } else {
          // Read only the clues actually shown to the player, never internal answer IDs.
          const heading = await materials.getByRole("heading", { level: 2 }).innerText();
          let answer: string;
          if (id === "TV10") {
            answer = text
              .join(" ")
              .match(new RegExp(`${i + 1}\\.\\s*([^→.]+)`))![1]!
              .trim();
          } else {
            const glyph = heading.match(/symbol: (.+)\./)![1]!;
            answer = text
              .join(" ")
              .split("; ")
              .find((v) => v.includes(`${glyph} = `))!
              .split(" = ")[1]!
              .replace(/\.$/, "")
              .trim();
          }
          await materials.getByRole("button", { name: answer, exact: true }).click();
        }
        await expect(materials).toHaveCount(0);
      }
    }
    const result = page.getByRole("dialog", { name: "Wynik próby rasowej", exact: true });
    await expect(result).toContainText("Próba ukończona");
    await page.screenshot({ path: info.outputPath(`${land}-trial-passed.png`) });
    await result.getByRole("button", { name: "Zatwierdź wynik i wróć", exact: true }).click();
    await expect(stage).toHaveCount(0);
    await expect.poll(async () => (await owner(page)).development?.trials?.[id]).toBe(1);
    const after = await owner(page);
    expect(after.development.practice - before.development.practice).toBe(100);
    for (const field of ["hp", "ki", "xp", "gold", "gear", "bag", "level", "race", "continent"])
      expect(after[field], field).toEqual(before[field]);
    await page.reload();
    await expect(canvas).toHaveAttribute("data-interior", "arena");
    const reloaded = await owner(page);
    expect(reloaded.development.trials[id]).toBe(1);
    expect(reloaded.development.practice).toBe(after.development.practice);
    expect(errors).toEqual([]);
  });
}
