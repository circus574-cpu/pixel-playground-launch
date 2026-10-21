import { test, expect } from "./fixtures";

for (const [continent, race, world] of [
  ["verdant", "Planetarni", "verdant"],
  ["aether", "Mędrcy", "aether"],
] as const) {
  test("globe handoff respects " + continent + " and preserves other saves", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    await expect(page.locator(".ki-canvas")).toHaveAttribute("data-world", "verdant");
    const before = await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(([key]) => key.includes(":character:")),
      ),
    );
    await page.goto("/?continent=" + continent);
    await expect(page.getByRole("status")).toContainText(
      continent === "verdant" ? "Verdantia" : "Aetheria",
    );
    await page.getByRole("button", { name: /Twoje postacie/ }).click();
    await expect(page.getByRole("button", { name: "Kontynuuj podróż", exact: true })).toHaveCount(
      continent === "verdant" ? 1 : 0,
    );
    await page.getByRole("button", { name: "Utwórz nową postać" }).click();
    await expect(page.getByRole("region", { name: "Cztery rasy" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wybierz: " + race, exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    await expect(page.locator(".ki-canvas")).toHaveAttribute("data-world", world);
    const after = await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(([key]) => key.includes(":character:")),
      ),
    );
    for (const [key, value] of Object.entries(before)) expect(after[key]).toBe(value);
  });
}
