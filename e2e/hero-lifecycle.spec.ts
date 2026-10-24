import {
  test,
  expect,
  basicAttack,
  liveEnemy,
  outsideTowns,
  superiorLand,
  testCreature,
} from "./fixtures";
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
    // A known creature waits just outside the safe capital (playtest-only QA spawn).
    test.setTimeout(900000);
    const creature = testCreature(worldId);
    await page.goto("/scripts/playtest.html" + creature.query);
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
      enemy = { id: creature.id, ...(await liveEnemy(canvas, creature.id)) };
    // A new character starts (and respawns) at the land's safe arrival point.
    const home = {
      x: Number(await canvas.getAttribute("data-player-x")),
      y: Number(await canvas.getAttribute("data-player-y")),
    };
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
    // Where the hero stands to fight: on the wild side of the creature, reachable on foot.
    let side = { x: 0, y: 0 };
    {
      // Observe a fresh real attack before the potion sequence. Incoming hits
      // legitimately preempt presentation when already surrounded in melee.
      const reach = worldId === "pyra" ? 140 : 320;
      // Stand on the wild side of the creature: inside the safe town attacks are refused.
      side = [
        { x: 0, y: reach },
        { x: 0, y: -reach },
        { x: reach, y: 0 },
        { x: -reach, y: 0 },
      ].find((o) => outsideTowns(worldId, { x: enemy.x + o.x, y: enemy.y + o.y }))!;
      await command({ type: "move", x: enemy.x + side.x, y: enemy.y + side.y });
      await expect
        .poll(
          () =>
            canvas.evaluate(
              (el, p) =>
                Math.hypot(
                  Number((el as HTMLElement).dataset["playerX"]) - p.x,
                  Number((el as HTMLElement).dataset["playerY"]) - p.y,
                ),
              { x: enemy.x + side.x, y: enemy.y + side.y },
            ),
          { timeout: 420000 },
        )
        .toBeLessThan(95);
      await command({ type: "target", id: enemy.id });
      await expect
        .poll(() =>
          page.evaluate(() =>
            [
              ...(window as unknown as { __observedActorFrames: Set<string> })
                .__observedActorFrames,
            ].some((frame) => frame.includes("/attack/")),
          ),
        )
        .toBe(true);
      await command({ type: "cancel" });
    }
    await command({ type: "move", x: enemy.x, y: enemy.y + 85 });
    // A real hit makes the potion usable; its healing plays the skill clip. No HP is patched.
    await expect(health).not.toHaveAttribute("aria-valuenow", max);
    // A real hit legitimately preempts lower-priority presentation. Step just inside the safe
    // town, where creatures never follow, so the potion's skill clip plays uninterrupted. The
    // step is short: out-of-combat regeneration must not refill HP before the potion.
    const toward = Math.hypot(home.x - enemy.x, home.y - enemy.y);
    const refuge = superiorLand(worldId).nav.safe({
      x: enemy.x + ((home.x - enemy.x) / toward) * 420,
      y: enemy.y + ((home.y - enemy.y) / toward) * 420,
    });
    await command({ type: "move", ...refuge });
    await expect
      .poll(
        () =>
          canvas.evaluate(
            (el, p) =>
              Math.hypot(
                Number((el as HTMLElement).dataset["playerX"]) - p.x,
                Number((el as HTMLElement).dataset["playerY"]) - p.y,
              ),
            refuge,
          ),
        { timeout: 120000 },
      )
      .toBeLessThan(95);
    await expect(canvas).toHaveAttribute("data-animation-state", /^(idle|walk)$/);
    await expect(health).not.toHaveAttribute("aria-valuenow", max);
    await page.getByRole("button", { name: "Mikstura życia", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          [
            ...(window as unknown as { __observedActorFrames: Set<string> }).__observedActorFrames,
          ].some((frame) => frame.includes("/skill/")),
        ),
      )
      .toBe(true);
    await expect(canvas).toHaveAttribute("data-animation-state", /^(idle|walk)$/);
    // Back to the same reachable spot beside the creature for a real attack, then the defeat.
    await command({ type: "move", x: enemy.x + side.x, y: enemy.y + side.y });
    await command({ type: "target", id: enemy.id });
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
    // Software WebGL may render below 10 FPS; the game's 100 ms tick cap deliberately slows
    // simulation then. The last hits can take HP from above 30 to 0 between two reads, so wait
    // for the real defeat itself: the observed death clip, without changing HP or game clocks.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            [
              ...(window as unknown as { __observedActorFrames: Set<string> })
                .__observedActorFrames,
            ].some((frame) => frame.includes("/death/")),
          ),
        { timeout: 300000 },
      )
      .toBe(true);
    await expect(page.locator(".ki-death-overlay")).toHaveCount(0, { timeout: 60000 });
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-x")))
      .toBeCloseTo(home.x, 0);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-y")))
      .toBeCloseTo(home.y, 0);
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
