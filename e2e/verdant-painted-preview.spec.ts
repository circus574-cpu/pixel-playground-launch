import { test, expect, openHudTool, type Page } from "./fixtures";

test.use({ viewport: { width: 1280, height: 900 }, hasTouch: true, actionTimeout: 15_000 });

async function walk(page: Page, x: number, y: number, touch = false) {
  const stage = page.locator(".ki-canvas").first();
  const point = await stage.evaluate(
    (el, p) => {
      const b = el.getBoundingClientRect(),
        d = (el as HTMLElement).dataset;
      const zoom = Number(d["cameraZoom"]);
      return {
        x: b.x + (p.x - Number(d["cameraX"]) - b.width / 2) * zoom + b.width / 2,
        y: b.y + (p.y - Number(d["cameraY"]) - b.height / 2) * zoom + b.height / 2,
      };
    },
    { x, y },
  );
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await expect
    .poll(async () =>
      Math.hypot(
        Number(await stage.getAttribute("data-player-x")) - x,
        Number(await stage.getAttribute("data-player-y")) - y,
      ),
    )
    .toBeLessThan(65);
}

for (const preview of [false, true])
  test(`Verdantia: ${preview ? "painted preview" : "unchanged default"}, real movement and shop`, async ({
    page,
  }, info) => {
    const errors: string[] = [],
      missing: string[] = [],
      artRequests: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().includes("/game/") && r.status() >= 400) missing.push(`${r.status()} ${r.url()}`);
      if (r.url().includes("/verdant-painted-preview/")) artRequests.push(r.url());
    });
    await page.goto(
      `/scripts/playtest.html?ki-world-v2=1${preview ? "&ki-verdant-painted=1" : ""}`,
    );
    await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas").first();
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
    await expect(canvas.locator("canvas")).toHaveAttribute(
      "data-superior-painted",
      String(preview),
    );
    await expect
      .poll(async () => JSON.parse((await canvas.getAttribute("data-metrics")) ?? "{}").renderer)
      .toBe(info.project.name === "software-webgl" ? "WebGL" : "Canvas");
    // Real clicks from the arrival to the same shop in the original city geometry.
    await walk(page, 48380, 34790);
    await walk(page, 48036, 34590);
    await openHudTool(page, "Przybliż mapę");
    await openHudTool(page, "Przybliż mapę");
    await openHudTool(page, "Przybliż mapę");
    await page.screenshot({
      path: info.outputPath(
        preview ? "verdantia-painted-real-game.png" : "verdantia-default-real-game.png",
      ),
    });
    await page.getByRole("button", { name: "Wejdź · Dom Handlowy Mio", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-interior", "shop");
    await page.getByRole("button", { name: "Wyjdź do miasta", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-interior", "outside");
    await page.screenshot({
      path: info.outputPath(
        preview ? "verdantia-painted-shop-exit.png" : "verdantia-default-shop-exit.png",
      ),
    });
    await walk(page, 48396, 34290);
    await expect(canvas.locator("canvas")).toHaveAttribute("data-superior-pending", "0");
    await page.screenshot({
      path: info.outputPath(
        preview ? "verdantia-painted-full-scene.png" : "verdantia-default-full-scene.png",
      ),
    });
    if (preview) {
      await page.setViewportSize({ width: 852, height: 393 });
      while (Number(await canvas.getAttribute("data-camera-zoom")) > 0.55)
        await openHudTool(page, "Oddal mapę", "touch");
      await walk(page, 48476, 34350, true);
      await expect(canvas.locator("canvas")).toHaveAttribute("data-superior-pending", "0");
      await page.screenshot({ path: info.outputPath("verdantia-painted-touch-landscape.png") });
    }
    expect(artRequests.length > 0).toBe(preview);
    expect(errors).toEqual([]);
    expect(missing).toEqual([]);
  });
