import { TrialAttempt } from "../development/trials/attempt";
import type { OnlineClient, OnlineFrame } from "./client";

/** Display adapter only: every action and every verdict remains on the server. */
export function remoteTrial(client: OnlineClient, initial: NonNullable<OnlineFrame["trial"]>) {
  const attempt = new TrialAttempt(initial.id, initial.tier);
  let latest = initial;
  Object.defineProperty(attempt, "instanceId", { value: initial.instanceId });
  Object.defineProperty(attempt, "currentPoint", { get: () => latest.result.point ?? undefined });
  Object.defineProperty(attempt, "passed", { get: () => latest.result.outcome === "passed" });
  Object.defineProperty(attempt, "started", { get: () => latest.started });
  attempt.authoritative = true;
  attempt.snapshot = () => latest.result;
  attempt.update = () => {};
  const action = (action: "ready" | "inspect" | "close") =>
    client.intent({ type: "trial-action", instanceId: attempt.instanceId, action });
  attempt.begin = (suspended = false) =>
    client.intent({
      type: "trial-action",
      instanceId: attempt.instanceId,
      action: "ready",
      suspended,
    });
  attempt.suspend = (value) => {
    s.paused = value;
    client.intent({
      type: "trial-action",
      instanceId: attempt.instanceId,
      action: value ? "suspend" : "resume",
    });
  };
  attempt.inspect = () => action("inspect");
  attempt.closeReading = () => action("close");
  attempt.answer = (round, answerId, modules) =>
    client.intent({
      type: "trial-answer",
      instanceId: attempt.instanceId,
      round,
      answerId,
      modules,
    });
  const s = attempt.session;
  s.command = (command) => {
    if (command.type === "pause") {
      attempt.suspend(command.value);
      return;
    }
    client.intent({ type: "trial-input", instanceId: attempt.instanceId, command });
  };
  s.manual = (x, y) => client.direction(x, y);
  s.tick = () => {};
  s.flush = () => {};
  s.snapshot = () => latest.view;
  s.kit.abilities = () => latest.view.abilities;
  Object.defineProperty(s.kit, "shieldPoints", { get: () => latest.view.shieldPoints });
  const apply = (frame: typeof initial) => {
    latest = frame;
    s.player = structuredClone(frame.view.player);
    s.facing = { ...frame.facing };
    s.moving = frame.moving;
    s.running = frame.running ?? false;
    s.nowMs = frame.nowMs;
    s.targetId = frame.view.targetId;
    s.paused = frame.suspended || !frame.started || frame.result.outcome !== "running";
    s.practiceTargets.mirror(frame.result.targets);
    // Presentation-only copy, as in the exam adapter; local tick/AI remain disabled.
    s.enemies.splice(0, s.enemies.length, ...structuredClone(frame.enemies ?? []));
    s.events.push(...frame.events);
  };
  apply(initial);
  return { attempt, apply };
}
