import { test, expect, openHudTool, type Page } from "./fixtures";

test.use({ actionTimeout: 15_000 });

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

test.describe("touch racial trial", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("Androidy: portrait guard, touch navigation and module construction", async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: "Wybierz: Androidy", exact: true }).tap();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).tap();
    await expect(page.getByText("Obróć telefon poziomo", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 852, height: 393 });
    const canvas = page.locator(".ki-canvas").first();
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    await openHudTool(page, "Umiejętności", "touch");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).tap();
    await page.getByRole("button", { name: "Podejdź do trenera", exact: true }).tap();
    await expect(canvas).toHaveAttribute("data-interior", "arena");
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).tap();
    const before = await owner(page);
    await openHudTool(page, "Umiejętności", "touch");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).tap();
    await page.getByRole("tab", { name: "Próby", exact: true }).tap();
    const card = page.locator(".ki-development-card").filter({
      has: page.getByRole("heading", { name: /^TN08 ·/ }),
    });
    await card.getByRole("button", { name: "Instrukcja · 1", exact: true }).tap();
    await page.getByRole("button", { name: "Rozpocznij próbę rasową", exact: true }).tap();
    const stage = page.locator(".ki-trial-stage");
    await expect(stage.locator(".ki-canvas")).toHaveAttribute("data-player-x", /^\d/);
    await expect(stage.locator('[data-ability="R"]')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(stage.getByText("Obróć telefon poziomo", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("touch-portrait-trial-guard.png") });
    await page.setViewportSize({ width: 852, height: 393 });
    await expect(stage.getByText("Obróć telefon poziomo", { exact: true })).not.toBeVisible();
    await walkToStation(page, true);
    await stage.getByRole("button", { name: "Zbadaj stanowisko", exact: true }).tap();
    const materials = page.getByRole("dialog", { name: "Materiały próby", exact: true });
    await materials.getByRole("checkbox", { name: "Skaner · 2 energii", exact: true }).tap();
    await materials.getByRole("checkbox", { name: "Precyzja · 3 energii", exact: true }).tap();
    await page.screenshot({ path: info.outputPath("touch-modules.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await materials.getByRole("button", { name: "Sprawdź konstrukcję", exact: true }).tap();
    const result = page.getByRole("dialog", { name: "Wynik próby rasowej", exact: true });
    await expect(result).toContainText("Próba ukończona");
    await page.screenshot({ path: info.outputPath("touch-trial-passed.png") });
    await result.getByRole("button", { name: "Zatwierdź wynik i wróć", exact: true }).tap();
    await expect(stage).toHaveCount(0);
    const after = await owner(page);
    expect(after.development.trials.TN08).toBe(1);
    expect(after.development.practiceEarned - (before.development?.practiceEarned ?? 0)).toBe(100);
    await page.reload();
    await expect(canvas).toHaveAttribute("data-interior", "arena");
    expect((await owner(page)).development.trials.TN08).toBe(1);
    expect(errors).toEqual([]);
  });
});

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
    await page.getByRole("tab", { name: "Próby", exact: true }).click();
    const card = page.locator(".ki-development-card").filter({
      has: page.getByRole("heading", { name: new RegExp(`^${id} ·`) }),
    });
    await card.getByRole("button", { name: "Instrukcja · 1", exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij próbę rasową", exact: true }).click();
    const stage = page.locator(".ki-trial-stage");
    await expect(stage.locator(".ki-canvas")).toHaveAttribute("data-player-x", /^\d/);
    await expect(stage.locator('[data-ability="R"]')).toBeVisible();
    await expect
      .poll(async () => {
        const metrics = await stage.locator(".ki-canvas").getAttribute("data-metrics");
        return metrics ? JSON.parse(metrics).renderer : null;
      })
      .toBe(info.project.name === "software-webgl" ? "WebGL" : "Canvas");
    if (id === "TP08") {
      await page.screenshot({ path: info.outputPath("pyra-trial-before-attack.png") });
      await info.attach("attack-preflight", {
        contentType: "application/json",
        body: JSON.stringify(
          await stage.locator('[data-ability="R"]').evaluate((button) => {
            const b = button.getBoundingClientRect();
            return {
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              blockedBy: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
                ?.outerHTML,
              canvas: {
                ...(document.querySelector<HTMLElement>(".ki-trial-stage .ki-canvas")?.dataset ??
                  {}),
              },
            };
          }),
        ),
      });
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
    expect(after.development.practiceEarned - (before.development?.practiceEarned ?? 0)).toBe(100);
    for (const field of [
      "hp",
      "ki",
      "xp",
      "gold",
      "equipment",
      "bagItems",
      "items",
      "materials",
      "depot",
      "skills",
      "level",
      "race",
      "continent",
    ])
      expect(after[field], field).toEqual(before[field]);
    await page.reload();
    await expect(canvas).toHaveAttribute("data-interior", "arena");
    const reloaded = await owner(page);
    expect(reloaded.development.trials[id]).toBe(1);
    expect(reloaded.development.practiceEarned).toBe(after.development.practiceEarned);
    expect(errors).toEqual([]);
  });
}
