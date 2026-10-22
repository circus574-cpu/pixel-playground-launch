import { test, expect } from "./fixtures";

test("Planetarni use production art and the in-game map opens in 2D before its 3D toggle", async ({
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

  await page.getByRole("button", { name: "Otwórz mapę planety Superior 2D" }).click();
  const map = page.getByTestId("ki-ingame-map");
  await expect(map).toBeVisible();
  await expect(map.locator(".pm-svg")).toBeVisible({ timeout: 30000 });
  await expect(map.locator(".pg-stage")).toHaveCount(0);
  await expect(page).toHaveURL(/\/scripts\/playtest\\.html/);

  const switchToGlobe = map.getByRole("button", { name: "Globus 3D", exact: true });
  if (await switchToGlobe.count()) {
    await switchToGlobe.click();
    await expect(map.locator(".pg-stage")).toBeVisible({ timeout: 30000 });
    await map.getByRole("button", { name: "Mapa 2D" }).click();
    await expect(map.locator(".pm-svg")).toBeVisible();
  } else {
    await expect(
      map.getByText(/urządzenie nie obsługuje WebGL 2/),
    ).toBeVisible();
  }

  await map.getByRole("button", { name: "Zamknij mapę i kontynuuj rozgrywkę" }).click();
  await expect(map).toHaveCount(0);
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-world", world!);
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-planetary");
  await expect(page.locator(".ki-hud")).toBeVisible();
  await expect(page).toHaveURL(/\/scripts\/playtest\\.html/);
});
