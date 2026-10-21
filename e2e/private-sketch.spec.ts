import { test, expect } from "./fixtures";

test("private /test remains locked and independent from game saves", async ({ page }) => {
  const storageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/storage/v1/")) storageRequests.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
  await page.goto("/test");
  await expect(page.getByRole("textbox", { name: /hasło/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /prześlij|pobierz|wyloguj/i })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await page.reload();
  await expect(page.getByRole("textbox", { name: /hasło/i })).toBeVisible();
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(
    before,
  );
  expect(storageRequests).toEqual([]);
  await page.goto("/");
  await expect(page.locator(".ki-hud")).toBeVisible();
  await expect(page.locator(".ki-canvas")).toHaveAttribute("data-world", "verdant");
});
