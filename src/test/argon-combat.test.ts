import { describe, expect, it } from "vitest";
import { GameSession, SaveStore, newPlayer, type StoragePort } from "../game/session";
import { RACE_IDS } from "../game/world/races";

describe("Argon controls use the canonical session", () => {
  it.each(RACE_IDS)(
    "%s: rapid presses spend KI once; movement continues during cooldown",
    (race) => {
      const game = new GameSession(new SaveStore(null), race);
      game.player.level = 3;
      const skill = race === "legend" ? "C1" : "B1";
      game.command({ type: "learn", node: skill });
      game.player.ki = 40;
      const ability = game.kit.abilities().find((a) => a.id === skill)!;
      for (let i = 0; i < 10; i++) game.command({ type: "ability", ability: skill });
      expect(game.player.ki).toBe(40 - ability.ki);
      expect(game.kit.cooldowns[skill]).toBe(ability.cd);
      const before = { x: game.player.x, y: game.player.y };
      game.manual(1, 0, 50);
      game.tick(50);
      expect(Math.hypot(game.player.x - before.x, game.player.y - before.y)).toBeGreaterThan(0);
      expect(game.kit.cooldowns[skill]).toBe(ability.cd - 50);
    },
  );

  it.each(RACE_IDS)(
    "%s: v4 migration preserves canonical skills, inventory and progress",
    (race) => {
      const data = new Map<string, string>();
      const storage: StoragePort = {
        getItem: (k) => data.get(k) ?? null,
        setItem: (k, v) => {
          data.set(k, v);
        },
      };
      const player = { ...newPlayer(race), level: 3, skills: ["R", "B1"], xp: 37, gold: 91 };
      player.items.potion = 7;
      const raw = JSON.stringify({ version: 4, revision: "before-argon", player });
      data.set("character", raw);
      const store = new SaveStore(storage, "character");
      const restored = store.load()!;
      expect(restored).toMatchObject({
        skills: player.skills,
        items: player.items,
        quests: player.quests,
        level: 3,
        xp: 37,
        gold: 91,
      });
      expect(store.save(restored)).toBe(true);
      expect(data.get("ki-legends:recovery:before-v5:character")).toBe(raw);
      const stale = new SaveStore(storage, "character");
      stale.load();
      expect(store.save({ ...restored, gold: 92 })).toBe(true);
      const latest = data.get("character");
      expect(stale.save(restored)).toBe(false);
      expect(data.get("character")).toBe(latest);
    },
  );
});
