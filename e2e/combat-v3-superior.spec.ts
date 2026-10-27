import { test, expect } from "./fixtures";

// Current default runtime: no patched save, no injected monsters, no HP/level manipulation.
for (const race of ["Planetarni", "Mędrcy", "Androidy", "Legendy"]) {
  test(`V3 Superior v2 natural encounter: ${race}`, async ({ page }, info) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 852, height: 393 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
    const command = (detail: object) =>
      canvas.evaluate(
        (el, d) => el.dispatchEvent(new CustomEvent("ki:command", { detail: d })),
        detail,
      );
    type Foe = { id: string; x: number; y: number; hp: number; combat: string };
    const enemies = async () =>
      JSON.parse((await canvas.getAttribute("data-enemies")) ?? "[]") as Foe[];
    const start = {
      x: Number(await canvas.getAttribute("data-player-x")),
      y: Number(await canvas.getAttribute("data-player-y")),
    };
    let foe: Foe | undefined;
    walk: for (const r of [2500, 4000]) {
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        await command({ type: "move", x: start.x + dx! * r, y: start.y + dy! * r });
        for (let i = 0; i < 40; i++) {
          await page.waitForTimeout(500);
          foe = (await enemies()).find((e) => e.hp > 0);
          if (foe) break walk;
        }
      }
    }
    expect(foe, "natural streamed enemy outside the safe city").toBeDefined();
    await command({ type: "move", x: foe!.x, y: foe!.y });
    await expect
      .poll(
        async () => {
          await command({ type: "target", id: foe!.id });
          return (await enemies()).find((e) => e.id === foe!.id)?.hp ?? Infinity;
        },
        {
          timeout: 60_000,
        },
      )
      .toBeLessThan(foe!.hp);
    await expect(page.getByRole("meter", { name: "Zdrowie", exact: true })).not.toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    await page.screenshot({ path: info.outputPath("superior-combat.png") });
    expect(errors).toEqual([]);
  });
}
