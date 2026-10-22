import { test, expect } from "./fixtures";
const entry = "/scripts/playtest.html";
for (const [world, race, landmark, surface] of [
  ["nexus", "Androidy", "lab", "ground"],
  ["pyra", "Legendy", "fortress", "ground"],
  ["verdant", "Planetarni", "inn", "terrain"],
]) {
  test(world + " art switch preserves the existing character", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(entry);
    await page.getByRole("button", { name: "Wybierz: " + race, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    await expect(page.locator(".ki-hud")).toBeVisible();
    // The anime start-point art and v2 surfaces are public defaults; the old switch stays harmless.
    if (world !== "verdant") {
      await expect(canvas).toHaveAttribute(
        "data-texture-ids",
        new RegExp(world + "-art-" + landmark),
      );
      await expect(canvas).toHaveAttribute("data-texture-ids", new RegExp(world + "-terrain-v2-"));
    }
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
    await page.goto(entry + "?ki-" + world + "-art=1");
    await expect(page.locator(".ki-hud")).toBeVisible();
    await expect(canvas).toHaveAttribute(
      "data-texture-ids",
      new RegExp(world + "-art-" + landmark),
    );
    if (world === "verdant")
      await expect(canvas).toHaveAttribute(
        "data-texture-ids",
        new RegExp(world + "-art-" + surface),
      );
    expect(await readCharacter()).toEqual(before);
    expect(errors).toEqual([]);
  });
}
