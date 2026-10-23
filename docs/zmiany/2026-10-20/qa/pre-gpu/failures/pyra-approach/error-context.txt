# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pre-gpu.spec.ts >> real pursuit, return, enemy collision and world boundary: legend
- Location: e2e/pre-gpu.spec.ts:272:3

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 8
Received:   890.0561780022653

Call Log:
- Timeout 60000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic "Ki Legends — ekran gry" [ref=e4]
  - generic:
    - region "Postać gracza":
      - generic: "1"
      - generic:
        - generic:
          - text: Wędrowiec
          - generic: LEGENDY
        - meter "Zdrowie":
          - generic: 120 / 120
        - meter "Energia KI":
          - generic: 50 / 50
        - generic "Doświadczenie 0/100"
    - region "Minimapa":
      - generic: Twierdza Popiołu
      - button "Otwórz mapę świata" [ref=e6] [cursor=pointer]:
        - 'img "Mapa: Twierdza Popiołu" [ref=e7]'
        - generic "Twierdza Popiołu": ◆
        - generic "Arena Dziedzictwa": ◆
        - generic "Szczeliny": ◆
    - button "◆ Pierwsze kroki Porozmawiaj z Kaena przy miejscu startowym ›" [ref=e9] [cursor=pointer]:
      - generic [ref=e10]: ◆
      - generic [ref=e11]:
        - strong [ref=e12]: Pierwsze kroki
        - generic [ref=e13]: Porozmawiaj z Kaena przy miejscu startowym
      - generic [ref=e14]: ›
    - generic:
      - img "KI LEGENDS":
        - generic [aria-hidden]:
          - strong: KI LEGENDS
      - strong: Twierdza Popiołu
      - text: Pyra
    - region "Czat lokalny":
      - button "☷ Czat lokalny" [ref=e15] [cursor=pointer]
    - navigation "Umiejętności":
      - button "Cięcie płomienia" [ref=e16] [cursor=pointer]:
        - generic [ref=e18]: "1"
      - button "Impuls KI" [ref=e19] [cursor=pointer]:
        - generic [ref=e21]: "2"
      - button "Tarcza ducha" [ref=e22] [cursor=pointer]:
        - generic [ref=e24]: "3"
      - button "Atak podstawowy" [ref=e25] [cursor=pointer]:
        - generic [ref=e27]: "4"
      - button "Mikstura życia" [disabled] [ref=e28]:
        - generic [ref=e30]: Q
        - generic [ref=e31]: "3"
    - navigation "Widok mapy":
      - button "Oddal mapę" [ref=e32] [cursor=pointer]: −
      - button "Przywróć oddalenie mapy" [ref=e33] [cursor=pointer]: 62%
      - button "Przybliż mapę" [ref=e34] [cursor=pointer]: +
      - button "Pełny ekran" [ref=e35] [cursor=pointer]: ⛶
    - navigation "Menu gry":
      - button "Ekwipunek" [ref=e36] [cursor=pointer]
      - button "Dziennik" [ref=e38] [cursor=pointer]
      - button "Ustawienia" [ref=e40] [cursor=pointer]
    - button "Rozmowa · Kaena E" [ref=e42] [cursor=pointer]
    - generic "Powiadomienia gry"
```

# Test source

```ts
  1   | import { test, expect, type Page } from "./fixtures";
  2   | import { RACES, RACE_IDS } from "../src/game/world/races";
  3   | import { WORLDS, worldObstacles } from "../src/game/world/worlds";
  4   | import { Navigation, distance } from "../src/game/navigation";
  5   | const entry =
  6   |   process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
  7   | async function start(page: Page, race: (typeof RACE_IDS)[number], suffix = "") {
  8   |   page.setDefaultTimeout(15000);
  9   |   await page.goto(entry + suffix);
  10  |   await page.getByRole("button", { name: "Wybierz: " + RACES[race].name, exact: true }).click();
  11  |   await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  12  |   await expect(page.locator(".ki-hud")).toBeVisible();
  13  |   await expect(page.locator(".ki-canvas")).toHaveAttribute("data-world", RACES[race].world);
  14  | }
  15  | async function position(page: Page) {
  16  |   return page.locator(".ki-canvas").evaluate((el) => ({
  17  |     x: Number((el as HTMLElement).dataset["playerX"]),
  18  |     y: Number((el as HTMLElement).dataset["playerY"]),
  19  |   }));
  20  | }
  21  | async function move(page: Page, x: number, y: number) {
  22  |   await page
  23  |     .locator(".ki-canvas")
  24  |     .evaluate(
  25  |       (el, p) =>
  26  |         el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", ...p } })),
  27  |       { x, y },
  28  |     );
  29  |   await expect
  30  |     .poll(async () => distance(await position(page), { x, y }), { timeout: 60000 })
  31  |     .toBeLessThan(8);
  32  | }
