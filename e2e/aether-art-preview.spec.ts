import { test, expect } from "./fixtures";

const entry = "/scripts/playtest.html";

async function startSage(page: import("@playwright/test").Page, query = "") {
  await page.goto(entry + query);
  await page.getByRole("button", { name: "Wybierz: Mędrcy", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
}

test("Aetheria anime start point loads only behind its review switch", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const canvas = page.locator(".ki-canvas");
  await startSage(page);
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-sage");
  await expect(canvas).not.toHaveAttribute("data-texture-ids", /aether-art-/);
  await page.goto(entry + "?ki-aether-art=1");
  await expect(canvas).toHaveAttribute("data-actor-visual", "hero-sage");
  await expect(canvas).toHaveAttribute("data-texture-ids", /aether-art-sanctum/);
  await expect(canvas).toHaveAttribute("data-texture-ids", /aether-art-aether-ground/);
  expect(errors).toEqual([]);
});
