import { test, expect, type Page } from "./fixtures";
import { RACES } from "../src/game/world/races";
import { LABYRINTHS, labyrinthLayout } from "../src/game/world/generated/labyrinths";

// The reserved labyrinth gate leads into the sealed maze and its door leads back to the land.
const path = "/scripts/playtest.html?ki-world-v2=1";
const save = (page: Page, edit?: { x: number; y: number }) =>
  page.evaluate((edit) => {
    const activeKey = Object.keys(localStorage).find((k) => k.endsWith(":active-character"))!;
    const base = activeKey.slice(0, -":active-character".length);
    const key = base + ":character:" + localStorage.getItem(activeKey);
    const value = JSON.parse(localStorage.getItem(key)!);
    if (edit) {
      Object.assign(value.player, edit);
      localStorage.setItem(key, JSON.stringify(value));
    }
    return { x: value.player.x as number, y: value.player.y as number };
  }, edit);

for (const spec of LABYRINTHS.filter((l) => l.feature === "verdant")) {
  test(`enters and leaves ${spec.name}`, async ({ page }, info) => {
    test.setTimeout(300000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const race = Object.entries(RACES).find(([, r]) => r.world === spec.feature)![0];
    await page.goto(path);
    await page
      .getByRole("button", {
        name: "Wybierz: " + RACES[race as keyof typeof RACES].name,
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(`.ki-canvas[data-world="${spec.feature}"]`);
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(1500);
    // Stand just south of the gate, then reload the saved character there.
    await save(page, { x: spec.entrance.x, y: spec.entrance.y + 320 });
    await page.reload();
    for (const name of ["Kontynuuj", "Rozpocznij przygodę", "Graj"]) {
      const button = page.getByRole("button", { name, exact: true });
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => (await save(page)).y, { timeout: 30000 })
      .toBeLessThan(spec.entrance.y + 400);
    const layout = labyrinthLayout(spec);
    await canvas.evaluate((el, p) => {
      el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", x: p.x, y: p.y } }));
    }, spec.entrance);
    await expect
      .poll(
        async () => {
          const p = await save(page);
          return Math.hypot(p.x - layout.arrival.x, p.y - layout.arrival.y);
        },
        { timeout: 60000 },
      )
      .toBeLessThan(150);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: info.outputPath("labyrinth-arrival.png") });
    // Walk towards the heart for a while and look around.
    const towards = layout.deadEnds[0]!;
    await canvas.evaluate((el, p) => {
      el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", x: p.x, y: p.y } }));
    }, towards);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: info.outputPath("labyrinth-corridor.png") });
    // Back through the door next to the arrival.
    await canvas.evaluate((el, p) => {
      el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", x: p.x, y: p.y } }));
    }, layout.exit);
    await expect
      .poll(
        async () => {
          const p = await save(page);
          return Math.hypot(p.x - spec.entrance.x, p.y - spec.entrance.y);
        },
        { timeout: 90000 },
      )
      .toBeLessThan(400);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: info.outputPath("labyrinth-back.png") });
    expect(errors).toEqual([]);
  });
}
