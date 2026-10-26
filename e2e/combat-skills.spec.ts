import {
  test,
  expect,
  patchActiveCharacter,
  testCreature,
  liveEnemy,
  superiorLand,
  outsideTowns,
} from "./fixtures";
for (const [race, world, skill] of [
  ["Planetarni", "verdant", "B1"],
  ["Mędrcy", "aether", "B1"],
  ["Androidy", "nexus", "B1"],
  ["Legendy", "pyra", "C1"],
] as const) {
  test(`canonical skill in real PvE: ${race}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
    const creature = testCreature(world);
    await page.goto("/scripts/playtest.html" + creature.query);
    await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    const e = await liveEnemy(canvas, creature.id);
    const at = superiorLand(world).nav.safe({ x: e.x + 50, y: e.y });
    expect(outsideTowns(world, at)).toBe(true);
    await patchActiveCharacter(page, { level: 3, skills: ["R", skill], ...at });
    const ki = page.getByRole("meter", { name: "Energia KI", exact: true });
    const before = Number(await ki.getAttribute("aria-valuenow"));
    const action = page.locator(`[data-ability="${skill}"]`);
    await action.click();
    await expect(action.locator(".ki-cooldown")).toBeVisible();
    expect(Number(await ki.getAttribute("aria-valuenow"))).toBeLessThan(before);
    await expect(action).toBeDisabled();
    expect(errors).toEqual([]);
  });
}
