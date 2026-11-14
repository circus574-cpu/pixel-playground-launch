import { ExamAttempt } from "../development/exams";
import type { OnlineClient, OnlineFrame } from "./client";

/** Presentation of a server-owned loan room. No local clock or result can award an exam. */
export function remoteExam(client: OnlineClient, initial: NonNullable<OnlineFrame["exam"]>) {
  const attempt = new ExamAttempt(
    initial.race,
    initial.spec.discipline,
    initial.spec.tier,
    initial.rehearsal,
  );
  let latest = initial;
  Object.defineProperty(attempt, "instanceId", { value: initial.instanceId });
  Object.defineProperty(attempt, "currentPoint", { get: () => latest.currentPoint ?? undefined });
  Object.defineProperty(attempt, "windowOpen", { get: () => latest.windowOpen });
  Object.defineProperty(attempt, "passed", { get: () => latest.result.outcome === "passed" });
  attempt.authoritative = true;
  attempt.snapshot = () => latest.result;
  attempt.update = () => {};
  attempt.chargeNode = () => client.intent({ type: "exam-action", action: "charge" });
  const s = attempt.session;
  s.command = (command) => {
    if (command.type === "pause") {
      s.paused = command.value;
      return;
    }
    client.intent({ type: "exam-input", command });
  };
  s.manual = (x, y) => client.direction(x, y);
  s.tick = () => {};
  s.flush = () => {};
  s.snapshot = () => latest.view;
  s.kit.abilities = () => latest.view.abilities;
  Object.defineProperty(s.kit, "shieldPoints", { get: () => latest.view.shieldPoints });
  function apply(frame: typeof initial) {
    latest = frame;
    s.player = structuredClone(frame.view.player);
    s.facing = { ...frame.facing };
    s.moving = frame.moving;
    s.running = frame.running ?? false;
    s.nowMs = frame.nowMs;
    s.targetId = frame.view.targetId;
    s.enemies.splice(0, s.enemies.length, ...structuredClone(frame.enemies));
    s.events.push(...frame.events);
    Object.assign(s.training, frame.view.training);
  }
  apply(initial);
  return { attempt, apply };
}
