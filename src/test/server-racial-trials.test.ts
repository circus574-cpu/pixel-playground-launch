// @vitest-environment node
import { expect, it } from "vitest";
import path from "node:path";
import { prepareServerSimulation } from "../server/characters/superiorSimulation";
import { StoredCharacter, type CharacterRecord } from "../server/characters/repository";
import { newPlayer, type Command } from "../game/session";
import { RACE_IDS, type RaceId } from "../game/world/races";
import { cityRoom } from "../game/city/room";
import type { TrialId } from "../game/development/trials/catalog";
import { trialPuzzles } from "../game/development/trials/puzzles";
import { distance, type Point } from "../game/navigation";

const ids: Record<RaceId, TrialId> = {
  planetary: "TV10",
  sage: "TA01",
  android: "TN08",
  legend: "TP08",
};
async function fixture(race: RaceId) {
  const record: CharacterRecord = {
    id: "racial-server-fixture",
    revision: 1,
    state: { format: "server-character-1", player: newPlayer(race), runtime: {} },
  };
  const init = await prepareServerSimulation(record, path.resolve("public"));
  const state = init.capture();
  init.dispose();
  const room = cityRoom("arena", state.player.continent);
  Object.assign(state.player, { interior: "arena", x: room.npc.x, y: room.npc.y + 40 });
  (state.runtime["superior"] as { player: typeof state.player }).player = structuredClone(
    state.player,
  );
  return {
    record,
    simulation: await prepareServerSimulation({ ...record, state }, path.resolve("public")),
  };
}
it.each(RACE_IDS)(
  "%s: server owns the loan, checks intentions and persists only the approved grade",
  async (race) => {
    const { record, simulation: s } = await fixture(race);
    try {
      const before = structuredClone(s.session.player);
      s.session.kit.cooldowns["R"] = 876;
      s.command({ type: "trial-start", id: ids[race], tier: 1 });
      const trial = s.trial!;
      expect(trial).toBeDefined();
      const action = (action: string) =>
        s.command({ type: "trial-action", instanceId: trial.instanceId, action });
      const input = (command: Command) =>
        s.command({ type: "trial-input", instanceId: trial.instanceId, command });
      expect(() =>
        s.command({
          type: "trial-action",
          instanceId: trial.instanceId,
          action: "accept",
          passed: true,
        }),
      ).toThrow();
      action("accept");
      expect(s.session.player).toEqual(before);
      s.command({ type: "trial-action", instanceId: "foreign-instance", action: "ready" });
      await s.tick(1000);
      expect(trial.session.nowMs).toBe(0);
      s.command({
        type: "trial-action",
        instanceId: trial.instanceId,
        action: "ready",
        suspended: true,
      });
      await s.tick(1000);
      expect(trial.session.nowMs).toBe(0);
      action("resume");
      await s.tick(50);
      const active = trial.session.nowMs;
      action("suspend");
      for (let i = 0; i < 10; i++) await s.tick(50);
      expect(trial.session.nowMs).toBe(active);
      action("resume");
      const at = { x: trial.session.player.x, y: trial.session.player.y };
      s.command({
        type: "trial-input",
        instanceId: "foreign-instance",
        command: { type: "move", x: 200, y: 200 },
      });
      await s.tick(50);
      expect({ x: trial.session.player.x, y: trial.session.player.y }).toEqual(at);
      const walk = async (point: Point) => {
        input({ type: "move", ...point });
        for (let i = 0; i < 1000 && distance(trial.session.player, point) > 12; i++)
          await s.tick(50);
        expect(distance(trial.session.player, point)).toBeLessThanOrEqual(12);
      };
      if (race !== "legend") {
        const puzzles = trialPuzzles(trial.definition, 1);
        for (let i = 0; i < puzzles.length; i++) {
          await walk(trial.currentPoint!);
          action("inspect");
          expect(trial.snapshot().puzzle).not.toHaveProperty("answer");
          s.command({
            type: "trial-answer",
            instanceId: trial.instanceId,
            round: i,
            answerId: puzzles[i]!.answer,
            ...(race === "android" ? { modules: ["mn-scanner", "mn-precision"] } : {}),
          });
        }
      } else {
        let phase = "",
          hit = false;
        for (let i = 0; i < 1500 && trial.snapshot().outcome === "running"; i++) {
          const r = trial.snapshot();
          if (r.phase !== phase) {
            if (r.phase === "strike") hit = false;
            phase = r.phase;
          }
          const hits = r.targets[0]?.hits ?? 0;
          if (r.phase === "strike" && !hit) {
            input({ type: "target", id: r.targets[0]!.id });
            input({ type: "ability", ability: "R" });
          } else input({ type: "cancel" });
          await s.tick(50);
          if ((trial.snapshot().targets[0]?.hits ?? 0) > hits) hit = true;
        }
      }
      expect(trial.snapshot().outcome, trial.snapshot().reason).toBe("passed");
      expect(s.session.player).toEqual(before);
      expect(s.session.kit.cooldowns["R"]).toBe(876);
      action("accept");
      expect(s.trial).toBeUndefined();
      expect(s.session.player.development!.practiceEarned).toBe(100);
      expect(s.session.player.development!.trials[ids[race]]).toBe(1);
      action("accept");
      expect(s.session.player.development!.practiceEarned).toBe(100);
      const state = s.capture();
      expect(StoredCharacter.safeParse(state).success).toBe(true);
      expect(JSON.stringify(state.runtime)).not.toContain(trial.instanceId);
      const restored = await prepareServerSimulation(
        { ...record, revision: 2, state },
        path.resolve("public"),
      );
      try {
        expect(restored.trial).toBeUndefined();
        expect(restored.session.player.development).toEqual(s.session.player.development);
        expect(restored.session.paused).toBe(false);
      } finally {
        restored.dispose();
      }
    } finally {
      s.dispose();
    }
  },
  60000,
);

