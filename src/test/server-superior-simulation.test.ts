// @vitest-environment node
import { expect, it } from "vitest";
import path from "node:path";
import { prepareServerSimulation, worldFileFetcher } from "../server/characters/superiorSimulation";
import { StoredCharacter, type CharacterRecord } from "../server/characters/repository";
import { RACE_IDS } from "../game/world/races";
import { newPlayer } from "../game/session";

it.each(RACE_IDS)(
  "%s: actual Superior v2 navigation and server checkpoint without browser storage",
  async (race) => {
    const record: CharacterRecord = {
      id: "online-test",
      revision: 1,
      state: { format: "server-character-1", player: newPlayer(race), runtime: {} },
    };
    const simulation = await prepareServerSimulation(record, path.resolve("public"));
    try {
      const s = simulation.session;
      const gold = s.player.gold;
      expect(() => simulation.command({ type: "staff", action: "gold" })).toThrow();
      expect(() => simulation.command({ type: "move", x: Infinity, y: 100 })).toThrow();
      expect(() => simulation.command({ type: "move", x: 100, y: 100, gold: 999999 })).toThrow();
      expect(s.player.gold).toBe(gold);
      expect(s.world.width).toBeGreaterThan(4000);
      expect(s.world.spawn).toEqual({ x: s.player.x, y: s.player.y });
      const before = { x: s.player.x, y: s.player.y };
      const target = s.nav.safe({ x: before.x + 100, y: before.y });
      simulation.command({ type: "move", ...target });
      for (let i = 0; i < 10; i++) await simulation.tick(50);
      expect(Math.hypot(s.player.x - before.x, s.player.y - before.y)).toBeGreaterThan(0);
      const checkpoint = simulation.capture();
      expect(StoredCharacter.safeParse(checkpoint).success).toBe(true);
      const restored = await prepareServerSimulation(
        { ...record, revision: 2, state: checkpoint },
        path.resolve("public"),
      );
      try {
        expect(restored.session.player).toEqual(s.player);
        expect(restored.session.nowMs).toBe(500);
      } finally {
        restored.dispose();
      }
    } finally {
      simulation.dispose();
    }
  },
  60000,
);

it("rejects a filesystem path outside the versioned world", async () => {
  await expect(worldFileFetcher(path.resolve("public"))("/../../secret.json")).rejects.toThrow();
});
