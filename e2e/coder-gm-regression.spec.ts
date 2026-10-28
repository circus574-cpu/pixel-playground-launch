import { test, expect } from "./fixtures";
test.use({ hasTouch: true, isMobile: true, viewport: { width: 852, height: 393 } });
test("ordinary character has no GM map teleport and retains touch movement", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/scripts/playtest.html?ki-world-v2=1");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).tap();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).tap();
  await expect(page.locator(".ki-hud")).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Otwórz mapę świata", exact: true }).tap();
  await expect(page.getByRole("dialog", { name: "Mapa planety", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Teleportuj", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Wróć do gry", exact: true }).tap();
  const host = page.locator(".ki-canvas");
  const before = {
    x: Number(await host.getAttribute("data-player-x")),
    y: Number(await host.getAttribute("data-player-y")),
  };
  const cdp = await page.context().newCDPSession(page);
  const start = { x: 110, y: 283, id: 1 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...start, x: 150 }],
  });
  await expect
    .poll(async () =>
      Math.hypot(
        Number(await host.getAttribute("data-player-x")) - before.x,
        Number(await host.getAttribute("data-player-y")) - before.y,
      ),
    )
    .toBeGreaterThan(1);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await info.attach("ordinary-character-after-map", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  expect(errors).toEqual([]);
});
