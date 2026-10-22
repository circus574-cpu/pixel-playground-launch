import { test, expect } from "./fixtures";

test("globe switching disposes contexts and keeps a bounded texture budget", async ({
  page,
}, info) => {
  await page.goto("/mapa");
  const counts: number[] = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    await expect(page.locator(".planet-globe.is-ready")).toBeVisible();
    await expect(page.locator(".pg-canvas canvas")).toHaveCount(1);
    const textures = await page.evaluate(() => {
      const w = window as unknown as {
        __pg: { gl: { info: { memory: { textures: number } } } };
        __qaOldGl: unknown;
      };
      w.__qaOldGl = w.__pg.gl;
      return w.__pg.gl.info.memory.textures;
    });
    counts.push(textures);
    await page.getByRole("button", { name: "Mapa 2D", exact: true }).click();
    await expect(page.locator(".pg-canvas canvas")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const w = window as unknown as { __qaOldGl: { getContext: () => WebGLRenderingContext } };
          return w.__qaOldGl.getContext().isContextLost();
        }),
      )
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => Boolean((window as unknown as { __pg?: unknown }).__pg)))
      .toBe(false);
    if (cycle < 2) await page.getByRole("button", { name: "Globus 3D", exact: true }).click();
  }
  expect(Math.max(...counts)).toBeLessThanOrEqual(6);
  await info.attach("globe-resource-counts", {
    body: JSON.stringify({ texturesPerCycle: counts, source: "SwiftShader, not physical GPU" }),
    contentType: "application/json",
  });
});

test("real WebGL context loss falls back to a working 2D map without saves", async ({ page }) => {
  await page.goto("/mapa");
  await expect(page.locator(".planet-globe.is-ready")).toBeVisible();
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await page.evaluate(() => {
    const w = window as unknown as { __pg: { gl: { getContext: () => WebGLRenderingContext } } };
    const extension = w.__pg.gl.getContext().getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("WEBGL_lose_context unavailable");
    extension.loseContext();
  });
  await expect(
    page.getByText("Karta graficzna przerwała renderowanie globusa", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".pg-canvas canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Legenda i warstwy", exact: true }).click();
  await page
    .locator(".pm-legend")
    .getByRole("button", { name: /^Aetheria/ })
    .click();
  await expect(
    page.getByRole("link", { name: "Wejdź do gry — Aetheria", exact: true }),
  ).toHaveAttribute("href", "/?continent=aether");
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(
    before,
  );
});
