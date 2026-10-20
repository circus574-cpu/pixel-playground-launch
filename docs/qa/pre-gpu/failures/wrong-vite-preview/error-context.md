# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stage3.spec.ts >> A/B/C: four previews, four independent slots, exploration, camera, NPC, refresh and switching
- Location: e2e/stage3.spec.ts:79:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: 'Cztery rasy' })
Expected: visible
Timeout: 60000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('region', { name: 'Cztery rasy' }) with timeout 60000ms
  - waiting for getByRole('region', { name: 'Cztery rasy' })

```

```yaml
- text: "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/workspace/ki-legends/dist/server/server.js' imported from /workspace/ki-legends/node_modules/@tanstack/start-plugin-core/dist/esm/vite/preview-server-plugin/plugin.js at finalizeResolution (node:internal/modules/esm/resolve:271:11) at moduleResolve (node:internal/modules/esm/resolve:865:10) at defaultResolve (node:internal/modules/esm/resolve:992:11) at #cachedDefaultResolve (node:internal/modules/esm/loader:701:20) at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:721:38) at nextStep (node:internal/modules/customization_hooks:189:26) at Ie (file:///workspace/ki-legends/node_modules/@tailwindcss/node/dist/index.mjs:1:539) at nextStep (node:internal/modules/customization_hooks:189:26) at resolveWithHooks (node:internal/modules/customization_hooks:417:10) at ModuleLoader.resolveSync (node:internal/modules/esm/loader:747:16)"
```

# Test source

```ts
  1   | import { test, expect, type Page } from "./fixtures";
  2   | const races = [
  3   |   {
  4   |     name: "Planetarni",
  5   |     id: "planetary",
  6   |     world: "verdant",
  7   |     continent: "Verdantia",
  8   |     guide: "Aira",
  9   |     settlement: "Wioska Początkowa",
  10  |     action: "Podejdź do rynku",
  11  |     back: "Idź do Airy",
  12  |     x: 1495,
  13  |     y: 1260,
  14  |   },
  15  |   {
  16  |     name: "Mędrcy",
  17  |     id: "sage",
  18  |     world: "aether",
  19  |     continent: "Aetheria",
  20  |     guide: "Sora",
  21  |     settlement: "Sanktuarium Tysiąca Źródeł",
  22  |     action: "Podejdź: Źródło Pamięci",
  23  |     back: "Idź do Sora",
  24  |     x: 1150,
  25  |     y: 1130,
  26  |   },
  27  |   {
  28  |     name: "Androidy",
  29  |     id: "android",
  30  |     world: "nexus",
  31  |     continent: "Nexus-9",
  32  |     guide: "LYRA-7",
  33  |     settlement: "Węzeł Świadomości",
  34  |     action: "Podejdź: Rdzeń Świadomości",
  35  |     back: "Idź do LYRA-7",
  36  |     x: 600,
  37  |     y: 1120,
  38  |   },
  39  |   {
  40  |     name: "Legendy",
  41  |     id: "legend",
  42  |     world: "pyra",
  43  |     continent: "Pyra",
  44  |     guide: "Kaena",
  45  |     settlement: "Twierdza Popiołu",
  46  |     action: "Podejdź: Arena Dziedzictwa",
  47  |     back: "Idź do Kaena",
  48  |     x: 1180,
  49  |     y: 1330,
  50  |   },
  51  | ];
  52  | const path =
  53  |   process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
  54  | async function saved(page: Page) {
  55  |   return page.evaluate(() => {
  56  |     const base = "ki-legends:adventure:v1",
  57  |       id = localStorage.getItem(base + ":active-character");
  58  |     return JSON.parse(localStorage.getItem(base + ":character:" + id) ?? "null")?.player;
  59  |   });
  60  | }
  61  | async function returnToCharacters(page: Page) {
  62  |   await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  63  |   await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
  64  |   await expect(page.locator("canvas")).toHaveCount(0);
  65  | }
  66  | function collectErrors(page: Page) {
  67  |   const errors: string[] = [];
  68  |   page.on("pageerror", (e) => errors.push(e.message));
  69  |   page.on("console", (m) => {
  70  |     if (m.type() === "error") errors.push(m.text());
  71  |   });
  72  |   page.on("response", (r) => {
  73  |     if (r.status() >= 400 && r.url().includes("/game/assets/"))
  74  |       errors.push(`${r.status()} ${r.url()}`);
  75  |   });
  76  |   return errors;
  77  | }
  78  |
  79  | test("A/B/C: four previews, four independent slots, exploration, camera, NPC, refresh and switching", async ({
  80  |   page,
  81  | }, info) => {
  82  |   test.setTimeout(480_000);
  83  |   const errors = collectErrors(page);
  84  |   await page.goto(path);
> 85  |   await expect(page.getByRole("region", { name: "Cztery rasy" })).toBeVisible();
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
  86  |   for (const race of races) {
  87  |     await page
  88  |       .getByRole("button", { name: "Podgląd kontynentu: " + race.name, exact: true })
  89  |       .click();
  90  |     await expect(page.locator(".ki-continent-preview")).toContainText(race.settlement);
  91  |     await expect(page.locator(".ki-continent-preview img")).toHaveJSProperty(
  92  |       "naturalWidth",
  93  |       race.world === "verdant" ? 768 : 2400,
  94  |     );
  95  |     await page.getByRole("button", { name: "Wybierz: " + race.name, exact: true }).click();
  96  |     await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  97  |     const canvas = page.locator(`.ki-canvas[data-world="${race.world}"]`);
  98  |     await expect(canvas).toBeVisible();
  99  |     await expect
  100 |       .poll(async () => Number(await canvas.getAttribute("data-player-x")))
  101 |       .toBeCloseTo(race.x, 0);
  102 |     await expect(page.locator(".ki-player-name")).toContainText(race.name.toUpperCase());
  103 |     await expect(page.locator(".ki-map-title")).toContainText(race.settlement);
  104 |     await expect(page.locator(".ki-location")).toContainText(race.continent);
  105 |     await expect(page.getByRole("button", { name: race.action, exact: true })).toHaveCount(0);
  106 |     await page.screenshot({ path: info.outputPath(race.world + "-start.png") });
  107 |     await page.getByRole("button", { name: new RegExp("Rozmowa · " + race.guide) }).click();
  108 |     await expect(
  109 |       page.getByRole("dialog", { name: "Rozmowa: " + race.guide, exact: true }),
  110 |     ).toBeVisible();
  111 |     await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
  112 |     await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
  113 |     await expect(page.getByRole("button", { name: race.action, exact: true })).toBeVisible();
  114 |     if (race.id !== "planetary")
  115 |       await expect(page.getByRole("button", { name: "Podejdź do rynku", exact: true })).toHaveCount(
  116 |         0,
  117 |       );
  118 |     await page.getByRole("button", { name: race.action, exact: true }).click();
  119 |     await expect
  120 |       .poll(async () => (await saved(page))?.quests.steps, { timeout: 120_000 })
  121 |       .toBe("ready");
  122 |     await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  123 |     await expect(page.getByRole("dialog", { name: "Ustawienia", exact: true })).toBeVisible();
  124 |     await page.waitForTimeout(250);
  125 |     const moved = {
  126 |       x: Number(await canvas.getAttribute("data-player-x")),
  127 |       y: Number(await canvas.getAttribute("data-player-y")),
  128 |     };
  129 |     expect(Math.hypot(moved.x - race.x, moved.y - race.y)).toBeGreaterThan(150);
  130 |     const marker = await page.locator(".ki-map-marker").first().getAttribute("style");
  131 |     await page.reload();
  132 |     await expect(page.locator(`.ki-canvas[data-world="${race.world}"]`)).toBeVisible();
  133 |     const restored = await saved(page);
  134 |     expect(restored.race).toBe(race.id);
  135 |     expect(restored.continent).toBe(race.world);
  136 |     expect(restored.quests.steps).toBe("ready");
  137 |     expect(Math.hypot(restored.x - moved.x, restored.y - moved.y)).toBeLessThan(10);
  138 |     await expect
  139 |       .poll(() => page.locator(".ki-map-marker").first().getAttribute("style"))
  140 |       .toBe(marker);
  141 |     await page.getByRole("button", { name: "Dziennik", exact: true }).click();
  142 |     await page.getByRole("button", { name: race.back, exact: true }).click();
  143 |     await page.getByRole("button", { name: "Odbierz nagrodę", exact: true }).click();
  144 |     expect((await saved(page)).quests.steps).toBe("done");
  145 |     expect((await saved(page)).xp).toBe(40);
  146 |     await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
  147 |     console.log("Verified", race.name, race.world);
  148 |     await returnToCharacters(page);
  149 |     await page.getByRole("button", { name: "Nowa podróż", exact: true }).click();
  150 |   }
  151 |   await page.getByRole("button", { name: /Twoje postacie/ }).click();
  152 |   await expect(page.getByRole("button", { name: "Kontynuuj podróż", exact: true })).toHaveCount(4);
  153 |   await page.getByRole("button", { name: "Kontynuuj podróż", exact: true }).first().click();
  154 |   await expect(page.locator(".ki-canvas[data-world]")).toBeVisible();
  155 |   await expect(page.locator("canvas")).toHaveCount(1);
  156 |   expect(errors).toEqual([]);
  157 | });
  158 |
  159 | for (const [width, height] of [
  160 |   [360, 800],
  161 |   [390, 844],
  162 |   [414, 896],
  163 |   [852, 393],
  164 |   [640, 480],
  165 | ] as const) {
  166 |   test(`E: touch selection, joystick, dialogue and layout ${width}x${height}`, async ({
  167 |     browser,
  168 |   }, info) => {
  169 |     const context = await browser.newContext({
  170 |       viewport: { width, height },
  171 |       hasTouch: true,
  172 |       isMobile: true,
  173 |     });
  174 |     const page = await context.newPage();
  175 |     const errors = collectErrors(page);
  176 |     await page.goto(path);
  177 |     await expect(
  178 |       page.getByRole("button", { name: "Podgląd kontynentu: Planetarni", exact: true }),
  179 |     ).toBeVisible();
  180 |     await page
  181 |       .locator(".ki-race-card img")
  182 |       .first()
  183 |       .evaluate((img) => (img as HTMLImageElement).decode());
  184 |     await page.screenshot({ path: "docs/qa/stage3-1/selection-" + width + "x" + height + ".png" });
  185 |     if (width <= 700) {
```
