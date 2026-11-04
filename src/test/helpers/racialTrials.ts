import { expect } from "vitest";
import type { TrialAttempt } from "../../game/development/trials/attempt";
import { trialPuzzles, moduleSolutionValid } from "../../game/development/trials/puzzles";
import { distance, type Point } from "../../game/navigation";
import type { ModuleId } from "../../game/development/state";
export function tickTrial(a: TrialAttempt, n = 1) {
  for (let i = 0; i < n; i++) {
    a.session.tick(50);
    a.update();
  }
}
export function walkTrial(a: TrialAttempt, point: Point) {
  a.session.command({ type: "move", ...point });
  for (
    let i = 0;
    i < 1000 && distance(a.session.player, point) > 12 && a.snapshot().outcome === "running";
    i++
  )
    tickTrial(a);
  expect(distance(a.session.player, point)).toBeLessThanOrEqual(12);
}
export function completeTrial(a: TrialAttempt) {
  a.begin();
  if (["barrier-waves", "cover-windows"].includes(a.definition.kind)) {
    let previous = "";
    for (let n = 0; n < 5000 && a.snapshot().outcome === "running"; n++) {
      const r = a.snapshot(),
        barrier = r.waves ?? r.cover;
      if (barrier?.phase === "warning") {
        const point = a.currentPoint!,
          key = `${point.x},${point.y}`;
        if (key !== previous) {
          previous = key;
          a.session.command({ type: "move", ...point });
        }
        if (r.waves && a.session.kit.shieldPoints === 0)
          a.session.command({ type: "ability", ability: "B1" });
      }
      tickTrial(a);
    }
  } else if (a.definition.kind === "camp") {
    let last = "";
    for (let n = 0; n < 5000 && a.snapshot().outcome === "running"; n++) {
      const point = a.currentPoint!,
        key = point.x + "," + point.y;
      if (key !== last) {
        last = key;
        a.session.command({ type: "move", ...point });
      }
      tickTrial(a);
    }
  } else if (["wind-route", "messenger"].includes(a.definition.kind)) {
    let last = -1,
      leading = true;
    for (let n = 0; n < 12000 && a.snapshot().outcome === "running"; n++) {
      const r = a.snapshot(),
        s = a.session;
      if (r.successes !== last) {
        last = r.successes;
        leading = true;
        s.command({ type: "move", ...a.currentPoint! });
      }
      if (r.escort) {
        if (leading && distance(s.player, r.escort) > 190) {
          leading = false;
          s.command({ type: "move", x: r.escort.x, y: r.escort.y });
        } else if (!leading && distance(s.player, r.escort) < 90) {
          leading = true;
          s.command({ type: "move", ...a.currentPoint! });
        }
      }
      tickTrial(a);
    }
  } else if (!["counter", "earth-rhythm", "restraint", "position"].includes(a.definition.kind)) {
    const puzzles = trialPuzzles(a.definition, a.tier);
    for (let i = 0; i < puzzles.length; i++) {
      walkTrial(a, a.currentPoint!);
      a.inspect();
      const visible = a.snapshot().puzzle!;
      expect(visible).not.toHaveProperty("answer");
      if (visible.modules) {
        const values: ModuleId[] = [
          "mn-scanner",
          "mn-precision",
          ...(a.tier === 1 ? [] : a.tier === 2 ? ["mn-routing" as const] : ["mn-shield" as const]),
        ];
        expect(moduleSolutionValid(puzzles[i]!, values)).toBe(true);
        a.answer(i, "", values);
      } else a.answer(i, puzzles[i]!.answer);
    }
  } else {
    let lastPhase = "",
      hitCycle = false;
    for (let i = 0; i < 10000 && a.snapshot().outcome === "running"; i++) {
      const r = a.snapshot(),
        s = a.session;
      if (r.phase !== lastPhase) {
        if (r.phase === "strike") hitCycle = false;
        lastPhase = r.phase;
      }
      if (r.phase === "warning" && r.danger)
        s.command({ type: "move", x: r.danger.x, y: r.danger.y + (r.danger.y > 400 ? -155 : 155) });
      else if (r.phase === "position" || r.phase === "retreat")
        s.command({ type: "move", ...r.point! });
      else if (
        r.phase === "counter" ||
        r.phase === "attack" ||
        (r.phase === "strike" && !hitCycle)
      ) {
        const target = r.targets[0]!;
        if (distance(s.player, target) > s.kit.basicRange * 0.7)
          s.command({ type: "move", x: 600, y: 350 });
        else {
          s.command({ type: "target", id: target.id });
          s.command({ type: "ability", ability: "R" });
        }
      } else s.command({ type: "cancel" });
      const before = r.targets[0]?.hits ?? 0;
      tickTrial(a);
      if (r.phase === "strike" && (a.snapshot().targets[0]?.hits ?? 0) > before) hitCycle = true;
    }
  }
  expect(a.snapshot().outcome, a.snapshot().reason).toBe("passed");
}
