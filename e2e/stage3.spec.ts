import { test, expect, type Page } from "./fixtures";
const races = [
  {
    name: "Planetarni",
    id: "planetary",
    world: "verdant",
    continent: "Verdantia",
    guide: "Aira",
    settlement: "Wioska Początkowa",
    action: "Podejdź do rynku",
    back: "Idź do Airy",
    x: 1495,
    y: 1260,
  },
  {
    name: "Mędrcy",
    id: "sage",
    world: "aether",
    continent: "Aetheria",
    guide: "Sora",
    settlement: "Sanktuarium Tysiąca Źródeł",
    action: "Podejdź: Źródło Pamięci",
    back: "Idź do Sora",
    x: 1150,
    y: 1130,
  },
  {
    name: "Androidy",
    id: "android",
    world: "nexus",
    continent: "Nexus-9",
    guide: "LYRA-7",
    settlement: "Węzeł Świadomości",
    action: "Podejdź: Rdzeń Świadomości",
    back: "Idź do LYRA-7",
    x: 600,
    y: 1120,
  },
  {
    name: "Legendy",
    id: "legend",
    world: "pyra",
    continent: "Pyra",
    guide: "Kaena",
    settlement: "Twierdza Popiołu",
    action: "Podejdź: Arena Dziedzictwa",
    back: "Idź do Kaena",
    x: 1180,
    y: 1330,
  },
];
const path =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
async function saved(page: Page) {
  return page.evaluate(() => {
    const base = "ki-legends:adventure:v1",
      id = localStorage.getItem(base + ":active-character");
    return JSON.parse(localStorage.getItem(base + ":character:" + id) ?? "null")?.player;
  });
}
async function returnToCharacters(page: Page) {
  await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
}
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/game/assets/"))
      errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

