import { test, expect, type Page } from "@playwright/test";
const emptyAdminWorldOverrides = () => ({
  version: 1,
  updatedAt: "2026-11-12T00:00:00Z",
  ...Object.fromEntries(
    [
      "features",
      "continents",
      "citiesV2",
      "famousPlaces",
      "hiddenPlaces",
      "roadsV2",
      "worldEvents",
      "monsters",
      "bosses",
      "races",
      "skillNodes",
      "runtimeItems",
      "catalogItems",
      "materials",
      "recipes",
      "quests",
      "dialogues",
      "customSpawns",
    ].map((k) => [k, {}]),
  ),
});

test.use({
  baseURL: process.env["KI_QA_APP_URL"] ?? "http://127.0.0.1:4176",
  video: "on",
  hasTouch: true,
});
async function session(page: Page, roles: string[]) {
  await page.addInitScript(() => {
    localStorage.setItem("ki-legends:account-refresh-v1", "local-admin-qa");
    localStorage.setItem("ki-legends:qa-protected-character", '{"level":12,"skills":["R","A1"]}');
  });
  await page.route("**/ws/auth/refresh", (r) =>
    r.fulfill({
      json: {
        accessToken: "local-qa-access-token",
        refreshToken: "local-admin-qa",
        expiresIn: 3600,
        account: {
          id: "local-qa-admin",
          email: "local-qa@example.invalid",
          nick: "Administrator QA",
          roles,
          createdAt: "2026-11-12T00:00:00Z",
          lastLoginAt: null,
        },
      },
    }),
  );
  await page.route("**/ws/world/overrides", (r) =>
    r.fulfill({
      json: {
        revision: 7,
        publishedAt: "2026-11-12T00:00:00Z",
        publishedBy: null,
        data: emptyAdminWorldOverrides(),
      },
    }),
  );
}
test("anonymous visitors cannot open the complete administrator atlas", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/game/worlds/")) requested.push(r.url());
  });
  await page.goto("/admin?view=world-overview");
  await expect(page.getByRole("heading", { name: "Brak dostępu" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Świat — przegląd", exact: true })).toHaveCount(0);
  expect(requested).toEqual([]);
});
test("GM cannot see the owner-only overview", async ({ page }) => {
  await session(page, ["gm"]);
  await page.goto("/admin?view=world-overview");
  await expect(
    page.getByRole("heading", { name: "Panel administracyjny", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Świat — przegląd", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("world-overview-canvas")).toHaveCount(0);
});
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 852, height: 393 },
]) {
  test(`real /admin atlas: complete V2 data, exact points and rooms ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await session(page, ["admin"]);
    const errors: string[] = [],
      writes: string[] = [],
      worldRequests: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.url().includes("/ws/world/") && r.method() !== "GET") writes.push(r.url());
      if (new URL(r.url()).pathname.startsWith("/game/worlds/")) worldRequests.push(r.url());
    });
    await page.goto("/admin?view=world-overview");
    await expect(page.getByRole("tab", { name: "Świat — przegląd", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("10/10", { exact: true })).toBeVisible();
    const overview = page.getByRole("region", { name: "Świat — przegląd", exact: true });
    await expect(overview.locator(".ki-overview-stats")).toContainText(/8\s?752/);
    await expect(overview.locator(".ki-overview-stats")).toContainText("rewizja 7");
    const canvas = page.getByTestId("world-overview-canvas");
    await expect(canvas).toHaveAttribute("data-background-loaded", "1");
    await expect(canvas).toHaveAttribute("data-road-count", "1715");
    expect(await overview.locator(".ki-overview-results > button").count()).toBeLessThanOrEqual(40);
    if (viewport.width === 1280)
      await overview.screenshot({ path: info.outputPath("whole-planet.png") });
    await page.getByRole("textbox", { name: "Szukaj na mapie świata" }).fill("verdant-spawn-0");
    const result = overview.locator('[data-entry-layer="spawns"][data-entry-id="verdant-spawn-0"]');
    await expect(result).toBeVisible();
    await result.click();
    await expect(page.getByRole("combobox", { name: "Ląd na mapie" })).toHaveValue("verdant");
    await expect(overview.locator(".ki-overview-detail")).toContainText(/28\s688/);
    await expect(overview.locator(".ki-overview-detail")).toContainText(/31\s888/);
    await expect(overview.locator(".ki-overview-detail")).toContainText("Odrodzenie: 25 s");
    await page.getByRole("textbox", { name: "Szukaj na mapie świata" }).fill("npc-mio");
    await overview.locator('[data-entry-layer="npcs"]').first().click();
    await expect(canvas).toHaveAttribute("data-scope", /shop$/);
    await expect(canvas).toHaveAttribute("data-background-loaded", "1");
    await expect(overview.locator(".ki-overview-detail")).toContainText("Mio");
    await overview.screenshot({ path: info.outputPath(`npc-interior-${viewport.width}.png`) });
    await page.getByRole("button", { name: "◎ Planeta", exact: true }).click();
    await page.getByRole("textbox", { name: "Szukaj na mapie świata" }).fill("");
    await page.getByRole("combobox", { name: "Ląd na mapie" }).selectOption("island-3");
    await expect(canvas).toHaveAttribute("data-scope", "island-3");
    await expect(canvas).toHaveAttribute("data-background-loaded", "1");
    await page.getByRole("combobox", { name: "Quest na mapie" }).selectOption({ index: 4 });
    await expect(overview.locator(".ki-overview-quest")).toBeVisible();
    await expect(overview.locator(".ki-overview-quest")).toContainText("XP");
    await page.getByRole("tab", { name: /Bez pozycji/ }).click();
    await expect(
      page.getByRole("heading", { name: "Bossowie bez rozmieszczenia w świecie" }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Mapa szczegółowa", exact: true }).click();
    await page.getByRole("combobox", { name: "Źródło danych świata" }).selectOption("canonical");
    await expect(page.getByText("10/10", { exact: true })).toBeVisible();
    await expect(overview.locator(".ki-overview-stats")).toContainText("Bazowa zawartość V2");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    expect(
      await page.evaluate(() => localStorage.getItem("ki-legends:qa-protected-character")),
    ).toBe('{"level":12,"skills":["R","A1"]}');
    expect(writes).toEqual([]);
    expect(worldRequests.length).toBeGreaterThan(50);
    expect(worldRequests.every((url) => url.includes("/superior-v2/"))).toBe(true);
    expect(errors).toEqual([]);
  });
}
test("source errors are explicit and retry loads the verified world", async ({ page }) => {
  await session(page, ["admin"]);
  let broken = true;
  await page.route("**/game/worlds/superior-v2/aether/world.json", (r) =>
    broken ? r.fulfill({ status: 503, body: "Temporary local QA error" }) : r.continue(),
  );
  await page.goto("/admin?view=world-overview");
  await expect(page.getByRole("alert")).toContainText("503");
  broken = false;
  await page.getByRole("button", { name: "Ponów odczyt świata" }).click();
  await expect(page.getByText("10/10", { exact: true })).toBeVisible();
});

test("tools: bounded scenery, coordinates export, pan, pinch and cancellation", async ({
  page,
}) => {
  await session(page, ["admin"]);
  await page.goto("/admin?view=world-overview");
  await expect(page.getByText("10/10", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Szukaj na mapie świata" }).fill("verdant-spawn-0");
  await page.locator('[data-entry-layer="spawns"][data-entry-id="verdant-spawn-0"]').click();
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/\/chunks\/.*\.art\.json$/.test(r.url())) requests.push(r.url());
  });
  await page.getByRole("checkbox", { name: /Dekoracje w zbliżeniu/ }).check();
  await expect(page.getByRole("status")).toContainText(/Dekoracje: [1-9]/);
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.length).toBeLessThanOrEqual(12);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksport JSON", exact: true }).click();
  const download = await downloadPromise;
  const { readFile } = await import("node:fs/promises"),
    exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.world).toBe("superior-v2");
  expect(
    exported.entries.find((e: { sourceId: string }) => e.sourceId === "verdant-spawn-0"),
  ).toMatchObject({ x: 28688, y: 31888, land: "verdant" });
  const canvas = page.getByTestId("world-overview-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 20, { steps: 5 });
  await canvas.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await canvas.focus();
  const before = Number(await canvas.getAttribute("data-zoom"));
  await page.keyboard.press("+");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-zoom")))
    .toBeGreaterThan(before);
  const cdp = await page.context().newCDPSession(page),
    rect = (await canvas.boundingBox())!,
    x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2;
  const z = Number(await canvas.getAttribute("data-zoom"));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 35, y, id: 10 },
      { x: x + 35, y, id: 11 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 55, y, id: 10 },
      { x: x + 55, y, id: 11 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect.poll(async () => Number(await canvas.getAttribute("data-zoom"))).toBeGreaterThan(z);
  await cdp.detach();
});