> 33  | async function groundClick(page: Page, x: number, y: number, width: number, height: number) {
      |      ^ Error: expect(received).toBeLessThan(expected)
  34  |   for (let attempt = 0; attempt < 3; attempt++) {
  35  |     await page.waitForTimeout(250); // Allow the real follow camera to settle before mapping screen input.
  36  |     const point = await page.locator(".ki-canvas").evaluate(
  37  |       (el, p) => {
  38  |         const d = (el as HTMLElement).dataset,
  39  |           z = Number(d["zoom"]),
  40  |           px = Number(d["playerX"]),
  41  |           py = Number(d["playerY"]);
  42  |         const sx = Math.max(0, Math.min(p.width - el.clientWidth / z, px - el.clientWidth / z / 2));
  43  |         const sy = Math.max(
  44  |           0,
  45  |           Math.min(p.height - el.clientHeight / z, py - el.clientHeight / z / 2),
  46  |         );
  47  |         return { x: (p.x - sx) * z, y: (p.y - sy) * z };
  48  |       },
  49  |       { x, y, width, height },
  50  |     );
  51  |     const hit = await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.tagName, point);
  52  |     if (hit === "CANVAS") {
  53  |       await page.locator("canvas").click({ position: point, timeout: 5000 });
  54  |       return;
  55  |     }
  56  |     const zoomOut = page.getByRole("button", { name: "Oddal mapę", exact: true });
  57  |     if (await zoomOut.isEnabled()) await zoomOut.click();
  58  |     else break;
  59  |   }
  60  |   throw new Error("Mouse test goal is hidden by HUD or outside the viewport even at minimum zoom");
  61  | }
  62  | for (const race of RACE_IDS)
  63  |   for (const [width, height] of [
  64  |     [390, 844],
  65  |     [852, 393],
  66  |   ] as const) {
  67  |     test.describe(`Android ${race} ${width}x${height}`, () => {
  68  |       test.use({
  69  |         viewport: { width, height },
  70  |         hasTouch: true,
  71  |         isMobile: true,
  72  |         userAgent:
  73  |           "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  74  |       });
  75  |       test(`real Android input in eight directions: ${race} ${width}x${height}`, async ({
  76  |         page,
  77  |         context,
  78  |       }, info) => {
  79  |         const world = WORLDS[RACES[race].world],
  80  |           nav = new Navigation(world.width, world.height, worldObstacles(world));
  81  |         await start(page, race);
  82  |         expect(nav.walkable(await position(page))).toBe(true);
  83  |         await expect
  84  |           .poll(() => page.locator(".ki-canvas").getAttribute("data-metrics"))
  85  |           .not.toBeNull();
  86  |         expect(await page.locator(".ki-canvas").getAttribute("data-actor-visual")).toBe("human-v2");
  87  |         const candidates = [];
  88  |         for (let dx = -400; dx <= 400; dx += 80)
  89  |           for (let dy = -400; dy <= 400; dy += 80) {
  90  |             const p = { x: world.spawn.x + dx, y: world.spawn.y + dy };
  91  |             if (
  92  |               world.enemies.some((e) => distance(e, p) < 240) ||
  93  |               world.npcs.some((n) => distance(n, p) < 190)
  94  |             )
  95  |               continue;
  96  |             if (
  97  |               Array.from({ length: 16 }, (_, i) => ({
  98  |                 x: p.x + Math.cos((i * Math.PI) / 8) * 110,
  99  |                 y: p.y + Math.sin((i * Math.PI) / 8) * 110,
  100 |               })).every((q) => nav.walkable(q)) &&
  101 |               nav.path(world.spawn, p).length
  102 |             )
  103 |               candidates.push(p);
  104 |           }
  105 |         candidates.sort((a, b) => distance(a, world.spawn) - distance(b, world.spawn));
  106 |         const open = candidates[0]!;
  107 |         expect(open).toBeDefined();
  108 |         await move(page, open.x, open.y);
  109 |         const mouseGoal = { x: open.x + 35, y: open.y + 15 };
  110 |         await groundClick(page, mouseGoal.x, mouseGoal.y, world.width, world.height);
  111 |         await expect.poll(async () => distance(await position(page), mouseGoal)).toBeLessThan(8);
  112 |         const inputs = [
  113 |           { x: 1, y: 0, keys: ["ArrowRight"] },
  114 |           { x: -1, y: 0, keys: ["ArrowLeft"] },
  115 |           { x: 0, y: 1, keys: ["ArrowDown"] },
  116 |           { x: 0, y: -1, keys: ["ArrowUp"] },
  117 |           { x: 1, y: 1, keys: ["ArrowRight", "ArrowDown"] },
  118 |           { x: -1, y: -1, keys: ["ArrowLeft", "ArrowUp"] },
  119 |           { x: -1, y: 1, keys: ["ArrowLeft", "ArrowDown"] },
  120 |           { x: 1, y: -1, keys: ["ArrowRight", "ArrowUp"] },
  121 |         ];
  122 |         await page.evaluate(() => {
  123 |           if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  124 |         });
  125 |         for (const input of inputs) {
  126 |           const before = await position(page);
  127 |           for (const key of input.keys) await page.keyboard.down(key);
  128 |           await page.waitForTimeout(220);
  129 |           for (const key of input.keys) await page.keyboard.up(key);
  130 |           await expect.poll(async () => distance(await position(page), before)).toBeGreaterThan(12);
  131 |           const after = await position(page);
  132 |           expect(nav.walkable(after)).toBe(true);
  133 |           if (input.x) expect((after.x - before.x) * input.x).toBeGreaterThan(8);
```