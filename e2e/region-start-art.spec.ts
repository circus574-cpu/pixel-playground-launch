import { test, expect } from "./fixtures";
const entry = "/scripts/playtest.html";
for (const [world, race] of [
  ["nexus", "Androidy"],
  ["pyra", "Legendy"],
  ["verdant", "Planetarni"],
] as const) {
  test(world + " art switch preserves the existing character", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(entry);
    await page.getByRole("button", { name: "Wybierz: " + race, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    await expect(page.locator(".ki-hud")).toBeVisible();
    // The land's painted city art is the public default on the single Superior world.
    const regionArt = new RegExp('"' + world + "-(city|art)-");
    await expect(canvas).toHaveAttribute("data-world", world);
    await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
    await expect(canvas).toHaveAttribute("data-texture-ids", regionArt);
    const readCharacter = () =>
      page.evaluate(() => {
        const active = Object.keys(localStorage).find((key) => key.endsWith(":active-character"));
        if (!active) throw new Error("Missing active character");
        return {
          active,
          id: localStorage.getItem(active),
          slots: Object.keys(localStorage)
            .filter((key) => key.includes(":character:"))
            .sort(),
        };
      });
    const before = await readCharacter();
    // The older opt-in preview switch stays harmless: same character, same world.
    await page.goto(entry + "?ki-" + world + "-art=1");
    await expect(page.locator(".ki-hud")).toBeVisible();
    await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
    await expect(canvas).toHaveAttribute("data-texture-ids", regionArt);
    expect(await readCharacter()).toEqual(before);
    expect(errors).toEqual([]);
  });
}
