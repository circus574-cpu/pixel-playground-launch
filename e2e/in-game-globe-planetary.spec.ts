import { test, expect } from "./fixtures";

test("Planetary production hero and Superior globe work inside the same Android-sized game session", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/scripts/playtest.html");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();

  const canvas = page.locator(".ki-canvas");
  await expect(canvas).toHaveAttribute("data-world", "verdant");
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-planetary", {
    timeout: 30000,
  });
  const before = {
    world: await canvas.getAttribute("data-world"),
    x: await canvas.getAttribute("data-player-x"),
    y: await canvas.getAttribute("data-player-y"),
  };

  await page.getByRole("button", { name: "Otwórz globus 3D planety Superior" }).click();
  const globe = page.getByTestId("ki-ingame-globe");
  await expect(globe).toBeVisible();
  await expect(globe.locator(".planet-map")).toBeVisible({ timeout: 30000 });
  await expect(page).toHaveURL(/\/scripts\/playtest\.html/);
  await expect(
    page.getByRole("button", { name: "Zamknij globus i kontynuuj rozgrywkę" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Zamknij globus i kontynuuj rozgrywkę" }).click();
  await expect(globe).toHaveCount(0);
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-world", before.world!);
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-planetary");
  await expect(page.locator(".ki-hud")).toBeVisible();
  await expect(page).toHaveURL(/\/scripts\/playtest\.html/);
});
