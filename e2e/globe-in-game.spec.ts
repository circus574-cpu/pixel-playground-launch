import { test, expect } from "./fixtures";

test("Android-sized live game opens globe 3D without leaving the hero or overwriting saves", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const canvas = page.locator(".ki-canvas");
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-planetary");
  const x = await canvas.getAttribute("data-player-x");
  const y = await canvas.getAttribute("data-player-y");
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await page.getByRole("button", { name: "Otwórz mapę świata" }).click();
  await expect(page.getByRole("dialog", { name: "Mapa regionu" })).toBeVisible();
  await expect(page.locator(".ki-full-map img")).toBeVisible();
  await expect(page.locator(".ki-world-globe")).toHaveCount(0);
  await page
    .getByRole("button", { name: /Otwórz globus 3D planety Superior bez opuszczania gry/ })
    .click();
  await expect(page.getByRole("dialog", { name: /Globus 3D planety Superior/ })).toBeVisible();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Wróć do mapy 2D" })).toBeVisible();
  await page.getByRole("button", { name: "Wróć do mapy 2D" }).click();
  await expect(page.locator(".ki-world-globe")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Mapa regionu" })).toBeVisible();
  await page.getByRole("button", { name: "Zamknij okno" }).click();
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-planetary");
  await expect(canvas).toHaveAttribute("data-player-x", x!);
  await expect(canvas).toHaveAttribute("data-player-y", y!);
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(
    before,
  );
});

test("the existing region map can open the in-game globe and close back to the same session", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await page.getByRole("button", { name: "Otwórz mapę świata" }).click();
  await expect(page.getByRole("dialog", { name: "Mapa regionu" })).toBeVisible();
  await page
    .getByRole("button", { name: /Otwórz globus 3D planety Superior bez opuszczania gry/ })
    .click();
  await expect(page.getByRole("dialog", { name: /Globus 3D planety Superior/ })).toBeVisible();
  await page.getByRole("button", { name: "Wróć do mapy 2D" }).click();
  await expect(page.getByRole("dialog", { name: "Mapa regionu" })).toBeVisible();
  await page.getByRole("button", { name: "Zamknij okno" }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
  await expect(page).toHaveURL("/");
});
