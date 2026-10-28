import { test, expect } from "@playwright/test";
for (const viewport of [
  { width: 390, height: 844 },
  { width: 852, height: 393 },
]) {
  test(`real touch Coder fields and map component ${viewport.width}`, async ({ browser }, info) => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/docs/zmiany/2026-10-28/qa/coder-gm/ui.html?ki-world-v2=1");
    await page.getByLabel("Szybkość ruchu (jednostki/s)").fill("650");
    await page.getByLabel("Maksymalne HP", { exact: true }).fill("900");
    await page.getByRole("button", { name: "Zapisz zmiany", exact: true }).tap();
    await expect.poll(() => page.evaluate(() => window.__gmComponentQA.saves.length)).toBe(1);
    expect(await page.evaluate(() => window.__gmComponentQA.saves[0])).toMatchObject({
      player: { statOverrides: { speed: 650, maxHp: 900 } },
    });
    await page.getByLabel("Szybkość ruchu (jednostki/s)").scrollIntoViewIfNeeded();
    await info.attach("coder-parameters", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await page.getByRole("button", { name: "Test mapy 2D" }).tap();
    await page.getByRole("button", { name: "Teleportuj", exact: true }).tap();
    const map = page.getByRole("group", {
      name: "Interaktywna mapa planety Superior",
      exact: true,
    });
    const box = await map.boundingBox();
    expect(box).not.toBeNull();
    const cdp = await context.newCDPSession(page);
    const x = viewport.width / 2,
      y = viewport.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 50, y, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(await page.evaluate(() => window.__gmComponentQA.points.length)).toBe(0);
    await info.attach("armed-map-touch", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await page.getByRole("button", { name: "Verdantia — kontynent Planetarni", exact: true }).tap();
    await expect.poll(() => page.evaluate(() => window.__gmComponentQA.points.length)).toBe(1);
    expect(await page.evaluate(() => window.__gmComponentQA.points[0])).toMatchObject({
      land: "verdant",
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(await page.evaluate(() => window.__gmComponentQA.closes)).toBe(1);
    expect(errors).toEqual([]);
    await context.close();
  });
}
