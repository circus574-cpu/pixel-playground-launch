# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pre-gpu.spec.ts >> Android sage 390x844 >> real Android input in eight directions: sage 390x844
- Location: e2e/pre-gpu.spec.ts:66:7

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 2
Received:   10.93060000000014
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic "Ki Legends — ekran gry" [ref=e4]
  - generic:
    - region "Postać gracza":
      - generic: "1"
      - generic:
        - generic: Wędrowiec
        - meter "Zdrowie":
          - generic: 120 / 120
        - meter "Energia KI":
          - generic: 50 / 50
        - generic "Doświadczenie 0/100"
    - region "Minimapa":
      - generic: Sanktuarium Tysiąca Źródeł
      - button "Otwórz mapę świata" [ref=e6] [cursor=pointer]:
        - 'img "Mapa: Sanktuarium Tysiąca Źródeł" [ref=e7]'
        - generic "Sanktuarium": ◆
        - generic "Źródło Pamięci": ◆
        - generic "Dziki gaj": ◆
    - region "Czat lokalny":
      - button "☷ Czat lokalny" [ref=e9] [cursor=pointer]
    - navigation "Umiejętności":
      - button "Cięcie płomienia" [ref=e10] [cursor=pointer]:
        - generic [ref=e12]: "1"
      - button "Impuls KI" [ref=e13] [cursor=pointer]:
        - generic [ref=e15]: "2"
      - button "Tarcza ducha" [ref=e16] [cursor=pointer]:
        - generic [ref=e18]: "3"
      - button "Atak podstawowy" [ref=e19] [cursor=pointer]:
        - generic [ref=e21]: "4"
      - button "Mikstura życia" [disabled] [ref=e22]:
        - generic [ref=e24]: Q
        - generic [ref=e25]: "3"
    - navigation "Widok mapy":
      - button "Oddal mapę" [ref=e26] [cursor=pointer]: −
      - button "Przybliż mapę" [ref=e27] [cursor=pointer]: +
      - button "Pełny ekran" [ref=e28] [cursor=pointer]: ⛶
    - navigation "Menu gry":
      - button "Ekwipunek" [ref=e29] [cursor=pointer]
      - button "Dziennik" [ref=e31] [cursor=pointer]
      - button "Ustawienia" [ref=e33] [cursor=pointer]
    - button "Rozmowa · Sora E" [ref=e35] [cursor=pointer]
    - generic "Powiadomienia gry"
