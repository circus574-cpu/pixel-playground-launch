import { test, expect } from "./fixtures";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`in-game v2 map preloads, pans and returns to movement ${viewport.width}`, async ({
    page,
  }, info) => {
    test.setTimeout(240_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => performance.setResourceTimingBufferSize(5000));
    await page.goto("/?ki-world-v2=1");
    await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    await expect(page.locator(".ki-hud")).toBeVisible({ timeout: 120_000 });
    // Actual startup requests, before opening a map. No save or game-state injection.
    const resources = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((e) => e.name),
    );
    expect(resources.some((url) => url.includes("atlas-v2-3840"))).toBe(true);
    expect(resources.some((url) => url.includes("verdant/map-hi.webp"))).toBe(true);
    const started = Date.now();
    await page.getByRole("button", { name: "Otwórz mapę świata", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Mapa planety", exact: true })).toBeVisible();
    const canvas = page.locator(".pm-terrain-canvas");
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(0);
    expect(await page.locator(".pm-world image").count()).toBe(0);
    const map = page.getByRole("group", {
      name: "Interaktywna mapa planety Superior",
      exact: true,
    });
    const view = await map.getAttribute("viewBox");
    await map.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(map).not.toHaveAttribute("viewBox", view!);
    const frames = await page.evaluate(async () => {
      const deltas: number[] = [];
      let last = performance.now();
      for (let i = 0; i < 30; i++) {
        const next = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
        deltas.push(next - last);
        last = next;
      }
      return deltas;
    });
    await info.attach("map-measurements", {
      body: JSON.stringify({
        viewport,
        readyAfterClickMs: Date.now() - started,
        frameIntervalsMs: frames,
        note: "Local browser; software rendering, not physical phone FPS",
      }),
      contentType: "application/json",
    });
    await info.attach("map-screen", { body: await page.screenshot(), contentType: "image/png" });
    if (info.project.name === "application-webgl") {
      await page.getByRole("button", { name: "Globus 3D", exact: true }).click();
      await expect(page.locator(".planet-globe.is-ready")).toBeVisible();
      await page.getByRole("button", { name: "Mapa 2D", exact: true }).click();
      await expect(canvas).toBeVisible();
    }
    await page.getByRole("button", { name: "Wróć do gry", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Mapa planety", exact: true })).toHaveCount(0);
    const host = page.locator(".ki-canvas");
    const before = await host.getAttribute("data-player-x");
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(500);
    await page.keyboard.up("ArrowRight");
    await expect(host).not.toHaveAttribute("data-player-x", before ?? "");
    expect(errors).toEqual([]);
  });
}
