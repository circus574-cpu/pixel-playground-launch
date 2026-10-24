import { openHudTool } from "./fixtures";
import { test, expect } from "./fixtures";
const path =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
])
  test("temporary race switch preserves each save " + viewport.width, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(path);
    await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    await expect(page.locator(".ki-hud")).toBeVisible();
    const base = "ki-legends:adventure:v1:superior-world-v1";
    const originalId = await page.evaluate(
      (base) => localStorage.getItem(base + ":active-character"),
      base,
    );
    await page.getByRole("button", { name: /Rozmowa · Aira/ }).click();
    await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
    for (const [name, world] of [
      ["Mędrcy", "aether"],
      ["Androidy", "nexus"],
      ["Legendy", "pyra"],
    ]) {
      await openHudTool(page, "Ustawienia");
      if (name === "Mędrcy") await page.screenshot({ path: info.outputPath("settings.png") });
      await page.getByRole("button", { name: "Zmiana rasy", exact: true }).click();
      await expect(page.getByRole("region", { name: "Cztery rasy" })).toBeVisible();
      await expect(page.locator("canvas")).toHaveCount(0);
      await page.getByRole("button", { name: "Wybierz: " + name, exact: true }).click();
      await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
      await expect(page.locator(".ki-hud")).toBeVisible();
      await expect(page.locator(".ki-canvas")).toHaveAttribute("data-world", world!);
      await page.reload();
      await expect(page.locator(".ki-hud")).toBeVisible();
      await expect(page.locator(".ki-canvas")).toHaveAttribute("data-world", world!);
    }
    await openHudTool(page, "Ustawienia");
    await page.getByRole("button", { name: "Zmiana rasy", exact: true }).click();
    const old = await page.evaluate(
      ({ base, id }) => JSON.parse(localStorage.getItem(base + ":character:" + id)!),
      { base, id: originalId },
    );
    expect(old.player.race).toBe("planetary");
    expect(old.player.quests.steps).toBe("active");
    await page.getByRole("button", { name: /Twoje postacie/ }).click();
    await expect(page.getByRole("button", { name: "Kontynuuj podróż", exact: true })).toHaveCount(
      4,
    );
    await page
      .locator(".ki-slot")
      .filter({ hasText: "Planetarni" })
      .getByRole("button", { name: "Kontynuuj podróż", exact: true })
      .click();
    await expect(page.locator(".ki-hud")).toBeVisible();
    await expect(page.getByRole("button", { name: "Podejdź do rynku", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
