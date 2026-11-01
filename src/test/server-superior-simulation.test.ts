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
      // Combat transients must survive reconnect: no cooldown reset, cleanse or lost attack buff.
      s.kit.cooldowns["A1"] = 4321;
      s.kit.buffs.push({ id: "online-test-attack", ms: 5000, atkPct: 0.25 });
      s.player.hp = s.kit.stats.maxHp;
      s.fx.rootMs = 1234;
      const checkpoint = simulation.capture();
      expect(StoredCharacter.safeParse(checkpoint).success).toBe(true);
      const restored = await prepareServerSimulation(
        { ...record, revision: 2, state: checkpoint },
        path.resolve("public"),
      );
      try {
        expect(restored.session.player).toEqual(s.player);
        expect(restored.session.nowMs).toBe(500);
        expect(restored.session.kit.cooldowns["A1"]).toBe(4321);
        expect(restored.session.fx.rootMs).toBe(1234);
        expect(restored.session.kit.buffs.some((b) => b.id === "online-test-attack")).toBe(true);
        expect(restored.session.player.hp).toBe(restored.session.kit.stats.maxHp);
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

it.each(RACE_IDS)(
  "%s: server owns exam result and refuses a forged pass",
  async (race) => {
    const seed: CharacterRecord = {
      id: "exam-fixture",
      revision: 1,
      state: { format: "server-character-1", player: newPlayer(race), runtime: {} },
    };
    const first = await prepareServerSimulation(seed, path.resolve("public"));
    const state = first.capture();
    first.dispose();
    const { cityRoom } = await import("../game/city/room");
    const room = cityRoom("arena", state.player.continent);
    const trainer = room.npc;
    state.player.interior = "arena";
    state.player.x = trainer.x;
    state.player.y = trainer.y + 40;
    (state.runtime["superior"] as unknown as { player: typeof state.player }).player =
      structuredClone(state.player);
    const simulation = await prepareServerSimulation({ ...seed, state }, path.resolve("public"));
    try {
      const before = structuredClone(simulation.session.player.development);
      expect(() =>
        simulation.command({ type: "exam-action", action: "accept", result: "passed" }),
      ).toThrow();
      simulation.command({ type: "exam-start", discipline: "strength", tier: 1, rehearsal: true });
      expect(simulation.exam).toBeDefined();
      simulation.command({ type: "exam-action", action: "accept" });
      expect(simulation.exam?.snapshot().outcome).toBe("running");
      expect(simulation.session.player.development).toEqual(before);
      await simulation.tick(50);
      expect(simulation.exam!.session.nowMs).toBe(50);
      expect(simulation.session.nowMs).toBe(0);
      expect(simulation.capture().runtime["simulationMs"]).toBe(0);
      simulation.command({ type: "exam-action", action: "leave" });
      expect(simulation.exam).toBeUndefined();
      expect(simulation.session.player.development).toEqual(before);
    } finally {
      simulation.dispose();
    }
  },
  60000,
);
