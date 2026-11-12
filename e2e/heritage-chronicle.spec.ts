import { test, expect, openHudTool } from "./fixtures";
import { RACES, RACE_IDS } from "../src/game/world/races";
import { HERITAGE_QUESTS } from "../src/game/development/heritage/catalog";
import { HISTORY } from "../src/game/development/heritage/chronicle";

test.use({ hasTouch: true });
for (const race of RACE_IDS) {
  test(`${race}: private chronicle opens by touch without revealing unearned history`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 852, height: 393 });
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: "Wybierz: " + RACES[race].name, exact: true }).tap();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).tap();
    await expect(page.locator(".ki-canvas").first()).toHaveAttribute("data-player-x", /^\d/);
    const canvas = page.locator(".ki-canvas").first();
    await expect
      .poll(async () => {
        const metrics = await canvas.getAttribute("data-metrics");
        return metrics ? JSON.parse(metrics).renderer : null;
      })
      .toBe(
        process.env["KI_QA_WEBGL"] || info.project.name === "software-webgl" ? "WebGL" : "Canvas",
      );
    await openHudTool(page, "Umiejętności");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).tap();
    await page.getByRole("tab", { name: "Kronika", exact: true }).tap();
    const chronicle = page.getByLabel("Prywatna kronika", { exact: true });
    await expect(chronicle).toBeVisible();
    await expect(chronicle).toContainText("0/6");
    for (const q of HERITAGE_QUESTS.filter((q) => q.race === race))
      await expect(chronicle.getByText(q.introduction, { exact: true })).toHaveCount(0);
    for (const fragment of HISTORY[race])
      await expect(chronicle.getByText(fragment, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(race + "-chronicle.png") });
    await page.getByRole("button", { name: "Zamknij okno", exact: true }).tap();
    await expect(chronicle).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