it("server disposal discards an unfinished loan without changing its character", async () => {
  const { simulation: s } = await fixture("sage");
  const before = structuredClone(s.session.player);
  s.command({ type: "trial-start", id: "TA01", tier: 1 });
  const trial = s.trial!;
  s.dispose();
  expect(trial.snapshot().outcome).toBe("abandoned");
  expect(s.session.player).toEqual(before);
});

it.each(["TV01", "TV02", "TV03"] as const)(
  "server authoritatively completes %s and restores only the owned grade",
  async (id) => {
    const { record, simulation: s } = await fixture("planetary");
    try {
      const before = structuredClone(s.session.player);
      s.command({ type: "trial-start", id, tier: 1 });
      const a = s.trial!;
      const action = (action: string) =>
        s.command({ type: "trial-action", instanceId: a.instanceId, action });
      const input = (command: Command) =>
        s.command({ type: "trial-input", instanceId: a.instanceId, command });
      action("accept");
      expect(s.session.player).toEqual(before);
      action("ready");
      if (id === "TV02") {
        const puzzles = trialPuzzles(a.definition, 1);
        for (let i = 0; i < puzzles.length; i++) {
          const target = a.currentPoint!;
          input({ type: "move", ...target });
          for (let n = 0; n < 1000 && distance(a.session.player, target) > 12; n++)
            await s.tick(50);
          action("inspect");
          s.command({
            type: "trial-answer",
            instanceId: a.instanceId,
            round: i,
            answerId: puzzles[i]!.answer,
          });
        }
      } else {
        let last = -1,
          leading = true;
        for (let i = 0; i < 12000 && a.snapshot().outcome === "running"; i++) {
          const r = a.snapshot();
          if (r.successes !== last) {
            last = r.successes;
            leading = true;
            input({ type: "move", ...a.currentPoint! });
          }
          if (r.escort) {
            if (leading && distance(a.session.player, r.escort) > 190) {
              leading = false;
              input({ type: "move", x: r.escort.x, y: r.escort.y });
            } else if (!leading && distance(a.session.player, r.escort) < 90) {
              leading = true;
              input({ type: "move", ...a.currentPoint! });
            }
          }
          await s.tick(50);
        }
      }
      expect(a.snapshot().outcome, a.snapshot().reason).toBe("passed");
      expect(s.session.player).toEqual(before);
      action("accept");
      expect(s.session.player.development!.trials[id]).toBe(1);
      expect(s.session.player.development!.practiceEarned).toBe(100);
      action("accept");
      expect(s.session.player.development!.practiceEarned).toBe(100);
      const state = s.capture();
      expect(StoredCharacter.safeParse(state).success).toBe(true);
      expect(JSON.stringify(state.runtime)).not.toContain(a.instanceId);
      const restored = await prepareServerSimulation(
        { ...record, revision: 2, state },
        path.resolve("public"),
      );
      try {
        expect(restored.session.player.development).toEqual(s.session.player.development);
        expect(restored.trial).toBeUndefined();
      } finally {
        restored.dispose();
      }
    } finally {
      s.dispose();
    }
  },
  60000,
);
