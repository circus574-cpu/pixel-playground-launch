import { test, expect, openHudTool } from "./fixtures";
import { RACES, RACE_IDS } from "../src/game/world/races";
import { HERITAGE_BY_ID } from "../src/game/development/heritage/catalog";
import { questId } from "../src/game/development/heritage/types";

test.use({ hasTouch: true });
for (const race of RACE_IDS)
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 852, height: 393 },
  ]) {
    test(`development tabs, touch and movement after closing: ${race} ${viewport.width}x${viewport.height}`, async ({
      page,
    }, info) => {
      test.setTimeout(180000);
      await page.setViewportSize(viewport);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/scripts/playtest.html?ki-world-v2=1");
      await page.getByRole("button", { name: "Wybierz: " + RACES[race].name, exact: true }).tap();
      await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).tap();
      const canvas = page.locator(".ki-canvas").first();
      await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
      if (viewport.height > viewport.width) {
        await expect(page.getByText("Obróć telefon poziomo", { exact: true })).toBeVisible();
        await page.screenshot({ path: info.outputPath(`${race}-portrait-rotation-guard.png`) });
        await page.setViewportSize({ width: viewport.height, height: viewport.width });
        await expect(page.getByText("Obróć telefon poziomo", { exact: true })).toBeHidden();
      }

      await openHudTool(page, "Umiejętności", "touch");
      await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).tap();
      const panel = page.locator(".ki-development");
      for (const name of ["Trening", "Wiedza", "Mistrzostwo", "Dziedzictwo"]) {
        const tab = panel.getByRole("tab", { name, exact: true });
        await tab.tap();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        expect(
          await panel.evaluate((node) => node.scrollWidth - node.clientWidth),
        ).toBeLessThanOrEqual(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        ).toBeLessThanOrEqual(1);
      }
      const title = page.getByRole("heading", {
        name: HERITAGE_BY_ID.get(questId(race, 1))!.name,
        exact: true,
      });
      await title.scrollIntoViewIfNeeded();
      await expect(title).toBeInViewport();
      await expect(
        panel.getByText(/Najpierw zakończ miejscowe pierwsze kroki/).first(),
      ).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`${race}-${viewport.width}-development-touch.png`),
      });
      await page.getByRole("button", { name: "Zamknij okno", exact: true }).tap();
      await expect(panel).toHaveCount(0);
      const origin = {
        x: Number(await canvas.getAttribute("data-player-x")),
        y: Number(await canvas.getAttribute("data-player-y")),
      };
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      const cdp = await page.context().newCDPSession(page);
      let moved = false;
      for (const [dx, dy] of [
        [35, -24],
        [-35, -24],
        [35, 24],
        [-35, 24],
      ]) {
        const touch = { id: 21, x: box!.x + 84, y: box!.y + box!.height - 104 };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch] });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ ...touch, x: touch.x + dx!, y: touch.y + dy! }],
        });
        await expect
          .poll(async () =>
            Math.hypot(
              Number(await canvas.getAttribute("data-joystick-x")),
              Number(await canvas.getAttribute("data-joystick-y")),
            ),
          )
          .toBeGreaterThan(10);
        // Real held contact; no position, progress, preference or pause patches.
        await page.waitForTimeout(450);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        moved =
          Math.hypot(
            Number(await canvas.getAttribute("data-player-x")) - origin.x,
            Number(await canvas.getAttribute("data-player-y")) - origin.y,
          ) > 4;
        if (moved) break;
      }
      await cdp.detach();
      expect(moved, "joystick must move the real character after the panel closes").toBe(true);
      await expect.poll(async () => Number(await canvas.getAttribute("data-joystick-x"))).toBe(0);
      expect(errors).toEqual([]);
    });
  }
