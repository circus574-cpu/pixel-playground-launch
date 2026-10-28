import {
  openHudTool,
  patchActiveCharacter,
  maxHp,
  nearestSpawn,
  nearestHunter,
  testCreature,
  openDirection,
  liveEnemy,
  superiorLand,
} from "./fixtures";
import { test, expect, type Page } from "./fixtures";
import { RACES, RACE_IDS } from "../src/game/world/races";
import { distance } from "../src/game/navigation";
const entry =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
async function start(page: Page, race: (typeof RACE_IDS)[number], suffix = "") {
  page.setDefaultTimeout(15000);
  await page.goto(entry + suffix);
  await page.getByRole("button", { name: "Wybierz: " + RACES[race].name, exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
  await expect(page.locator(".ki-canvas")).toHaveAttribute("data-world", RACES[race].world);
}
async function position(page: Page) {
  return page.locator(".ki-canvas").evaluate((el) => ({
    x: Number((el as HTMLElement).dataset["playerX"]),
    y: Number((el as HTMLElement).dataset["playerY"]),
  }));
}
async function move(page: Page, x: number, y: number) {
  await page
    .locator(".ki-canvas")
    .evaluate(
      (el, p) =>
        el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", ...p } })),
      { x, y },
    );
  await expect
    .poll(async () => distance(await position(page), { x, y }), { timeout: 300000 })
    .toBeLessThan(8);
}
async function groundClick(page: Page, x: number, y: number, width: number, height: number) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForTimeout(250); // Allow the real follow camera to settle before mapping screen input.
    const point = await page.locator(".ki-canvas").evaluate(
      (el, p) => {
        const d = (el as HTMLElement).dataset,
          z = Number(d["zoom"]),
          px = Number(d["playerX"]),
          py = Number(d["playerY"]);
        const sx = Math.max(0, Math.min(p.width - el.clientWidth / z, px - el.clientWidth / z / 2));
        const sy = Math.max(
          0,
          Math.min(p.height - el.clientHeight / z, py - el.clientHeight / z / 2),
        );
        return { x: (p.x - sx) * z, y: (p.y - sy) * z };
      },
      { x, y, width, height },
    );
    const hit = await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.tagName, point);
    if (hit === "CANVAS") {
      await page.locator("canvas").click({ position: point, timeout: 5000 });
      return true;
    }
    const zoomOut = page.getByRole("button", { name: "Oddal mapę", exact: true });
    if ((await zoomOut.isVisible()) && (await zoomOut.isEnabled()))
      await openHudTool(page, "Oddal mapę");
    else break;
  }
  return false;
}
for (const race of RACE_IDS)
  for (const [width, height] of [
    [390, 844],
    [852, 393],
  ] as const) {
    test.describe(`Android ${race} ${width}x${height}`, () => {
      test.use({
        viewport: { width, height },
        hasTouch: true,
        isMobile: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      });
      test(`real Android input in eight directions: ${race} ${width}x${height}`, async ({
        page,
        context,
      }, info) => {
        const world = superiorLand(RACES[race].world),
          nav = world.nav;
        await start(page, race);
        expect(nav.walkable(await position(page))).toBe(true);
        await expect
          .poll(() => page.locator(".ki-canvas").getAttribute("data-metrics"))
          .not.toBeNull();
        const expectedVisual = {
          planetary: "hero-planetary-painted",
          sage: "hero-sage-painted",
          android: "hero-android",
          legend: "hero-legend",
        }[race];
        await expect(page.locator(".ki-canvas")).toHaveAttribute(
          "data-actor-visual",
          expectedVisual,
        );
        const candidates = [];
        for (let dx = -400; dx <= 400; dx += 80)
          for (let dy = -400; dy <= 400; dy += 80) {
            const p = { x: world.spawn.x + dx, y: world.spawn.y + dy };
            if (
              world.enemies.some((e) => distance(e, p) < 240) ||
              world.npcs.some((n) => distance(n, p) < 190)
            )
              continue;
            if (
              Array.from({ length: 12 }, (_, radius) =>
                Array.from({ length: 16 }, (_, i) => ({
                  x: p.x + Math.cos((i * Math.PI) / 8) * radius * 10,
                  y: p.y + Math.sin((i * Math.PI) / 8) * radius * 10,
                })),
              )
                .flat()
                .every((q) => nav.walkable(q)) &&
              nav.path(world.spawn, p).length
            )
              candidates.push(p);
          }
        candidates.sort((a, b) => distance(a, world.spawn) - distance(b, world.spawn));
        const open = candidates[0]!;
        expect(open).toBeDefined();
        await move(page, open.x, open.y);
        // Context buttons (city plan, doors) may cover one side of the hero; click open ground beside it.
        let mouseGoal: { x: number; y: number } | undefined;
        for (const [dx, dy] of [
          [35, 15],
          [35, -30],
          [-35, -30],
          [-35, 15],
        ] as const) {
          const goal = { x: open.x + dx, y: open.y + dy };
          if (!nav.walkable(goal)) continue;
          if (await groundClick(page, goal.x, goal.y, world.width, world.height)) {
            mouseGoal = goal;
            break;
          }
        }
        if (!mouseGoal) throw new Error("Every mouse test goal beside the hero is covered by HUD");
        await expect.poll(async () => distance(await position(page), mouseGoal)).toBeLessThan(8);
        const inputs = [
          { x: 1, y: 0, keys: ["ArrowRight"] },
          { x: -1, y: 0, keys: ["ArrowLeft"] },
          { x: 0, y: 1, keys: ["ArrowDown"] },
          { x: 0, y: -1, keys: ["ArrowUp"] },
          { x: 1, y: 1, keys: ["ArrowRight", "ArrowDown"] },
          { x: -1, y: -1, keys: ["ArrowLeft", "ArrowUp"] },
          { x: -1, y: 1, keys: ["ArrowLeft", "ArrowDown"] },
          { x: 1, y: -1, keys: ["ArrowRight", "ArrowUp"] },
        ];
        await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        });
        for (const input of inputs) {
          // Each direction starts in the verified clear area. Polling and key
          // delivery take variable time; chained legs otherwise drift into walls.
          await move(page, open.x, open.y);
          const before = await position(page);
          for (const key of input.keys) await page.keyboard.down(key);
          const direction =
            (input.y ? (input.y > 0 ? "down" : "up") + (input.x ? "-" : "") : "") +
            (input.x ? (input.x > 0 ? "right" : "left") : "");
          await expect(page.locator(".ki-canvas")).toHaveAttribute(
            "data-animation-frame",
            new RegExp(`^${expectedVisual}/walk/${direction}/`),
          );
          await page.waitForTimeout(220);
          for (const key of input.keys) await page.keyboard.up(key);
          await expect.poll(async () => distance(await position(page), before)).toBeGreaterThan(12);
          const after = await position(page);
          expect(nav.walkable(after)).toBe(true);
          if (input.x) expect((after.x - before.x) * input.x).toBeGreaterThan(8);
          if (input.y) expect((after.y - before.y) * input.y).toBeGreaterThan(8);
        }
        const cdp = await context.newCDPSession(page),
          x = width * 0.16,
          y = height * 0.72;
        for (const input of inputs) {
          // Each direction starts in the verified clear area. Polling and key
          // delivery take variable time; chained legs otherwise drift into walls.
          await move(page, open.x, open.y);
          const before = await position(page);
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y, id: 1 }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: x + input.x * 38, y: y + input.y * 38, id: 1 }],
          });
          const direction =
            (input.y ? (input.y > 0 ? "down" : "up") + (input.x ? "-" : "") : "") +
            (input.x ? (input.x > 0 ? "right" : "left") : "");
          await expect(page.locator(".ki-canvas")).toHaveAttribute(
            "data-animation-frame",
            new RegExp(`^${expectedVisual}/walk/${direction}/`),
          );
          await page.waitForTimeout(220);
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await expect.poll(async () => distance(await position(page), before)).toBeGreaterThan(12);
          const after = await position(page);
          expect(nav.walkable(after)).toBe(true);
          if (input.x) expect((after.x - before.x) * input.x).toBeGreaterThan(8);
          if (input.y) expect((after.y - before.y) * input.y).toBeGreaterThan(8);
        }
        // Focus is lost while a movement key is down, then restored by a real tab switch.
        await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
        await page.bringToFront();
        await page.keyboard.down("ArrowRight");
        await page.waitForTimeout(180);
        const other = await context.newPage();
        await other.goto("about:blank");
        await other.bringToFront();
        // Some headless Chromium builds keep the background tab focused; then deliver the
        // same window blur the browser sends on a tab switch, so the game's own handler runs.
        const keptFocus = await page.evaluate(() => document.hasFocus());
        if (keptFocus) await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await expect(page.locator(".ki-canvas")).toHaveAttribute("data-focused", "false");
        await other.keyboard.up("ArrowRight");
        const hidden = await position(page);
        await page.waitForTimeout(400);
        expect(distance(await position(page), hidden)).toBeLessThan(2);
        await page.bringToFront();
        if (keptFocus) await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect(page.locator(".ki-canvas")).toHaveAttribute("data-focused", "true");
        await other.close();
        await page.waitForTimeout(350);
        const restored = await position(page);
        await page.waitForTimeout(350);
        expect(distance(await position(page), restored)).toBeLessThan(2);
        await page.keyboard.down("ArrowLeft");
        await page.waitForTimeout(500);
        await page.keyboard.up("ArrowLeft");
        await expect.poll(async () => distance(await position(page), restored)).toBeGreaterThan(12);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({ path: info.outputPath(`${race}-${width}-input.png`) });
      });
    });
  }