test("A/B/C: four previews, four independent slots, exploration, camera, NPC, refresh and switching", async ({
  page,
}, info) => {
  test.setTimeout(480_000);
  const errors = collectErrors(page);
  await page.goto(path);
  await expect(page.getByRole("region", { name: "Cztery rasy" })).toBeVisible();
  for (const race of races) {
    await page
      .getByRole("button", { name: "Podgląd kontynentu: " + race.name, exact: true })
      .click();
    await expect(page.locator(".ki-continent-preview")).toContainText(race.settlement);
    await expect(page.locator(".ki-continent-preview img")).toHaveJSProperty(
      "naturalWidth",
      race.world === "verdant" ? 768 : 2400,
    );
    await page.getByRole("button", { name: "Wybierz: " + race.name, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(`.ki-canvas[data-world="${race.world}"]`);
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-x")))
      .toBeCloseTo(race.x, 0);
    await expect(page.locator(".ki-player-name")).toContainText(race.name.toUpperCase());
    await expect(page.locator(".ki-map-title")).toContainText(race.settlement);
    await expect(page.locator(".ki-location")).toContainText(race.continent);
    await expect(page.getByRole("button", { name: race.action, exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(race.world + "-start.png") });
    await page.getByRole("button", { name: new RegExp("Rozmowa · " + race.guide) }).click();
    await expect(
      page.getByRole("dialog", { name: "Rozmowa: " + race.guide, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
    await expect(page.getByRole("button", { name: race.action, exact: true })).toBeVisible();
    if (race.id !== "planetary")
      await expect(page.getByRole("button", { name: "Podejdź do rynku", exact: true })).toHaveCount(
        0,
      );
    await page.getByRole("button", { name: race.action, exact: true }).click();
    await expect
      .poll(async () => (await saved(page))?.quests.steps, { timeout: 120_000 })
      .toBe("ready");
    await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Ustawienia", exact: true })).toBeVisible();
    await page.waitForTimeout(250);
    const moved = {
      x: Number(await canvas.getAttribute("data-player-x")),
      y: Number(await canvas.getAttribute("data-player-y")),
    };
    expect(Math.hypot(moved.x - race.x, moved.y - race.y)).toBeGreaterThan(150);
    const marker = await page.locator(".ki-map-marker").first().getAttribute("style");
    await page.reload();
    await expect(page.locator(`.ki-canvas[data-world="${race.world}"]`)).toBeVisible();
    const restored = await saved(page);
    expect(restored.race).toBe(race.id);
    expect(restored.continent).toBe(race.world);
    expect(restored.quests.steps).toBe("ready");
    expect(Math.hypot(restored.x - moved.x, restored.y - moved.y)).toBeLessThan(10);
    await expect
      .poll(() => page.locator(".ki-map-marker").first().getAttribute("style"))
      .toBe(marker);
    await page.getByRole("button", { name: "Dziennik", exact: true }).click();
    await page.getByRole("button", { name: race.back, exact: true }).click();
    await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
    expect((await saved(page)).quests.steps).toBe("done");
    expect((await saved(page)).xp).toBe(40);
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
    console.log("Verified", race.name, race.world);
    await returnToCharacters(page);
    await page.getByRole("button", { name: "Nowa podróż", exact: true }).click();
  }
  await page.getByRole("button", { name: /Twoje postacie/ }).click();
  await expect(page.getByRole("button", { name: "Kontynuuj podróż", exact: true })).toHaveCount(4);
  await page.getByRole("button", { name: "Kontynuuj podróż", exact: true }).first().click();
  await expect(page.locator(".ki-canvas[data-world]")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [360, 800],
  [390, 844],
  [414, 896],
  [852, 393],
  [640, 480],
] as const) {
  test(`E: touch selection, joystick, dialogue and layout ${width}x${height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: "Podgląd kontynentu: Planetarni", exact: true }),
    ).toBeVisible();
    await page
      .locator(".ki-race-card img")
      .first()
      .evaluate((img) => (img as HTMLImageElement).decode());
    await page.screenshot({ path: "docs/qa/stage3-1/selection-" + width + "x" + height + ".png" });
    if (width <= 700) {
      const track = page.locator(".ki-race-grid");
      const bounds = await track.boundingBox();
      const touch = await context.newCDPSession(page);
      const y = bounds!.y + 120;
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: width - 50, y, id: 1 }],
      });
      for (let step = 1; step <= 6; step++) {
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: width - 50 - (step * (width - 100)) / 6, y, id: 1 }],
        });
        await page.waitForTimeout(35);
      }
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(80);
      await page.getByRole("button", { name: "Pokaż rasę: Planetarni", exact: true }).tap();
    }
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, height);
    await expect
      .poll(() => page.locator(".ki-origins").evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    for (const race of races) {
      await page
        .getByRole("button", { name: "Podgląd kontynentu: " + race.name, exact: true })
        .tap();
      await expect(page.locator(".ki-continent-preview")).toContainText(race.settlement);
    }
    await page.screenshot({ path: info.outputPath("selection.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "Wybierz: Mędrcy", exact: true }).tap();
    await page.getByRole("button", { name: "Otwórz pełną ilustrację: Mędrcy", exact: true }).tap();
    const fullArt = page.getByRole("dialog", { name: "Ilustracja: Mędrcy" }).locator("img");
    await fullArt.evaluate((el) => (el as HTMLImageElement).decode());
    const artBounds = await fullArt.boundingBox();
    expect(artBounds!.y + artBounds!.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: "docs/qa/stage3-1/illustration-mobile-" + width + ".png" });
    await page.getByRole("button", { name: "Zamknij ilustrację", exact: true }).tap();

    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).tap();
    const canvas = page.locator('.ki-canvas[data-world="aether"]');
    await expect(canvas).toBeVisible();
    await page.getByRole("button", { name: /Rozmowa · Sora/ }).tap();
    await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).tap();
    await page.screenshot({ path: info.outputPath("dialogue.png") });
    const dialog = page.getByRole("dialog");
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).tap();
    // Actual CDP touch events exercise Phaser's floating joystick, not mouse emulation.
    const before = Number(await canvas.getAttribute("data-player-x"));
    const cdp = await context.newCDPSession(page);
    const x = width * 0.16,
      y = height * 0.72;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 42, y, id: 1 }],
    });
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-x")), { timeout: 15000 })
      .toBeGreaterThan(before + 20);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.locator(".ki-target")).toHaveCount(0);
    await page.getByRole("button", { name: "Podejdź: Źródło Pamięci", exact: true }).tap();
    await expect
      .poll(async () => (await saved(page))?.quests.steps, { timeout: 120000 })
      .toBe("ready");
    await page.getByRole("button", { name: "Ekwipunek", exact: true }).tap();
    await expect(page.getByRole("dialog", { name: "Ekwipunek", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zamknij okno", exact: true }).tap();
    await page.screenshot({ path: info.outputPath("world.png") });
    const skills = await page
      .getByRole("navigation", { name: "Umiejętności", exact: true })
      .boundingBox();
    const controls = await page
      .getByRole("navigation", { name: "Widok mapy", exact: true })
      .boundingBox();
    expect(skills!.y + skills!.height).toBeLessThanOrEqual(height + 1);
    expect(controls!.x + controls!.width).toBeLessThanOrEqual(width + 1);
    expect(
      skills!.x + skills!.width <= controls!.x ||
        controls!.x + controls!.width <= skills!.x ||
        skills!.y + skills!.height <= controls!.y ||
        controls!.y + controls!.height <= skills!.y,
    ).toBe(true);
    const actions = await page.locator(".ki-context-actions").boundingBox();
    expect(actions!.y + actions!.height).toBeLessThanOrEqual(skills!.y);
    expect(errors).toEqual([]);
    await context.close();
  });
}
