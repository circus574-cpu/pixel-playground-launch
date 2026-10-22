import { test, expect } from "./fixtures";

const entry = "/scripts/playtest.html";

async function startSage(page: import("@playwright/test").Page, query = "") {
  await page.goto(entry + query);
  await page.getByRole("button", { name: "Wybierz: Mędrcy", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
}

test("Aetheria anime start point and v2 terrain are public defaults", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const canvas = page.locator(".ki-canvas");
  await startSage(page);
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-sage-painted");
  await expect(canvas).toHaveAttribute("data-texture-ids", /aether-art-sanctum/);
  await expect(canvas).toHaveAttribute("data-texture-ids", /aether-terrain-v2-ground/);
  await page.goto(entry + "?ki-aether-art=1");
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-sage-painted");
  await expect(canvas).toHaveAttribute("data-texture-ids", /aether-art-sanctum/);
  expect(errors).toEqual([]);
});