for (const race of RACE_IDS)
  test(`real defeat, respawn and movement: ${race}`, async ({ page }, info) => {
    // A known creature waits just outside the safe capital (playtest-only QA spawn).
    test.setTimeout(900000);
    const world = superiorLand(RACES[race].world);
    const creature = testCreature(RACES[race].world);
    await start(page, race, creature.query);
    const max = await maxHp(page);
    const enemy = await liveEnemy(page.locator(".ki-canvas"), creature.id);
    // A normal movement command approaches danger; no HP, kills, timers or saves are patched.
    await page
      .locator(".ki-canvas")
      .evaluate(
        (el, p) =>
          el.dispatchEvent(
            new CustomEvent("ki:command", { detail: { type: "move", x: p.x, y: p.y } }),
          ),
        { x: enemy.x, y: enemy.y + 85 },
      );
    await expect
      .poll(
        async () =>
          Number(
            await page
              .getByRole("meter", { name: "Zdrowie", exact: true })
              .getAttribute("aria-valuenow"),
          ),
        { timeout: 420000 },
      )
      .toBeLessThan(Number(max));
    await expect(page.locator(".ki-death-overlay")).toBeVisible({ timeout: 420000 });
    await page.screenshot({ path: info.outputPath(race + "-death.png") });
    await expect(page.locator(".ki-death-overlay")).toHaveCount(0, { timeout: 60000 });
    await expect.poll(async () => distance(await position(page), world.spawn)).toBeLessThan(8);
    await expect(page.getByRole("meter", { name: "Zdrowie", exact: true })).toHaveAttribute(
      "aria-valuenow",
      max,
    );
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    const before = await position(page);
    // The respawn clip holds the hero in place; walk once it has finished.
    await expect(page.locator(".ki-canvas")).toHaveAttribute(
      "data-animation-state",
      /^(idle|walk)$/,
    );
    const free = openDirection(RACES[race].world, before);
    expect(free).toBeDefined();
    await page.keyboard.down(free);
    await page.waitForTimeout(700);
    await page.keyboard.up(free);
    await expect.poll(async () => distance(await position(page), before)).toBeGreaterThan(15);
  });
