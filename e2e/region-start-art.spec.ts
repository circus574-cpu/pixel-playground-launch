import { test, expect } from "./fixtures";
for (const [world, race, landmark] of [
  ["nexus", "Androidy", "lab"],
  ["pyra", "Legendy", "fortress"],
]) {
  test(world + " art switch preserves the existing character", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.getByRole("button", { name: "Wybierz: " + race, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    await expect(page.locator(".ki-hud")).toBeVisible();
    await expect(canvas).not.toHaveAttribute("data-texture-ids", new RegExp(world + "-art-"));
    const readCharacter = () => page.evaluate(() => {
      const active = Object.keys(localStorage).find((key) => key.endsWith(":active-character"));
      if (!active) throw new Error("Missing active character");
      return { active, id: localStorage.getItem(active), slots: Object.keys(localStorage).filter((key) => key.includes(":character:")).sort() };
    });
    const before = await readCharacter();
    await page.goto("/?ki-" + world + "-art=1");
    await expect(page.locator(".ki-hud")).toBeVisible();
    await expect(canvas).toHaveAttribute("data-texture-ids", new RegExp(world + "-art-" + landmark));
    await expect(canvas).toHaveAttribute("data-texture-ids", new RegExp(world + "-art-ground"));
    expect(await readCharacter()).toEqual(before);
    expect(errors).toEqual([]);
  });
}
