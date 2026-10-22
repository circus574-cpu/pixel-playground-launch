import { test, expect } from "./fixtures";
for (const [world, race, landmark] of [["nexus", "Androidy", "lab"], ["pyra", "Legendy", "fortress"]]) {
  test(world + " art switch preserves the existing character", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/scripts/playtest.html");
    await page.getByRole("button", { name: "Wybierz: " + race, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    await expect(page.locator(".ki-hud")).toBeVisible();
    await expect(canvas).not.toHaveAttribute("data-texture-ids", new RegExp(world + "-art-"));
    const before = await page.evaluate(() => JSON.stringify(localStorage));
    await page.goto("/scripts/playtest.html?ki-" + world + "-art=1");
    await expect(page.locator(".ki-hud")).toBeVisible();
    await expect(canvas).toHaveAttribute("data-texture-ids", new RegExp(world + "-art-" + landmark));
    await expect(canvas).toHaveAttribute("data-texture-ids", new RegExp(world + "-art-ground"));
    const beforeState = JSON.parse(before) as Record<string, string>;
    const afterState = await page.evaluate(() => ({ ...localStorage }));
    // Existing save keys survive a presentation-only reload (no separate character slot).
    expect(Object.keys(afterState).sort()).toEqual(Object.keys(beforeState).sort());
    expect(errors).toEqual([]);
  });
}
