import { test, expect } from "./fixtures";
import { mkdir } from "node:fs/promises";
const entry = process.env["KI_QA_PATH"] ?? "/scripts/playtest.html";
const cases = [
  ["Planetarni", 360, 640],
  ["Planetarni", 390, 640],
  ["Mędrcy", 390, 844],
  ["Androidy", 390, 640],
  ["Legendy", 414, 896],
  ["Androidy", 852, 393],
  ["Planetarni", 1280, 900],
] as const;
for (const [race, width, height] of cases)
  test.describe(`tidy HUD ${race} ${width}x${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: width < 1000, isMobile: width < 1000 });
    test("single dock, clear play area and real touch tools", async ({ page }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(entry);
      await page.getByRole("button", { name: "Wybierz: " + race, exact: true }).click();
      await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
      await expect(page.locator(".ki-hud")).toBeVisible();
      const compact = width < 1000;

      // A new character shows only what it has learned: the root ability and the potion.
      await expect(page.locator(".ki-skill")).toHaveCount(2);
      const hp = (await page.getByRole("meter", { name: "Zdrowie", exact: true }).boundingBox())!;
      const ki = (await page
        .getByRole("meter", { name: "Energia KI", exact: true })
        .boundingBox())!;
      expect(hp.y + hp.height).toBeLessThanOrEqual(ki.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      for (const point of [
        { x: width * 0.5, y: height * 0.45 },
        { x: 35, y: height - 220 },
      ])
        expect(
          await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.tagName, point),
        ).toBe("CANVAS");
      const evidence = info.outputPath("mobile-hud-layout");
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: `${evidence}/${race}-${width}x${height}.png` });
      // All four primary tools are always reachable, outside the optional camera popover.
      await expect(page.locator(".ki-menu > button")).toHaveCount(4);
      for (const button of await page.locator(".ki-menu > button").all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
      }
      await expect(page.locator(".ki-portrait img")).toHaveJSProperty("naturalWidth", 480);
      await expect(page.locator(".ki-portrait")).toHaveAttribute(
        "data-race",
        /planetary|sage|android|legend/,
      );
      if (compact) {
        const toggle = page.getByRole("button", { name: "Menu gry", exact: true });
        await expect(page.locator(".ki-view-controls")).toBeHidden();
        await expect(page.locator(".ki-menu")).toBeVisible();
        const dock = (await page.locator(".ki-actionbar").boundingBox())!;
        const menu = (await toggle.boundingBox())!;
        expect(menu.y + menu.height).toBeLessThanOrEqual(height - (height < 500 ? 56 : 66));
        expect(menu.x + menu.width).toBeLessThan(dock.x);
        expect(dock.y + dock.height).toBeLessThanOrEqual(height - (height < 500 ? 56 : 66));
        for (const skill of await page.locator(".ki-skill").all()) {
          const box = (await skill.boundingBox())!;
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
        await toggle.tap();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(page.locator(".ki-view-controls")).toBeVisible();
        await page.screenshot({ path: `${evidence}/tools-${width}x${height}-${race}.png` });
        await page.getByRole("button", { name: "Ekwipunek", exact: true }).tap();
        await expect(page.getByRole("dialog", { name: "Ekwipunek", exact: true })).toBeVisible();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await page.getByRole("button", { name: "Zamknij okno", exact: true }).tap();
        await toggle.tap();
        await page.touchscreen.tap(width * 0.5, height * 0.45);
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await toggle.tap();
        await page.keyboard.press("Escape");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
      }
      await page.getByRole("button", { name: "Umiejętności", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Umiejętności", exact: true })).toBeVisible();
      await page.screenshot({ path: `${evidence}/skills-${width}x${height}-${race}.png` });
      await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
      await page.getByRole("button", { name: "Ekwipunek", exact: true }).click();
      await page.screenshot({ path: `${evidence}/inventory-${width}x${height}-${race}.png` });
      await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
      expect(errors).toEqual([]);
      await page.screenshot({ path: info.outputPath("final-clear-world.png") });
    });
  });
