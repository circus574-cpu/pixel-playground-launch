import { test, expect, basicAttack, liveEnemy, outsideTowns, testCreature } from "./fixtures";
import type { Command } from "../src/game/session";

test.use({ video: "on" });
for (const mobile of [false, true]) {
  test.describe(mobile ? "manual combat touch" : "manual combat desktop", () => {
    test.use({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 900 },
      hasTouch: mobile,
    });
    test("explicit prototype, real hit, hold release and unchanged save", async ({
      page,
    }, info) => {
      test.setTimeout(240000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const creature = testCreature("verdant");
      await page.goto(
        "/scripts/playtest.html" +
          creature.query +
          "&ki-combat=manual" +
          (mobile ? "&ki-render-fps=15" : ""),
      );
      await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
      await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
      const canvas = page.locator(".ki-canvas");
      await expect(canvas).toHaveAttribute("data-combat-mode", "manual-prototype");
      const command = (detail: Command) =>
        canvas.evaluate(
          (el, detail) => el.dispatchEvent(new CustomEvent("ki:command", { detail })),
          detail,
        );
      const readEnemy = () =>
        canvas.evaluate((el, id) => {
          const enemies = JSON.parse((el as HTMLElement).dataset["enemies"] ?? "[]") as {
            id: string;
            hp: number;
            x: number;
            y: number;
          }[];
          return enemies.find((e) => e.id === id);
        }, creature.id);
      const enemy = await liveEnemy(canvas, creature.id);
      const originalHp = (await readEnemy())!.hp;
      const originalX = await canvas.getAttribute("data-player-x");
      await command({ type: "target", id: creature.id });
      await page.waitForTimeout(400);
      expect(await canvas.getAttribute("data-player-x")).toBe(originalX);
      expect((await readEnemy())!.hp).toBe(originalHp);
      const offset = [
        { x: 45, y: 0 },
        { x: -45, y: 0 },
        { x: 0, y: 45 },
        { x: 0, y: -45 },
      ].find((o) => outsideTowns("verdant", { x: enemy.x + o.x, y: enemy.y + o.y }))!;
      await command({ type: "move", x: enemy.x + offset.x, y: enemy.y + offset.y });
      await expect
        .poll(
          async () => {
            const e = await readEnemy();
            return e
              ? canvas.evaluate(
                  (el, e) =>
                    Math.hypot(
                      Number((el as HTMLElement).dataset["playerX"]) - e.x,
                      Number((el as HTMLElement).dataset["playerY"]) - e.y,
                    ),
                  e,
                )
              : Infinity;
          },
          { timeout: 150000 },
        )
        .toBeLessThan(75);
      const position = await canvas.evaluate((el) => ({
        x: Number((el as HTMLElement).dataset["playerX"]),
        y: Number((el as HTMLElement).dataset["playerY"]),
      }));
      const live = (await readEnemy())!;
      await command({
        type: "combat",
        input: { kind: "aim", direction: { x: live.x - position.x, y: live.y - position.y } },
      });
      if (mobile) {
        const box = (await basicAttack(page).boundingBox())!;
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
        });
        await expect.poll(async () => (await readEnemy())?.hp ?? 0).toBeLessThan(originalHp);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
      } else {
        await page.keyboard.down("Space");
        await expect.poll(async () => (await readEnemy())?.hp ?? 0).toBeLessThan(originalHp);
        await page.keyboard.up("Space");
      }
      await expect(canvas).toHaveAttribute("data-combat-phase", "ready");
      const after = (await readEnemy())!.hp;
      await page.waitForTimeout(1100);
      expect((await readEnemy())!.hp).toBe(after);
      await page.screenshot({ path: info.outputPath("manual-combat.png") });
      await command({ type: "pause", value: true });
      await canvas.evaluate((el) => el.dispatchEvent(new Event("ki:flush")));
      const saved = await page.evaluate(() =>
        Object.entries(localStorage).filter(([key]) =>
          key.includes(":superior-world-v1:character:"),
        ),
      );
      expect(saved).toHaveLength(1);
      expect(saved[0]![1]).not.toContain("actionId");
      expect(saved[0]![1]).not.toContain("combatMode");
      expect(errors).toEqual([]);
      await info.attach("combat-session", {
        body: JSON.stringify({ mobile, originalHp, after, savedKeys: saved.map(([key]) => key) }),
        contentType: "application/json",
      });
    });
  });
}
