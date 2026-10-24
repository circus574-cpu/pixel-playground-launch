import { test, expect } from "./fixtures";

const entry = "/scripts/playtest.html";

async function startSage(page: import("@playwright/test").Page, query = "") {
  await page.goto(entry + query);
  await page.getByRole("button", { name: "Wybierz: Mędrcy", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
}

test("Aetheria painted art is the public default on the Superior land", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const canvas = page.locator(".ki-canvas");
  await startSage(page);
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-sage-painted");
  await expect(canvas).toHaveAttribute("data-world", "aether");
  await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
  await expect(canvas).toHaveAttribute("data-texture-ids", /aether-art-ki-source/);
  await expect(canvas).toHaveAttribute("data-texture-ids", /aether-city-hall/);
  // The older opt-in preview switch must not break the single Superior world.
  await page.goto(entry + "?ki-aether-art=1");
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-sage-painted");
  await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
  expect(errors).toEqual([]);
});
