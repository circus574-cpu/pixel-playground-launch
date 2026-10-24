# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: three-races-pve.spec.ts >> real PvE journey: sage — quests, 3 kills, loot, equipment, merchant and smith
- Location: e2e/three-races-pve.spec.ts:51:3

# Error details

```
TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Przyjmij zadanie', exact: true })

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
          - generic: MĘDRCY
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
    - button "◆ Pierwsze kroki Porozmawiaj z Sora przy miejscu startowym ›" [ref=e9] [cursor=pointer]:
      - generic [ref=e10]: ◆
      - generic [ref=e11]:
        - strong [ref=e12]: Pierwsze kroki
        - generic [ref=e13]: Porozmawiaj z Sora przy miejscu startowym
      - generic [ref=e14]: ›
    - generic:
      - img "KI LEGENDS":
        - generic [aria-hidden]:
          - strong: KI LEGENDS
      - strong: Sanktuarium Tysiąca Źródeł
      - text: Aetheria
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
    - button "Rozmowa · Sora E" [ref=e42] [cursor=pointer]
    - generic "Powiadomienia gry"
```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | import { RACES, type RaceId } from "../src/game/world/races";
  3   | import { WORLDS } from "../src/game/world/worlds";
  4   | 
  5   | // End-to-end PvE for the three worlds not covered by stage3-pve.spec.ts.
  6   | // All interactions go through the actual game UI or its production movement adapter.
  7   | // No save manipulation, injected kills, fake loot, or bypassed combat.
  8   | const races: { id: RaceId; guide: string; hunter: string; smith: string; merchant: string }[] = [
  9   |   { id: "sage", guide: "Sora", hunter: "Ishin", smith: "Enso", merchant: "Mei" },
  10  |   { id: "android", guide: "LYRA-7", hunter: "AXON", smith: "HEF-4", merchant: "MIRA-2" },
  11  |   { id: "legend", guide: "Kaena", hunter: "Rokan", smith: "Goro", merchant: "Yumi" },
  12  | ];
  13  | const path = process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
  14  | async function state(page: Page) {
  15  |   return page.evaluate(() => {
  16  |     const key = "ki-legends:adventure:v1";
  17  |     const id = localStorage.getItem(key + ":active-character");
  18  |     return JSON.parse(localStorage.getItem(key + ":character:" + id) ?? "null")?.player;
  19  |   });
  20  | }
  21  | async function visit(page: Page, name: string) {
  22  |   await page.getByRole("button", { name: "Otwórz mapę świata", exact: true }).click();
  23  |   await page.getByRole("button", { name, exact: true }).click();
  24  |   await expect(page.getByRole("dialog", { name: /Rozmowa:/ })).toBeVisible();
  25  | }
  26  | async function close(page: Page) {
  27  |   await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
  28  | }
  29  | async function move(page: Page, x: number, y: number) {
  30  |   await page.locator(".ki-canvas").evaluate((el, p) => {
  31  |     el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", x: p.x, y: p.y } }));
  32  |   }, { x, y });
  33  |   await expect.poll(async () => {
  34  |     const p = await state(page);
  35  |     return Math.hypot(p.x - x, p.y - y);
  36  |   }, { timeout: 90000 }).toBeLessThan(95);
  37  | }
  38  | async function clickWorld(page: Page, x: number, y: number, width: number, height: number) {
  39  |   const point = await page.locator(".ki-canvas").evaluate((el, p) => {
  40  |     const zoom = Number((el as HTMLElement).dataset["zoom"] ?? 0.62);
  41  |     const px = Number((el as HTMLElement).dataset["playerX"]);
  42  |     const py = Number((el as HTMLElement).dataset["playerY"]);
  43  |     const w = el.clientWidth, h = el.clientHeight;
  44  |     const scrollX = Math.max(0, Math.min(p.width - w / zoom, px - w / zoom / 2));
  45  |     const scrollY = Math.max(0, Math.min(p.height - h / zoom, py - h / zoom / 2));
  46  |     return { x: (p.x - scrollX) * zoom, y: (p.y - scrollY) * zoom };
  47  |   }, { x, y, width, height });
  48  |   await page.locator("canvas").click({ position: point });
  49  | }
  50  | for (const race of races) {
  51  |   test(`real PvE journey: ${race.id} — quests, 3 kills, loot, equipment, merchant and smith`, async ({ page }, info) => {
  52  |     test.setTimeout(480000);
  53  |     page.setDefaultTimeout(30000);
  54  |     await page.setViewportSize({ width: 1920, height: 1080 });
  55  |     const errors: string[] = [];
  56  |     page.on("pageerror", e => errors.push(e.message));
  57  |     page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  58  |     const world = WORLDS[RACES[race.id].world];
  59  |     await page.goto(path);
  60  |     await page.getByRole("button", { name: "Wybierz: " + RACES[race.id].name, exact: true }).click();
  61  |     await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  62  |     await expect(page.locator('.ki-canvas[data-world="' + world.id + '"]')).toBeVisible();
  63  |     await page.getByRole("button", { name: new RegExp("Rozmowa · " + race.guide) }).click();
> 64  |     await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
      |                                                                               ^ TimeoutError: locator.click: Timeout 30000ms exceeded.
  65  |     await close(page);
  66  |     await page.getByRole("button", { name: world.market.action, exact: true }).click();
  67  |     await expect.poll(async () => (await state(page))?.quests.steps, { timeout: 120000 }).toBe("ready");
  68  |     await page.getByRole("button", { name: "Dziennik", exact: true }).click();
  69  |     await page.getByRole("button", { name: "Idź do " + race.guide, exact: true }).click();
  70  |     await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
  71  |     await close(page);
  72  |     await visit(page, "Idź do " + race.hunter + " · " + world.npcs.find(n => n.id === "hunter")!.role);
  73  |     await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
  74  |     await close(page);
  75  |     expect((await state(page)).quests.boars).toBe("active");
  76  |     // Select three distinct, rendered enemies. They are not defeated via test hooks.
  77  |     for (let index = 0; index < 3; index++) {
  78  |       const enemy = world.enemies[index]!;
  79  |       await move(page, enemy.x - 130, enemy.y + 90);
  80  |       let selected = false;
  81  |       for (const [dx, dy] of [[0,-40],[-40,-40],[40,-40],[0,5],[-40,5],[40,5]] as const) {
  82  |         if (await page.locator(".ki-target").count()) { selected = true; break; }
  83  |         await clickWorld(page, enemy.x + dx, enemy.y + dy, world.width, world.height);
  84  |         await page.waitForTimeout(300);
  85  |       }
  86  |       selected ||= (await page.locator(".ki-target").count()) > 0;
  87  |       expect(selected, `Unable to target rendered enemy ${index+1} in ${world.id}`).toBe(true);
  88  |       for (let attempt = 0; attempt < 45; attempt++) {
  89  |         if ((await state(page)).kills > index) break;
  90  |         for (const name of ["Atak podstawowy", "Impuls KI", "Cięcie płomienia"]) {
  91  |           const button = page.getByRole("button", { name, exact: true });
  92  |           if (await button.isEnabled()) await button.click();
  93  |         }
  94  |         await page.waitForTimeout(450);
  95  |       }
  96  |       await expect.poll(async () => (await state(page)).kills, { timeout: 60000 }).toBe(index + 1);
  97  |       await page.getByRole("button", { name: /Podnieś łup/ }).click();
  98  |       await expect.poll(async () => (await state(page)).items.tusk, { timeout: 30000 }).toBe(index + 1);
  99  |       await page.screenshot({ path: info.outputPath(world.id + "-combat-" + (index + 1) + ".png") });
  100 |     }
  101 |     await visit(page, "Idź do " + race.hunter + " · " + world.npcs.find(n => n.id === "hunter")!.role);
  102 |     await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
  103 |     await close(page);
  104 |     await visit(page, "Idź do " + race.smith + " · " + world.npcs.find(n => n.id === "smith")!.role);
  105 |     await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
  106 |     await close(page);
  107 |     await page.getByRole("button", { name: "Ekwipunek", exact: true }).click();
  108 |     await page.getByRole("button", { name: "Załóż", exact: true }).click();
  109 |     await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
  110 |     await visit(page, "Idź do " + race.smith + " · " + world.npcs.find(n => n.id === "smith")!.role);
  111 |     await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
  112 |     await page.getByRole("button", { name: "Ulepsz ostrze · 15 monet", exact: true }).click();
  113 |     await close(page);
  114 |     await visit(page, "Idź do " + race.merchant + " · " + world.npcs.find(n => n.id === "merchant")!.role);
  115 |     const goldBefore = (await state(page)).gold;
  116 |     await page.getByRole("button", { name: "Kup · 8", exact: true }).click();
  117 |     expect((await state(page)).gold).toBe(goldBefore - 8);
  118 |     await page.getByRole("button", { name: "Sprzedaj · 5", exact: true }).click();
  119 |     await close(page);
  120 |     const p = await state(page);
  121 |     expect(p.quests).toEqual({ steps: "done", boars: "done", gear: "done" });
  122 |     expect(p.upgrade).toBe(1);
  123 |     expect(p.level).toBeGreaterThanOrEqual(2);
  124 |     expect(p.items.tusk).toBe(2);
  125 |     expect(errors).toEqual([]);
  126 |   });
  127 | }
  128 | 
```