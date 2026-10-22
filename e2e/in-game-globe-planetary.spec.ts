import { test, expect } from "./fixtures";

test("Planetarni default animation and Superior globe work in the same Android-sized game session", async ({
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
  const world = await canvas.getAttribute("data-world");

  await page.getByRole("button", { name: "Otwórz globus 3D planety Superior" }).click();
  const map = page.getByTestId("ki-ingame-map");
  await expect(map).toBeVisible();
  const globe = map.locator(".pg-stage");
  const fallback = map.locator(".pm-svg");
  await expect
    .poll(async () => (await globe.count()) > 0 || (await fallback.count()) > 0, {
      timeout: 30000,
    })
    .toBe(true);
  await expect(page).toHaveURL(/\/scripts\/playtest\.html/);
  if (await globe.count()) {
    await expect(globe).toBeVisible();
    await map.getByRole("button", { name: "Mapa 2D" }).click();
    await expect(fallback).toBeVisible();
  } else {
    await expect(fallback).toBeVisible();
    await expect(map.getByText(/nie obsługuje WebGL 2|nie mógł się uruchomić/)).toBeVisible();
  }

  await map.getByRole("button", { name: "Zamknij mapę i kontynuuj rozgrywkę" }).click();
  await expect(map).toHaveCount(0);
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-world", world!);
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-planetary");
  await expect(page.locator(".ki-hud")).toBeVisible();
  await expect(page).toHaveURL(/\/scripts\/playtest\.html/);
});
