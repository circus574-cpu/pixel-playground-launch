import { describe, expect, it } from "vitest";
import { GameSession } from "../game/session";
import { Navigation } from "../game/navigation";
import { LEVEL_MAX } from "../game/kit/progression";
import { WORLDS } from "../game/world/worlds";
import { xpNeeded } from "../game/session";

function arena() {
  const world = structuredClone(WORLDS.aether);
  Object.assign(world, {
    width: 8192,
    height: 6144,
    city: undefined,
    enemies: [],
    monsters: [],
    obstacles: [],
    spawn: { x: 3000, y: 2000 },
  });
  return new GameSession(undefined, "sage", {
    world,
    navigation: new Navigation(8192, 6144, []),
  });
}

describe("poziom bez limitu 20", () => {
  it("awans z poziomu 20 na 21 daje kolejny punkt umiejętności", () => {
    const g = arena();
    g.player.level = 20;
    g.player.xp = 0;
    const before = g.skillPoints;
    (g as unknown as { award(xp: number): void }).award(xpNeeded(20));
    expect(g.player.level).toBe(21);
    expect(g.skillPoints).toBe(before + 1);
  });

  it("poziom rośnie dalej aż do limitu technicznego, nie zatrzymuje się na 100", () => {
    const g = arena();
    g.player.level = 100;
    g.player.xp = 0;
    (g as unknown as { award(xp: number): void }).award(xpNeeded(100));
    expect(g.player.level).toBe(101);
  });

  it("limit techniczny poziomu jest dużo większy niż 100", () => {
    expect(LEVEL_MAX).toBeGreaterThan(100);
  });
});
