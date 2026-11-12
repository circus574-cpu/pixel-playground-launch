import { test, expect, patchActiveCharacter, openHudTool } from "./fixtures";
import { BRANCH_NAMES } from "../src/game/kit/nodes.generated";
import { RACES } from "../src/game/world/races";

test.use({ hasTouch: true, isMobile: true, viewport: { width: 852, height: 393 }, video: "on" });
for (const [race, node, pre, name, first, last, max] of [
  ["planetary", "C2", "C1", "Zielona Krew", "+5%", "+8,5%", 487],
  ["sage", "C2", "C1", "Głęboki Oddech", "+7,5%", "+12,75%", 161],
  ["android", "B2", "B1", "Płyty Pancerne", "+4%", "+6,8%", 36],
  ["legend", "B3", "B1", "Honor Wojownika", "+5%", "+8,5%", 562],
] as const)
  test(`owner bonus rule persists and matches actual HUD: ${race}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: "Wybierz: " + RACES[race].name, exact: true }).tap();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).tap();
    await expect(page.locator(".ki-canvas")).toHaveAttribute("data-player-x", /^\d/);
    let saveBase = "";
    await expect
      .poll(async () => {
        saveBase = await page.evaluate(() => {
          for (const [key, value] of Object.entries(localStorage)) {
            if (key.includes("recovery")) continue;
            try {
              if (JSON.parse(value).format === "superior-character" && key.includes(":character:"))
                return key.slice(0, key.lastIndexOf(":character:"));
            } catch {
              /* A browser preference. */
            }
          }
          return "";
        });
        return saveBase;
      })
      .not.toBe("");
    await patchActiveCharacter(page, { level: 10, xp: 0, skills: ["R", pre] }, saveBase);
    const close = page.getByRole("button", { name: "Zamknij rozmowę", exact: true });
    if (await close.isVisible()) await close.tap();
    await openHudTool(page, "Umiejętności", "touch");
    await page
      .getByRole("tab", { name: BRANCH_NAMES[race][node[0] as "A" | "B" | "C"], exact: true })
      .tap();
    await page.locator(`.ki-st-node[data-id="${node}"]`).tap();
    const card = page.getByRole("dialog", { name, exact: true });
    await expect(card.locator(".ki-st-action > p")).toContainText(first);
    for (let rank = 1; rank <= 8; rank++) {
      await card
        .getByRole("button", {
          name:
            rank === 1 ? /Poznaj.*1 punkt/ : new RegExp("Zwiększ rangę do " + rank + ".*1 punkt"),
        })
        .tap();
      await expect(card.locator(".ki-st-rankline")).toContainText("Ranga " + rank);
    }
    await expect(card.locator(".ki-st-action > p")).toContainText(last);
    await expect(card.locator(".ki-st-rankline")).toContainText("170%");
    await page.screenshot({ path: info.outputPath(`${race}-rank-eight.png`) });
    await page.reload();
    await expect(page.locator(".ki-canvas")).toHaveAttribute("data-player-x", /^\d/);
    if (race === "android") {
      await openHudTool(page, "Ekwipunek", "touch");
      await expect(
        page.locator(".ki-dinv-stats > span").filter({ hasText: "Obrona" }).locator("b"),
      ).toHaveText(String(max));
    } else
      await expect(
        page.getByRole("meter", { name: race === "sage" ? "Energia KI" : "Zdrowie", exact: true }),
      ).toHaveAttribute("aria-valuemax", String(max));
    expect(errors).toEqual([]);
  });
