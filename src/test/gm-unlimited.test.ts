import { describe, expect, it } from "vitest";
import { GameSession, SaveStore } from "../game/session";
import { RACE_IDS } from "../game/world/races";

describe("GM unlimited (no ability cooldowns)", () => {
  it.each(RACE_IDS)("%s: abilities recast without cooldown while on, normal when off", (race) => {
    const game = new GameSession(new SaveStore(null), race);
    game.player.level = 3;
    const skill = race === "legend" ? "C1" : "B1";
    game.command({ type: "learn", node: skill });
    const ability = game.kit.abilities().find((a) => a.id === skill)!;
    game.staff = "gm";
    game.player.ki = 500;
    game.command({ type: "staff", action: "unlimited" });
    expect(game.snapshot().unlimited).toBe(true);
    const before = game.player.ki;
    for (let i = 0; i < 4; i++) {
      game.command({ type: "ability", ability: skill });
      game.tick(50);
      expect(game.kit.cooldowns[skill] ?? 0).toBe(0);
    }
    // Every cast was paid in KI (unlimited removes cooldowns, not costs).
    expect(before - game.player.ki).toBeGreaterThanOrEqual(ability.ki * 4 - 5);
    // Switching it off restores the normal cooldown.
    game.command({ type: "staff", action: "unlimited" });
    expect(game.snapshot().unlimited).toBe(false);
    game.player.ki = 500;
    game.command({ type: "ability", ability: skill });
    expect(game.kit.cooldowns[skill]).toBe(ability.cd);
  });

  it("is ignored for a character without staff rights", () => {
    const game = new GameSession(new SaveStore(null), "legend");
    game.command({ type: "staff", action: "unlimited" });
    expect(game.snapshot().unlimited).toBe(false);
  });
});
