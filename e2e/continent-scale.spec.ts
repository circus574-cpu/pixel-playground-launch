import { test, expect, type Page } from "./fixtures";
import { RACES, RACE_IDS } from "../src/game/world/races";
import { WORLDS } from "../src/game/world/worlds";

// The playable continent is tens of thousands of units wide: the camera, the streamed ground and the
// minimap must follow the player beyond the city and the painted valley without errors.
const path =
  process.env["KI_QA_PATH"] ?? (process.env["KI_QA_BASE_URL"] ? "/" : "/scripts/playtest.html");
async function position(page: Page) {
  return page.evaluate(() => {
    const key = "ki-legends:adventure:v1";
    const id = localStorage.getItem(key + ":active-character");
    const p = JSON.parse(localStorage.getItem(key + ":character:" + id) ?? "null")?.player;
    return { x: p.x as number, y: p.y as number };
  });
}
for (const race of RACE_IDS) {
  test(`walks out of the city onto the open continent: ${race}`, async ({ page }, info) => {
    test.setTimeout(240000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    const world = WORLDS[RACES[race].world];
    await page.goto(path);
    await page.getByRole("button", { name: "Wybierz: " + RACES[race].name, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(`.ki-canvas[data-world="${world.id}"]`);
    await expect(canvas).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${race}-city.png`) });
    const b = world.city!.bounds!;
    // Straight to the open ground beyond the eastern edge of the city.
    const goal = { x: b.x + b.width + 1600, y: b.y + b.height / 2 };
    await canvas.evaluate((el, p) => {
      el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "move", x: p.x, y: p.y } }));
    }, goal);
    await expect
      .poll(
        async () => {
          const p = await position(page);
          return Math.hypot(p.x - goal.x, p.y - goal.y);
        },
        { timeout: 200000 },
      )
      .toBeLessThan(120);
    await page.waitForTimeout(500);
    await page.screenshot({ path: info.outputPath(`${race}-open-ground.png`) });
    expect(errors).toEqual([]);
  });
}
