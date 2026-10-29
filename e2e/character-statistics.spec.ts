import { test, expect } from "./fixtures";
test.use({ hasTouch: true });
for (const [race, width, height] of [
  ["Planetarni", 1280, 720],
  ["Mędrcy", 390, 844],
  ["Androidy", 360, 800],
  ["Legendy", 852, 393],
] as const) {
  test(`${race}: portrait opens current statistics ${width}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height });
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    if (width < height) {
      await expect(
        page.getByRole("alert").filter({ hasText: "Obróć telefon poziomo" }),
      ).toBeVisible();
      await page.setViewportSize({ width: height, height: width });
    }
    const portrait = page.getByRole("button", { name: "Pokaż statystyki postaci", exact: true });
    await expect(portrait).toBeVisible();
    await (width < 600 ? portrait.tap() : portrait.click());
    const panel = page.getByRole("dialog", { name: "Statystyki postaci", exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Technika", { exact: true })).toBeVisible();
    await expect(panel.getByText("Unik (%)", { exact: true })).toBeVisible();
    await expect(panel.getByText("Premia szybkości ataku (%)", { exact: true })).toBeAttached();
    expect(await panel.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(
      Math.max(width, height),
    );
    await info.attach("character-statistics", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    const close = panel.getByRole("button", { name: "Zamknij okno" });
    await (width < 600 ? close.tap() : close.click());
    await expect(panel).not.toBeVisible();
    await page.reload();
    await expect(portrait).toBeVisible();
    await (width < 600 ? portrait.tap() : portrait.click());
    await expect(panel).toBeVisible();
    expect(errors).toEqual([]);
  });
}