test("imported eight-direction rig reacts to real movement and KI; corrupt atlas retries safely", async ({
  page,
}, info) => {
  await start(page, "sage", "?ki-art=technical");
  await patchActiveCharacter(page, { level: 2, skills: ["R", "B1"] });
  const canvas = page.locator(".ki-canvas");
  await expect(canvas).toHaveAttribute("data-actor-visual", "technical-mannequin");
  const seen = new Set<string>();
  for (let i = 0; i < 8; i++) {
    seen.add((await canvas.getAttribute("data-animation-frame"))!);
    await page.waitForTimeout(75);
  }
  expect(seen.size).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Świetlista Bariera", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-animation-state", "skill");
  await expect
    .poll(() => canvas.getAttribute("data-animation-frame"))
    .toMatch(/technical\/skill\//);
  await page.screenshot({ path: info.outputPath("technical-skill.png") });
  await expect(canvas).toHaveAttribute("data-animation-state", "idle");
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.keyboard.down("ArrowRight");
  await expect
    .poll(() => canvas.getAttribute("data-animation-frame"))
    .toMatch(/technical\/walk\/right\//);
  await page.keyboard.up("ArrowRight");
  await openHudTool(page, "Ustawienia");
  await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
  await page.getByRole("button", { name: "Nowa podróż", exact: true }).click();
  await page.route("**/gpu/technical-rig/**/technical-rig.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ frames: {} }) }),
  );
  await page.getByRole("button", { name: "Wybierz: Mędrcy", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const error = page.getByRole("alert", { name: "Ładowanie Ki Legends", exact: true });
  await expect(error).toBeVisible();
  await expect(error).toContainText("Brak klatki");
  await page.unroute("**/gpu/technical-rig/**/technical-rig.json");
  await page.getByRole("button", { name: "Ponów próbę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
  await expect(canvas).toHaveAttribute("data-actor-visual", "technical-mannequin");
});
// Beyond leash plus the longest ranged reach, so every race makes the pursuer give up.
const LOSE_RADIUS = 1000;
for (const race of RACE_IDS)
  test(`real pursuit, return, enemy collision and world boundary: ${race}`, async ({
    page,
  }, info) => {
    test.setTimeout(1200000);
    const world = superiorLand(RACES[race].world),
      nav = world.nav;
    await start(page, race);
    const canvas = page.locator(".ki-canvas"),
      home = nearestHunter(RACES[race].world);
    const enemies = async () =>
      JSON.parse((await canvas.getAttribute("data-enemies"))!) as {
        id: string;
        x: number;
        y: number;
        hp: number;
        mode: string;
      }[];
    const pursuer = async () => (await enemies()).find((e) => e.id === home.id);
    const approach = nav.safe({ x: home.x, y: home.y + 120 });
    await move(page, approach.x, approach.y);
    await expect.poll(async () => (await pursuer())?.mode, { timeout: 180000 }).toBe("chase");
    const fullHp = (await pursuer())!.hp;
    const goals = Array.from({ length: 16 }, (_, i) => ({
      x: home.x + Math.cos((i * Math.PI) / 8) * LOSE_RADIUS,
      y: home.y + Math.sin((i * Math.PI) / 8) * LOSE_RADIUS,
    })).filter((p) => nav.walkable(p) && nav.path(home, p).length);
    goals.sort((a, b) => distance(a, world.spawn) - distance(b, world.spawn));
    const goal = goals[0]!;
    expect(goal).toBeDefined();
    await canvas.evaluate(
      (el, p) =>
        el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", ...p } })),
      goal,
    );
    await expect
      .poll(
        async () => {
          const list = await enemies();
          for (const e of list)
            if (e.hp > 0) expect(nav.walkable(e), e.id + " collision").toBe(true);
          return list.find((e) => e.id === home.id)?.mode;
        },
        { timeout: 60000 },
      )
      .toBe("return");
    await expect.poll(async () => (await pursuer())?.mode, { timeout: 30000 }).toBe("patrol");
    expect((await pursuer())!.hp).toBe(fullHp);
    // Zoom out, then walk to the nearest impassable boundary (coast, cliff or wall) of the land.
    for (let i = 0; i < 4; i++) await openHudTool(page, "Oddal mapę");
    await expect(canvas).toHaveAttribute("data-zoom", "0.35");
    const here = await position(page);
    const edges = [
      { dx: 1, dy: 0, key: "ArrowRight" },
      { dx: -1, dy: 0, key: "ArrowLeft" },
      { dx: 0, dy: -1, key: "ArrowUp" },
      { dx: 0, dy: 1, key: "ArrowDown" },
    ]
      .map((e) => {
        let d = 0;
        while (
          d < 6000 &&
          nav.walkable({ x: here.x + e.dx * (d + 16), y: here.y + e.dy * (d + 16) })
        )
          d += 16;
        return { ...e, d, goal: { x: here.x + e.dx * (d - 48), y: here.y + e.dy * (d - 48) } };
      })
      .filter((e) => e.d < 6000 && e.d > 64 && nav.path(here, e.goal).length)
      .sort((a, b) => a.d - b.d);
    const edge = edges[0]!;
    expect(edge).toBeDefined();
    const east = nav.safe(edge.goal);
    await canvas.evaluate(
      (el, p) =>
        el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", ...p } })),
      east,
    );
    await expect
      .poll(
        async () => {
          const q = await position(page);
          return Math.hypot(q.x - east.x, q.y - east.y);
        },
        { timeout: 300000 },
      )
      .toBeLessThan(120);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.keyboard.down(edge.key);
    await page.waitForTimeout(500);
    await page.keyboard.up(edge.key);
    const p = await position(page);
    expect(nav.walkable(p)).toBe(true);
    expect(p.x).toBeLessThanOrEqual(world.width - 16);
    expect(p.y).toBeLessThanOrEqual(world.height - 16);
    expect(Math.min(p.x, p.y)).toBeGreaterThanOrEqual(16);
    await page.screenshot({ path: info.outputPath(race + "-world-edge.png") });
  });

test("malformed actor atlas fails with a named error and retries without losing the slot", async ({
  page,
}) => {
  // Superior scenery is plain images; the hero page atlas is the frame-indexed sheet a world needs.
  const atlas = "**/hero-planetary-painted-walk-v3/**/hero-planetary-painted-walk-v3-page-0.json";
  await page.route(atlas, (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ frames: {} }) }),
  );
  await page.goto(entry);
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const error = page.getByRole("alert", { name: "Ładowanie Ki Legends", exact: true });
  await expect(error).toBeVisible();
  await expect(error).toContainText("Brak klatki: hero-planetary-painted/");
  const slot = await page.evaluate(() =>
    localStorage.getItem("ki-legends:adventure:v1:superior-world-v1:active-character"),
  );
  await page.unroute(atlas);
  await page.getByRole("button", { name: "Ponów próbę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ki-legends:adventure:v1:superior-world-v1:active-character"),
    ),
  ).toBe(slot);
  await expect(page.locator(".ki-canvas")).toHaveAttribute("data-terrain-mode", "superior");
});