```

# Test source

```ts
  56  |     [852, 393],
  57  |   ] as const) {
  58  |     test.describe(`Android ${race} ${width}x${height}`, () => {
  59  |       test.use({
  60  |         viewport: { width, height },
  61  |         hasTouch: true,
  62  |         isMobile: true,
  63  |         userAgent:
  64  |           "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  65  |       });
  66  |       test(`real Android input in eight directions: ${race} ${width}x${height}`, async ({
  67  |         page,
  68  |         context,
  69  |       }, info) => {
  70  |         const world = WORLDS[RACES[race].world],
  71  |           nav = new Navigation(world.width, world.height, worldObstacles(world));
  72  |         await start(page, race);
  73  |         expect(nav.walkable(await position(page))).toBe(true);
  74  |         await expect
  75  |           .poll(() => page.locator(".ki-canvas").getAttribute("data-metrics"))
  76  |           .not.toBeNull();
  77  |         expect(await page.locator(".ki-canvas").getAttribute("data-actor-visual")).toBe("human-v2");
  78  |         const candidates = [];
  79  |         for (let dx = -400; dx <= 400; dx += 80)
  80  |           for (let dy = -400; dy <= 400; dy += 80) {
  81  |             const p = { x: world.spawn.x + dx, y: world.spawn.y + dy };
  82  |             if (
  83  |               world.enemies.some((e) => distance(e, p) < 240) ||
  84  |               world.npcs.some((n) => distance(n, p) < 190)
  85  |             )
  86  |               continue;
  87  |             if (
  88  |               Array.from({ length: 16 }, (_, i) => ({
  89  |                 x: p.x + Math.cos((i * Math.PI) / 8) * 110,
  90  |                 y: p.y + Math.sin((i * Math.PI) / 8) * 110,
  91  |               })).every((q) => nav.walkable(q)) &&
  92  |               nav.path(world.spawn, p).length
  93  |             )
  94  |               candidates.push(p);
  95  |           }
  96  |         candidates.sort((a, b) => distance(a, world.spawn) - distance(b, world.spawn));
  97  |         const open = candidates[0]!;
  98  |         expect(open).toBeDefined();
  99  |         await move(page, open.x, open.y);
  100 |         const mouseGoal = { x: open.x + 35, y: open.y + 15 };
  101 |         await groundClick(page, mouseGoal.x, mouseGoal.y, world.width, world.height);
  102 |         await expect.poll(async () => distance(await position(page), mouseGoal)).toBeLessThan(8);
  103 |         const inputs = [
  104 |           { x: 1, y: 0, keys: ["ArrowRight"] },
  105 |           { x: -1, y: 0, keys: ["ArrowLeft"] },
  106 |           { x: 0, y: 1, keys: ["ArrowDown"] },
  107 |           { x: 0, y: -1, keys: ["ArrowUp"] },
  108 |           { x: 1, y: 1, keys: ["ArrowRight", "ArrowDown"] },
  109 |           { x: -1, y: -1, keys: ["ArrowLeft", "ArrowUp"] },
  110 |           { x: -1, y: 1, keys: ["ArrowLeft", "ArrowDown"] },
  111 |           { x: 1, y: -1, keys: ["ArrowRight", "ArrowUp"] },
  112 |         ];
  113 |         await page.evaluate(() => {
  114 |           if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  115 |         });
  116 |         for (const input of inputs) {
  117 |           const before = await position(page);
  118 |           for (const key of input.keys) await page.keyboard.down(key);
  119 |           await page.waitForTimeout(220);
  120 |           for (const key of input.keys) await page.keyboard.up(key);
  121 |           await expect.poll(async () => distance(await position(page), before)).toBeGreaterThan(12);
  122 |           const after = await position(page);
  123 |           expect(nav.walkable(after)).toBe(true);
  124 |           if (input.x) expect((after.x - before.x) * input.x).toBeGreaterThan(8);
  125 |           if (input.y) expect((after.y - before.y) * input.y).toBeGreaterThan(8);
  126 |         }
  127 |         const cdp = await context.newCDPSession(page),
  128 |           x = width * 0.16,
  129 |           y = height * 0.72;
  130 |         for (const input of inputs) {
  131 |           const before = await position(page);
  132 |           await cdp.send("Input.dispatchTouchEvent", {
  133 |             type: "touchStart",
  134 |             touchPoints: [{ x, y, id: 1 }],
  135 |           });
  136 |           await cdp.send("Input.dispatchTouchEvent", {
  137 |             type: "touchMove",
  138 |             touchPoints: [{ x: x + input.x * 38, y: y + input.y * 38, id: 1 }],
  139 |           });
  140 |           await page.waitForTimeout(220);
  141 |           await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  142 |           await expect.poll(async () => distance(await position(page), before)).toBeGreaterThan(12);
  143 |           const after = await position(page);
  144 |           expect(nav.walkable(after)).toBe(true);
  145 |           if (input.x) expect((after.x - before.x) * input.x).toBeGreaterThan(8);
  146 |           if (input.y) expect((after.y - before.y) * input.y).toBeGreaterThan(8);
  147 |         }
  148 |         // Focus is lost while a movement key is down, then restored by a real tab switch.
  149 |         await page.keyboard.down("ArrowRight");
  150 |         await page.waitForTimeout(180);
  151 |         const other = await context.newPage();
  152 |         await other.goto("about:blank");
  153 |         await page.keyboard.up("ArrowRight");
  154 |         const hidden = await position(page);
  155 |         await page.waitForTimeout(400);
> 156 |         expect(distance(await position(page), hidden)).toBeLessThan(2);
      |                                                        ^ Error: expect(received).toBeLessThan(expected)
  157 |         await page.bringToFront();
  158 |         await other.close();
  159 |         await page.waitForTimeout(350);
  160 |         const restored = await position(page);
  161 |         await page.waitForTimeout(350);
  162 |         expect(distance(await position(page), restored)).toBeLessThan(2);
  163 |         await page.keyboard.down("ArrowLeft");
  164 |         await page.waitForTimeout(220);
  165 |         await page.keyboard.up("ArrowLeft");
  166 |         await expect.poll(async () => distance(await position(page), restored)).toBeGreaterThan(12);
  167 |         expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
  168 |           true,
  169 |         );
  170 |         await page.screenshot({ path: info.outputPath(`${race}-${width}-input.png`) });
  171 |       });
  172 |     });
  173 |   }
  174 | for (const race of RACE_IDS)
  175 |   test(`real defeat, respawn and movement: ${race}`, async ({ page }, info) => {
  176 |     const world = WORLDS[RACES[race].world];
  177 |     await start(page, race);
  178 |     const enemy = world.enemies[0]!;
  179 |     // A normal movement command approaches danger; no HP, kills, timers or saves are patched.
  180 |     await page
  181 |       .locator(".ki-canvas")
  182 |       .evaluate(
  183 |         (el, p) =>
  184 |           el.dispatchEvent(
  185 |             new CustomEvent("ki:command", { detail: { type: "move", x: p.x, y: p.y } }),
  186 |           ),
  187 |         { x: enemy.x, y: enemy.y + 85 },
  188 |       );
  189 |     await expect
  190 |       .poll(
  191 |         async () =>
  192 |           Number(
  193 |             await page
  194 |               .getByRole("meter", { name: "Zdrowie", exact: true })
  195 |               .getAttribute("aria-valuenow"),
  196 |           ),
  197 |         { timeout: 30000 },
  198 |       )
  199 |       .toBeLessThan(120);
  200 |     await expect(page.locator(".ki-death-overlay")).toBeVisible({ timeout: 60000 });
  201 |     await page.screenshot({ path: info.outputPath(race + "-death.png") });
  202 |     await expect(page.locator(".ki-death-overlay")).toHaveCount(0, { timeout: 6000 });
  203 |     await expect.poll(async () => distance(await position(page), world.spawn)).toBeLessThan(8);
  204 |     await expect(page.getByRole("meter", { name: "Zdrowie", exact: true })).toHaveAttribute(
  205 |       "aria-valuenow",
  206 |       "120",
  207 |     );
  208 |     await page.evaluate(() => {
  209 |       if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  210 |     });
  211 |     const before = await position(page);
  212 |     await page.keyboard.down("ArrowRight");
  213 |     await page.waitForTimeout(300);
  214 |     await page.keyboard.up("ArrowRight");
  215 |     await expect.poll(async () => distance(await position(page), before)).toBeGreaterThan(15);
  216 |   });
  217 | test("imported eight-direction rig reacts to real movement and KI; corrupt atlas retries safely", async ({
  218 |   page,
  219 | }, info) => {
  220 |   await start(page, "sage", "?ki-art=technical");
  221 |   const canvas = page.locator(".ki-canvas");
  222 |   await expect(canvas).toHaveAttribute("data-actor-visual", "technical-mannequin");
  223 |   const seen = new Set<string>();
  224 |   for (let i = 0; i < 8; i++) {
  225 |     seen.add((await canvas.getAttribute("data-animation-frame"))!);
  226 |     await page.waitForTimeout(75);
  227 |   }
  228 |   expect(seen.size).toBeGreaterThan(1);
  229 |   await page.getByRole("button", { name: "Tarcza ducha", exact: true }).click();
  230 |   await expect(canvas).toHaveAttribute("data-animation-state", "skill");
  231 |   await expect
  232 |     .poll(() => canvas.getAttribute("data-animation-frame"))
  233 |     .toMatch(/technical\/skill\//);
  234 |   await page.screenshot({ path: info.outputPath("technical-skill.png") });
  235 |   await expect(canvas).toHaveAttribute("data-animation-state", "idle");
  236 |   await page.evaluate(() => {
  237 |     if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  238 |   });
  239 |   await page.keyboard.down("ArrowRight");
  240 |   await expect
  241 |     .poll(() => canvas.getAttribute("data-animation-frame"))
  242 |     .toMatch(/technical\/walk\/right\//);
  243 |   await page.keyboard.up("ArrowRight");
  244 |   await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  245 |   await page.getByRole("button", { name: "Zmiana rasy", exact: true }).click();
  246 |   await page.route("**/gpu/technical-rig/**/technical-rig.json", (route) =>
  247 |     route.fulfill({ contentType: "application/json", body: JSON.stringify({ frames: {} }) }),
  248 |   );
  249 |   await page.getByRole("button", { name: "Wybierz: Mędrcy", exact: true }).click();
  250 |   await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  251 |   const error = page.getByRole("alert", { name: "Ładowanie Ki Legends", exact: true });
  252 |   await expect(error).toBeVisible();
  253 |   await expect(error).toContainText("Brak klatki");
  254 |   await page.unroute("**/gpu/technical-rig/**/technical-rig.json");
  255 |   await page.getByRole("button", { name: "Ponów próbę", exact: true }).click();
  256 |   await expect(page.locator(".ki-hud")).toBeVisible();
```