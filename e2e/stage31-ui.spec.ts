import { openHudTool } from "./fixtures";
import { test, expect } from "./fixtures";
import { mkdir } from "node:fs/promises";
const path =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
const evidence = "docs/qa/stage3-1";
const races = [
  ["Planetarni", "planetary", "Verdantia"],
  ["Mędrcy", "sage", "Aetheria"],
  ["Androidy", "android", "Nexus-9"],
  ["Legendy", "legend", "Pyra"],
] as const;

test("original complete illustrations, details, accessible enlargement and no save before start", async ({
  page,
}) => {
  await mkdir(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await expect(page.getByRole("region", { name: "Cztery rasy" })).toBeVisible();
  for (const img of await page.locator(".ki-race-card img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveJSProperty("naturalWidth", 480);
  }
  await page.locator(".ki-origins").evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({ path: evidence + "/selection-desktop.png" });
  for (const [name, id, world] of races) {
    await page.getByRole("button", { name: "Wybierz: " + name, exact: true }).click();
    const detail = page.getByRole("region", { name: "Pochodzenie: " + name });
    await expect(detail).toHaveAttribute("data-selected-race", id);
    await expect(detail).toContainText(world);
    await expect(detail).toContainText("Energia KI");
    await expect(detail).toContainText("Kultura");
    await page.getByRole("button", { name: "Otwórz pełną ilustrację: " + name }).click();
    const dialog = page.getByRole("dialog", { name: "Ilustracja: " + name });
    const img = dialog.locator("img");
    await expect(img).toHaveJSProperty("naturalWidth", 1152);
    await expect(img).toHaveJSProperty("naturalHeight", 1392);
    await img.evaluate((el) => (el as HTMLImageElement).decode());
    const box = await img.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(1000);
    expect(box!.height).toBeGreaterThan(500);
    expect(await img.evaluate((el) => getComputedStyle(el).objectFit)).toBe("contain");
    await page.screenshot({ path: evidence + "/illustration-" + id + ".png" });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Otwórz pełną ilustrację: " + name }),
    ).toBeFocused();
  }
  expect(
    await page.evaluate(
      () => Object.keys(localStorage).filter((k) => k.includes(":character:")).length,
    ),
  ).toBe(0);
  await page.screenshot({ path: evidence + "/origin-detail.png" });
  expect(errors).toEqual([]);
});

test("real Phaser progress is held by an actual resource request, then opens the correct world", async ({
  page,
}) => {
  await mkdir(evidence, { recursive: true });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let requested = false;
  await page.route("**/hero-walk-v2.webp", async (route) => {
    requested = true;
    await gate;
    await route.continue();
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(path);
  await page.getByRole("button", { name: "Wybierz: Legendy", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  const loader = page.locator('.ki-loading-screen[data-phase="assets"]');
  await expect(loader).toBeVisible();
  await expect(loader).toContainText("Pyra");
  await expect(page.locator(".ki-hud")).toHaveCount(0);
  await expect
    .poll(async () => Number(await page.getByRole("progressbar").getAttribute("aria-valuenow")))
    .toBeGreaterThan(0);
  expect(Number(await page.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeLessThan(
    100,
  );
  await page.screenshot({ path: evidence + "/loading-desktop.png" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: evidence + "/loading-mobile.png" });
  await page.setViewportSize({ width: 852, height: 393 });
  await page.screenshot({ path: evidence + "/loading-landscape.png" });
  release();
  await expect(page.locator(".ki-hud")).toBeVisible();
  await expect(loader).toHaveCount(0);
  await expect(page.locator(".ki-canvas")).toHaveAttribute("data-world", "pyra");
  await expect(page.locator(".ki-map-title")).toContainText("Twierdza Popiołu");
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".ki-location")).toContainText("Pyra");
  await expect(page.locator(".ki-location")).not.toContainText("Verdantia");
  expect(errors).toEqual([]);
});

test("failed real resource shows retry and reuses the same saved character", async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  let requests = 0;
  let failing = true;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/hero-walk-v2.webp", async (route) => {
    requests++;
    if (failing) await route.abort("failed");
    else await route.continue();
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Wybierz: Androidy", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const error = page.getByRole("alert", { name: "Ładowanie Ki Legends" });
  await expect(error).toContainText("Nie udało się pobrać");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.locator(".ki-hud")).toHaveCount(0);
  const before = await page.evaluate(() =>
    localStorage.getItem("ki-legends:adventure:v1:active-character"),
  );
  await page.screenshot({ path: evidence + "/loading-error.png" });
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [414, 896],
    [852, 393],
  ] as const) {
    await page.setViewportSize({ width, height });
    const box = await page.locator(".ki-loading-error").boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    const footer = page.locator(".ki-loading-footer");
    if (await footer.isVisible())
      expect(box!.y + box!.height + 8).toBeLessThanOrEqual((await footer.boundingBox())!.y);
    await expect(page.getByRole("button", { name: "Ponów próbę", exact: true })).toBeInViewport();
    await page.screenshot({ path: evidence + "/loading-error-" + width + ".png" });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const failedRequests = requests;
  failing = false;
  await page.getByRole("button", { name: "Ponów próbę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
  await expect(page.locator(".ki-canvas")).toHaveAttribute("data-world", "nexus");
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(requests).toBe(failedRequests + 1);
  expect(
    await page.evaluate(() => localStorage.getItem("ki-legends:adventure:v1:active-character")),
  ).toBe(before);
  expect(
    await page.evaluate(
      () => Object.keys(localStorage).filter((k) => k.includes(":character:")).length,
    ),
  ).toBe(1);
  await page.reload();
  await expect(page.locator(".ki-hud")).toBeVisible();
  await expect(page.locator(".ki-map-title")).toContainText("Węzeł Świadomości");
  expect(errors).toEqual([]);
});

test("HP and KI remain separate at low, middle, maximum values and interface scales", async ({
  page,
}) => {
  await page.goto(path);
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
  await page.addInitScript(() => {
    const fixture = sessionStorage.getItem("qa-meter-values");
    if (!fixture) return;
    const { hp, ki } = JSON.parse(fixture);
    const key =
      "ki-legends:adventure:v1:character:" +
      localStorage.getItem("ki-legends:adventure:v1:active-character");
    const raw = JSON.parse(localStorage.getItem(key)!);
    raw.player.hp = hp;
    raw.player.ki = ki;
    localStorage.setItem(key, JSON.stringify(raw));
  });
  // Isolated rendering fixtures; real gameplay is verified in the separate PvE test.
  for (const [hp, ki] of [
    [1, 0],
    [60, 25],
    [120, 50],
  ] as const) {
    await page.evaluate(
      ({ hp, ki }) => sessionStorage.setItem("qa-meter-values", JSON.stringify({ hp, ki })),
      { hp, ki },
    );
    await page.reload();
    await expect(page.locator(".ki-hud")).toBeVisible();
    await openHudTool(page, "Ustawienia");
    const health = page.getByRole("meter", { name: "Zdrowie", exact: true }),
      energy = page.getByRole("meter", { name: "Energia KI", exact: true });
    const visibleHp = Number(await health.getAttribute("aria-valuenow"));
    expect(visibleHp).toBeGreaterThanOrEqual(hp);
    expect(visibleHp).toBeLessThanOrEqual(Math.min(120, hp + 3));
    await expect(health.locator("span")).toContainText(String(visibleHp) + " / 120");
    expect(Number(await energy.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(ki!);
    for (const [width, height] of [
      [360, 800],
      [390, 844],
      [414, 896],
      [852, 393],
      [1280, 900],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      for (const scale of [1, 1.25, 1.5]) {
        await page.locator(".ki-player").evaluate((el, zoom) => {
          (el as HTMLElement).style.zoom = String(zoom);
        }, scale);
        const h = await health.locator("span").boundingBox(),
          k = await energy.locator("span").boundingBox();
        expect(h!.y + h!.height).toBeLessThanOrEqual(k!.y);
        expect(h!.x).toBeGreaterThanOrEqual(0);
        expect(k!.x + k!.width).toBeLessThanOrEqual(width!);
      }
    }
    await page.locator(".ki-player").evaluate((el) => {
      (el as HTMLElement).style.zoom = "1";
    });
    await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
  }
});
