import { test, expect, liveEnemy, testCreature, outsideTowns } from "./fixtures";

// Uses authored playtest spawn + normal commands, never writes HP, KI, level or save data.
const cases = [
  { race: "Planetarni", world: "verdant", width: 320, height: 568, touch: true },
  { race: "Mędrcy", world: "aether", width: 360, height: 640, touch: true },
  { race: "Androidy", world: "nexus", width: 390, height: 844, touch: true },
  { race: "Legendy", world: "pyra", width: 852, height: 393, touch: true },
  { race: "Planetarni", world: "verdant", width: 1280, height: 720, touch: false },
  { race: "Mędrcy", world: "aether", width: 1920, height: 1080, touch: false },
];
for (const c of cases)
  test.describe(`${c.race} ${c.width}x${c.height}`, () => {
    test.use({
      hasTouch: c.touch,
      isMobile: c.touch,
      viewport: { width: c.width, height: c.height },
    });
    test("V3 real combat, rapid input, movement and persistence", async ({ page }, info) => {
      const softwareDesktop = info.project.name === "software-webgl" && c.width >= 1280;
      if (softwareDesktop) test.setTimeout(360_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const creature = testCreature(c.world);
      await page.goto("/scripts/playtest.html" + creature.query);
      await page.getByRole("button", { name: `Wybierz: ${c.race}`, exact: true }).click();
      await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
      const canvas = page.locator(".ki-canvas");
      const enemy = await liveEnemy(canvas, creature.id);
      const home = {
        x: Number(await canvas.getAttribute("data-player-x")),
        y: Number(await canvas.getAttribute("data-player-y")),
      };
      const axis = Math.abs(enemy.x - home.x) > Math.abs(enemy.y - home.y) ? "x" : "y";
      const sign = Math.sign(enemy[axis] - home[axis]) || 1;
      const coordinate = () => canvas.getAttribute("data-player-" + axis).then(Number);
      const arrow =
        axis === "x" ? (sign > 0 ? "ArrowRight" : "ArrowLeft") : sign > 0 ? "ArrowDown" : "ArrowUp";
      // The same move command emitted by the world click; no direct state manipulation.
      await canvas.evaluate(
        (el, p) =>
          el.dispatchEvent(
            new CustomEvent("ki:command", { detail: { type: "move", x: p.x, y: p.y } }),
          ),
        enemy,
      );
      await expect
        .poll(
          async () => {
            const health = page.getByRole("meter", { name: "Zdrowie", exact: true });
            const hp = Number(await health.getAttribute("aria-valuenow"));
            const max = Number(await health.getAttribute("aria-valuemax"));
            const potion = page.getByRole("button", { name: "Mikstura życia", exact: true });
            if (hp > 0 && hp < max * 0.65 && (await potion.isEnabled()))
              await potion.click({ force: true });
            const x = Number(await canvas.getAttribute("data-player-x")),
              y = Number(await canvas.getAttribute("data-player-y"));
            const e = JSON.parse((await canvas.getAttribute("data-enemies")) ?? "[]").find(
              (v: { id: string }) => v.id === creature.id,
            );
            if (e)
              await canvas.evaluate(
                (el, id) =>
                  el.dispatchEvent(
                    new CustomEvent("ki:command", { detail: { type: "target", id } }),
                  ),
                creature.id,
              );
            return e && outsideTowns(c.world, { x, y }, 0)
              ? Math.hypot(x - e.x, y - e.y)
              : Infinity;
          },
          { timeout: softwareDesktop ? 180_000 : 45000, intervals: [100] },
        )
        .toBeLessThan(c.world === "aether" ? 421 : c.world === "nexus" ? 361 : 79);
      await canvas.evaluate((el) =>
        el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "cancel" } })),
      );
      const potionBefore = page.getByRole("button", { name: "Mikstura życia", exact: true });
      if (await potionBefore.isEnabled()) await potionBefore.click({ force: true });
      await expect(page.locator('[data-ability="R"]')).toBeEnabled();
      const initial = await coordinate();
      if (c.touch) {
        const cdp = await page.context().newCDPSession(page);
        const left = { x: Math.round(c.width * 0.13), y: Math.round(c.height * 0.65), id: 1 };
        const moved = { ...left, [axis]: left[axis] + sign * 20 };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [left] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [moved] });
        await expect(canvas).toHaveAttribute("data-joystick-" + axis, String(sign * 20), {
          timeout: 5000,
        });
        const b = (await page.locator('[data-ability="R"]').boundingBox())!;
        const right = { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 2 };
        // Keep both contacts down through the assertion: the left thumb must survive R.
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [moved, right],
        });
        await expect(canvas).toHaveAttribute("data-joystick-" + axis, String(sign * 20), {
          timeout: 5000,
        });
        await expect
          .poll(async () => ((await coordinate()) - initial) * sign, { timeout: 5000 })
          .toBeGreaterThan(5);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      } else {
        await page.keyboard.down(arrow);
        await page.keyboard.press("Space");
        await expect
          .poll(async () => ((await coordinate()) - initial) * sign, { timeout: 5000 })
          .toBeGreaterThan(5);
        await page.keyboard.up(arrow);
      }
      // Rapid genuine presses after the movement check; cooldown-disabled buttons stay disabled.
      const button = (await page.locator('[data-ability="R"]').boundingBox())!;
      for (let i = 0; i < 5; i++) {
        const x = button.x + button.width / 2,
          y = button.y + button.height / 2;
        if (c.touch) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
        await page.waitForTimeout(30);
      }
      // Select through the existing command, as a world click does. No state mutation.
      await canvas.evaluate(
        (el, id) =>
          el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "target", id } })),
        creature.id,
      );
      const hp = async () => {
        const es = JSON.parse((await canvas.getAttribute("data-enemies")) ?? "[]") as {
          id: string;
          hp: number;
        }[];
        return es.find((e) => e.id === creature.id)?.hp ?? 0;
      };
      await expect.poll(hp, { timeout: 10000 }).toBeLessThan(67);
      // Heal before the comparatively expensive screenshot, never spend a combat turn capturing evidence.
      const potionAtContact = page.getByRole("button", { name: "Mikstura życia", exact: true });
      if (await potionAtContact.isEnabled()) await potionAtContact.click({ force: true });
      await canvas.evaluate((el) =>
        el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "pause", value: true } })),
      );
      await page.screenshot({ path: info.outputPath("combat.png") });
      await canvas.evaluate((el) =>
        el.dispatchEvent(
          new CustomEvent("ki:command", { detail: { type: "pause", value: false } }),
        ),
      );
      // Finish through an explicit existing target command, with potion only when needed.
      await canvas.evaluate(
        (el, id) =>
          el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "target", id } })),
        creature.id,
      );
      await expect
        .poll(
          async () => {
            const health = page.getByRole("meter", { name: "Zdrowie", exact: true });
            const current = Number(await health.getAttribute("aria-valuenow"));
            const max = Number(await health.getAttribute("aria-valuemax"));
            const potion = page.getByRole("button", { name: "Mikstura życia", exact: true });
            if (current > 0 && current < max * 0.65 && (await potion.isEnabled()))
              await potion.click({ force: true });
            await canvas.evaluate(
              (el, id) =>
                el.dispatchEvent(new CustomEvent("ki:command", { detail: { type: "target", id } })),
              creature.id,
            );
            return hp();
          },
          { timeout: 45000, intervals: [100] },
        )
        .toBe(0);
      await expect(page.getByRole("meter", { name: "Zdrowie", exact: true })).not.toHaveAttribute(
        "aria-valuenow",
        "0",
      );
      await page.waitForTimeout(2200);
      const xpLabel = await page.locator(".ki-xp").getAttribute("aria-label");
      expect(xpLabel).toMatch(/Doświadczenie [1-9]/);
      await page.reload();
      await expect(canvas).toHaveAttribute("data-world", c.world);
      await expect(page.locator(".ki-xp")).toHaveAttribute("aria-label", xpLabel!);
      expect(errors).toEqual([]);
    });
  });
