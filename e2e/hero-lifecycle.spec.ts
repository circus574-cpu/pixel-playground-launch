import { test, expect, basicAttack } from "./fixtures";
import { isCityStage } from "../src/game/city/types";
import { WORLDS } from "../src/game/world/worlds";
import type { Command } from "../src/game/session";

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const frames = await page
    .evaluate(() => [
      ...((window as unknown as { __observedActorFrames?: Set<string> }).__observedActorFrames ??
        []),
    ])
    .catch(() => []);
  await info.attach("observed-animation-history-on-failure", {
    body: JSON.stringify(frames),
    contentType: "application/json",
  });
});

for (const [race, worldId, actor] of [
  ["Planetarni", "verdant", "hero-planetary-painted"],
  ["Mędrcy", "aether", "hero-sage-painted"],
  ["Androidy", "nexus", "hero-android"],
  ["Legendy", "pyra", "hero-legend"],
] as const) {
  test(`${actor}: ${isCityStage(WORLDS[worldId]) ? "safe city movement and training" : "all seven clips follow real combat, defeat and respawn"}`, async ({
    page,
  }, info) => {
    await page.goto("/scripts/playtest.html");
    await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    await expect(canvas).toHaveAttribute("data-actor-visual", actor);
    await expect(canvas).toHaveAttribute("data-animation-state", "idle");
    await canvas.evaluate((el) => {
      const frames = new Set<string>();
      const capture = () => frames.add((el as HTMLElement).dataset["animationFrame"] ?? "");
      capture();
      new MutationObserver(capture).observe(el, {
        attributes: true,
        attributeFilter: ["data-animation-frame"],
      });
      (window as unknown as { __observedActorFrames: Set<string> }).__observedActorFrames = frames;
    });
    const command = async (detail: Command) =>
      canvas.evaluate(
        (el, detail) => el.dispatchEvent(new CustomEvent("ki:command", { detail })),
        detail,
      );
    const health = page.getByRole("meter", { name: "Zdrowie", exact: true });
    const max = (await health.getAttribute("aria-valuemax"))!;
    const world = WORLDS[worldId],
      enemy = world.enemies[0]!;
    if (isCityStage(world)) {
      await command({ type: "enter", building: "arena" });
      await expect(canvas).toHaveAttribute("data-interior", "arena");
      await command({ type: "training", action: "start" });
      await expect
        .poll(() =>
          canvas.evaluate((el) =>
            Math.hypot(
              Number((el as HTMLElement).dataset["playerX"]) - 600,
              Number((el as HTMLElement).dataset["playerY"]) - 300,
            ),
          ),
        )
        .toBeLessThanOrEqual(62);
      await basicAttack(page).click();
      await expect(page.getByLabel("Wnętrze budynku")).toContainText("Trafienia: 1");
      // The HUD reports the hit before Phaser's next draw. Wait for the actual
      // observed animation frame rather than reading history before that draw.
      for (const state of ["idle", "walk", "attack"])
        await expect
          .poll(
            () =>
              page.evaluate(
                ({ actor, state }) =>
                  [
                    ...(window as unknown as { __observedActorFrames: Set<string> })
                      .__observedActorFrames,
                  ].some((frame) => frame.startsWith(`${actor}/${state}/`)),
                { actor, state },
              ),
            { message: state },
          )
          .toBe(true);
      await expect(canvas).toHaveAttribute("data-enemies", "[]");
      await expect(health).toHaveAttribute("aria-valuenow", max);
      await expect(page.locator(".ki-death-overlay")).toHaveCount(0);
      await page.screenshot({ path: info.outputPath(`${actor}-city-training.png`) });
      return;
    }
    await command({ type: "move", x: enemy.x, y: enemy.y + 85 });
    // A real hit makes the potion usable; its healing plays the skill clip. No HP is patched.
    await expect(health).not.toHaveAttribute("aria-valuenow", max);
    // A real hit legitimately preempts lower-priority presentation.
    // Wait until that reaction finishes before triggering the skill and an attack.
    await expect(canvas).toHaveAttribute("data-animation-state", /^(idle|walk)$/);
    await page.getByRole("button", { name: "Mikstura życia", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-animation-state", "skill");
    await expect(canvas).toHaveAttribute("data-animation-state", /^(idle|walk)$/);
    await command({ type: "ability", ability: "R" });
    await expect
      .poll(() =>
        page.evaluate(() =>
          [
            ...(window as unknown as { __observedActorFrames: Set<string> }).__observedActorFrames,
          ].some((f) => f.includes("/attack/")),
        ),
      )
      .toBe(true);
    await command({ type: "cancel" });
    // Software WebGL may render below 10 FPS; the game's 100 ms tick cap
    // deliberately slows simulation then. Observe real damage progression
    // before timing the final defeat, without changing HP or game clocks.
    await expect
      .poll(async () =>
        Number(
          await page
            .getByRole("meter", { name: "Zdrowie", exact: true })
            .getAttribute("aria-valuenow"),
        ),
      )
      .toBeLessThanOrEqual(30);
    await expect(page.locator(".ki-death-overlay")).toBeVisible({ timeout: 60000 });
    await expect(canvas).toHaveAttribute("data-animation-state", "death");
    await expect(page.locator(".ki-death-overlay")).toHaveCount(0, { timeout: 6000 });
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-x")))
      .toBeCloseTo(world.spawn.x, 0);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-y")))
      .toBeCloseTo(world.spawn.y, 0);
    const frames = await page.evaluate(() => [
      ...(window as unknown as { __observedActorFrames: Set<string> }).__observedActorFrames,
    ]);
    for (const state of ["idle", "walk", "attack", "skill", "hit", "death", "respawn"])
      expect(
        frames.some((frame) => frame.startsWith(`${actor}/${state}/`)),
        state,
      ).toBe(true);
    await info.attach("observed-real-animation-frames", {
      body: JSON.stringify({ actor, frames }),
      contentType: "application/json",
    });
    await page.screenshot({ path: info.outputPath(`${actor}-respawn.png`) });
  });
}
