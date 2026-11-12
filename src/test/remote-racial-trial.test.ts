import { it, expect } from "vitest";
import { remoteTrial } from "../game/online/trial";
import type { OnlineClient, OnlineFrame } from "../game/online/client";
import { TrialAttempt } from "../game/development/trials/attempt";
import { completeTrial } from "./helpers/racialTrials";

it("a remote trial only mirrors server facts and sends instance-bound intentions", () => {
  const owner = new TrialAttempt("TP08", 1),
    packets: unknown[] = [],
    directions: unknown[] = [];
  const client = {
    intent: (p: unknown) => packets.push(p),
    direction: (x: number, y: number) => directions.push({ x, y }),
  } as unknown as OnlineClient;
  const frame = (): NonNullable<OnlineFrame["trial"]> => ({
    instanceId: owner.instanceId,
    id: owner.trialId,
    tier: owner.tier,
    started: owner.started,
    suspended: owner.session.paused,
    result: owner.snapshot(),
    view: owner.session.snapshot(),
    facing: owner.session.facing,
    moving: owner.session.moving,
    events: [],
    enemies: structuredClone(owner.session.enemies),
    nowMs: owner.session.nowMs,
  });
  const mirror = remoteTrial(client, frame());
  mirror.attempt.begin(true);
  mirror.attempt.session.command({ type: "pause", value: true });
  mirror.attempt.session.command({ type: "ability", ability: "R" });
  mirror.attempt.session.manual(1, 0, 50);
  mirror.attempt.session.tick(5000);
  mirror.attempt.update();
  expect(mirror.attempt.snapshot().activeMs).toBe(0);
  expect(mirror.attempt.passed).toBe(false);
  expect(packets).toEqual([
    { type: "trial-action", instanceId: owner.instanceId, action: "ready", suspended: true },
    { type: "trial-action", instanceId: owner.instanceId, action: "suspend" },
    {
      type: "trial-input",
      instanceId: owner.instanceId,
      command: { type: "ability", ability: "R" },
    },
  ]);
  expect(directions).toEqual([{ x: 1, y: 0 }]);
  expect(mirror.attempt.session.practiceTargets.get(owner.snapshot().targets[0]!.id)).toBeDefined();
  completeTrial(owner);
  mirror.apply(frame());
  expect(mirror.attempt.passed).toBe(true);
  expect(mirror.attempt.session.practiceTargets.list(null)).toHaveLength(0);
});

it("combat mirror displays authoritative foes without advancing local AI", () => {
  const owner = new TrialAttempt("TP03", 1);
  owner.begin();
  owner.session.tick(50);
  owner.update();
  const client = { intent: () => {}, direction: () => {} } as unknown as OnlineClient;
  const frame = (): NonNullable<OnlineFrame["trial"]> => ({
    instanceId: owner.instanceId,
    id: owner.trialId,
    tier: owner.tier,
    started: owner.started,
    suspended: owner.session.paused,
    result: owner.snapshot(),
    view: owner.session.snapshot(),
    facing: owner.session.facing,
    moving: owner.session.moving,
    events: [],
    enemies: structuredClone(owner.session.enemies),
    nowMs: owner.session.nowMs,
  });
  const mirror = remoteTrial(client, frame());
  expect(mirror.attempt.session.enemies.length).toBeGreaterThan(0);
  expect(mirror.attempt.session.enemies[0]).not.toBe(owner.session.enemies[0]);
  const before = structuredClone(mirror.attempt.session.enemies);
  mirror.attempt.session.tick(5000);
  mirror.attempt.update();
  expect(mirror.attempt.session.enemies).toEqual(before);
  completeTrial(owner);
  mirror.apply(frame());
  expect(mirror.attempt.session.enemies).toHaveLength(0);
  expect(mirror.attempt.passed).toBe(true);
});
