import { test, expect, openHudTool, type Page, patchActiveCharacter } from "./fixtures";

const entry = "/scripts/playtest.html";
const base = "ki-legends:adventure:v1:superior-world-v1";
/** Level 2 with Świetlista Bariera (B1): a real learned skill whose shield plays the skill clip. */
const SHIELD_SAVE = { level: 2, skills: ["R", "B1"] };
async function start(page: Page, preview = true) {
  await page.goto(entry + (preview ? "?ki-sage-art=1" : ""));
  await page.getByRole("button", { name: "Wybierz: Mędrcy", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
}
async function activeId(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key + ":active-character"), base);
}

async function progression(page: Page, id: string | null) {
  return page.evaluate(
    ({ key, id }) => {
      const raw = localStorage.getItem(key + ":character:" + id);
      if (!raw) throw new Error("Missing preserved character slot");
      const { player } = JSON.parse(raw);
      return Object.fromEntries(
        [
          "race",
          "continent",
          "startContinent",
          "level",
          "xp",
          "gold",
          "items",
          "weapon",
          "armor",
          "upgrade",
          "quests",
        ].map((field) => [field, player[field]]),
      );
    },
    { key: base, id },
  );
}

test("Mędrcy default visual preserves the save and stays isolated from other races", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page, false);
  const canvas = page.locator(".ki-canvas");
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-sage-painted");
  await expect(canvas).toHaveAttribute("data-texture-ids", /hero-sage-painted-walk-v3-page/);
  const id = await activeId(page);
  const saved = await progression(page, id);
  const legacy = await page.evaluate((key) => localStorage.getItem(key), base);
  await page.goto(entry + "?ki-sage-art=1");
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-sage-painted");
  expect(await activeId(page)).toBe(id);
  expect(await progression(page, id)).toEqual(saved);
  await page.goto(entry);
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-sage-painted");
  expect(await activeId(page)).toBe(id);
  expect(await progression(page, id)).toEqual(saved);
  for (const [race, world] of [
    ["Planetarni", "verdant"],
    ["Androidy", "nexus"],
    ["Legendy", "pyra"],
  ]) {
    await openHudTool(page, "Ustawienia");
    await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
    await page.getByRole("button", { name: "Nowa podróż", exact: true }).click();
    await page.getByRole("button", { name: "Wybierz: " + race, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-world", world!);
    const expected = {
      verdant: "hero-planetary-painted",
      nexus: "hero-android",
      pyra: "hero-legend",
    }[world!];
    await expect(canvas).toHaveAttribute("data-actor-visual", expected!);
    await expect(canvas).not.toHaveAttribute("data-texture-ids", /hero-sage-painted-walk-v3-page/);
    expect(await progression(page, id)).toEqual(saved);
  }
  expect(await page.evaluate((key) => localStorage.getItem(key), base)).toBe(legacy);
  expect(errors).toEqual([]);
});

for (const width of [1280, 390])
  test(`Mędrcy has real eight-direction movement and skill animation at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await start(page);
    await patchActiveCharacter(page, SHIELD_SAVE);
    const canvas = page.locator(".ki-canvas");
    await expect(canvas).toHaveAttribute("data-actor-visual", "hero-sage-painted");
    const idleFrames = new Set<string>();
    for (let i = 0; i < 8; i++) {
      idleFrames.add((await canvas.getAttribute("data-animation-frame"))!);
      await page.waitForTimeout(90);
    }
    expect(idleFrames.size).toBeGreaterThan(1);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    const directions: [string, string[]][] = [
      ["right", ["ArrowRight"]],
      ["left", ["ArrowLeft"]],
      ["down", ["ArrowDown"]],
      ["up", ["ArrowUp"]],
      ["down-right", ["ArrowDown", "ArrowRight"]],
      ["up-left", ["ArrowUp", "ArrowLeft"]],
      ["down-left", ["ArrowDown", "ArrowLeft"]],
      ["up-right", ["ArrowUp", "ArrowRight"]],
    ];
    for (const [direction, keys] of directions) {
      for (const key of keys) await page.keyboard.down(key);
      await expect(canvas).toHaveAttribute(
        "data-animation-frame",
        new RegExp(`^hero-sage-painted/walk/${direction}/`),
      );
      await page.waitForTimeout(160);
      for (const key of keys) await page.keyboard.up(key);
    }
    await page.getByRole("button", { name: "Świetlista Bariera", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-animation-state", "skill");
    await expect(canvas).toHaveAttribute("data-animation-frame", /^hero-sage-painted\/skill\//);
    await page.screenshot({ path: info.outputPath(`sage-skill-${width}.png`) });
    await expect(canvas).toHaveAttribute("data-animation-state", "idle");
    await page.screenshot({ path: info.outputPath(`sage-idle-${width}.png`) });
    expect(errors).toEqual([]);
  });

test("a broken Mędrcy atlas retries without losing the character", async ({ page }) => {
  await page.route(
    "**/hero-sage-painted-walk-v3/**/hero-sage-painted-walk-v3-fight-0.json",
    (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ frames: {} }) }),
  );
  await page.goto(entry + "?ki-sage-art=1");
  await page.getByRole("button", { name: "Wybierz: Mędrcy", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const error = page.getByRole("alert", { name: "Ładowanie Ki Legends", exact: true });
  await expect(error).toBeVisible();
  await expect(error).toContainText("Brak klatki");
  const id = await activeId(page);
  await page.unroute("**/hero-sage-painted-walk-v3/**/hero-sage-painted-walk-v3-fight-0.json");
  await page.getByRole("button", { name: "Ponów próbę", exact: true }).click();
  await expect(page.locator(".ki-canvas")).toHaveAttribute(
    "data-actor-visual",
    "hero-sage-painted",
  );
  expect(await activeId(page)).toBe(id);
});

test.describe("Mędrcy touch preview", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("real touch joystick animates all eight directions and a tapped skill", async ({
    page,
    context,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await start(page);
    await patchActiveCharacter(page, SHIELD_SAVE);
    const canvas = page.locator(".ki-canvas");
    await expect(canvas).toHaveAttribute("data-actor-visual", "hero-sage-painted");
    const position = () =>
      canvas.evaluate((el) => ({
        x: Number((el as HTMLElement).dataset["playerX"]),
        y: Number((el as HTMLElement).dataset["playerY"]),
      }));
    const cdp = await context.newCDPSession(page);
    const inputs: [string, number, number][] = [
      ["right", 1, 0],
      ["left", -1, 0],
      ["down", 0, 1],
      ["up", 0, -1],
      ["down-right", 1, 1],
      ["up-left", -1, -1],
      ["down-left", -1, 1],
      ["up-right", 1, -1],
    ];
    for (const [direction, dx, dy] of inputs) {
      const before = await position();
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 62, y: 608, id: 1 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 62 + dx * 38, y: 608 + dy * 38, id: 1 }],
      });
      await expect(canvas).toHaveAttribute(
        "data-animation-frame",
        new RegExp(`^hero-sage-painted/walk/${direction}/`),
      );
      await page.waitForTimeout(180);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      const after = await position();
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(12);
    }
    await page.getByRole("button", { name: "Świetlista Bariera", exact: true }).tap();
    await expect(canvas).toHaveAttribute("data-animation-frame", /^hero-sage-painted\/skill\//);
    await page.screenshot({ path: info.outputPath("sage-touch-390.png") });
    expect(errors).toEqual([]);
  });
});
