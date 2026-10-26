import { test, expect } from "./fixtures";
for (const [race, boss] of [
  ["Planetarni", "ygdrasha"],
  ["Mędrcy", "arcykaplan-pustki"],
  ["Androidy", "arbiter-zero"],
  ["Legendy", "kharzul"],
]) {
  test(`boss preview ${race}: real Phaser phase/telegraph, isolated save`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
    await page.goto(`/scripts/playtest.html?ki-bosses=1&ki-boss=${boss}`);
    await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    await expect(canvas).toHaveAttribute("data-bosses", new RegExp(`boss:${boss}`));
    await expect
      .poll(async () => JSON.parse((await canvas.getAttribute("data-bosses"))!)[0]?.phase)
      .toBe(1);
    await expect(canvas).toHaveAttribute("data-combat-visuals", /^[1-9]\d*$/);
    await page.screenshot({ path: info.outputPath(`boss-${boss}.png`) });
    const before = await page.evaluate(() =>
      Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.includes(":character:"))),
    );
    await page.getByRole("button", { name: "Dziennik", exact: true }).click();
    await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
    const after = await page.evaluate(() =>
      Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.includes(":character:"))),
    );
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
  });
}
