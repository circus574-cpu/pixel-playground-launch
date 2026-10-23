/** Deterministic ambient residents: no combat actors, storage access or essential-shop closures. */
import { distance, type Point } from "../../navigation";
export type LifeRoute = { id: string; points: Point[] };
export type LifeSegment = {
  fromMs: number;
  toMs: number;
  activity: string;
  indoors: boolean;
  route?: string;
  position?: Point;
};
export type LifeRoutine = {
  id: string;
  dayMs: number;
  phaseOffsetMs: number;
  segments: LifeSegment[];
};
export type Resident = { id: string; routine: string; role: string; artBinding: string };
export class SettlementLife {
  private routes = new Map<string, { points: Point[]; length: number; cumulative: number[] }>();
  private routines = new Map<string, LifeRoutine>();
  constructor(
    private readonly residents: readonly Resident[],
    routes: readonly LifeRoute[],
    routines: readonly LifeRoutine[],
  ) {
    for (const r of routes) {
      if (
        !r.points.length ||
        this.routes.has(r.id) ||
        r.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
      )
        throw Error("Invalid resident route");
      let length = 0;
      const cumulative = [0];
      for (let i = 1; i < r.points.length; i++) {
        length += distance(r.points[i - 1]!, r.points[i]!);
        cumulative.push(length);
      }
      this.routes.set(r.id, { points: r.points.map((p) => ({ ...p })), length, cumulative });
    }
    for (const r of routines) {
      if (
        this.routines.has(r.id) ||
        !Number.isFinite(r.dayMs) ||
        r.dayMs <= 0 ||
        !Number.isFinite(r.phaseOffsetMs) ||
        !r.segments.length
      )
        throw Error("Invalid resident routine");
      let at = 0;
      const endpoint = (s: LifeSegment, last: boolean) =>
        s.route ? this.routes.get(s.route)?.points.at(last ? -1 : 0) : s.position;
      for (let i = 0; i < r.segments.length; i++) {
        const s = r.segments[i]!;
        if (
          s.fromMs !== at ||
          s.toMs <= s.fromMs ||
          s.toMs > r.dayMs ||
          !Number.isFinite(s.toMs) ||
          !endpoint(s, false) ||
          !endpoint(s, true) ||
          Boolean(s.route) === Boolean(s.position)
        )
          throw Error("Routine has a gap or missing route");
        at = s.toMs;
        const next = r.segments[(i + 1) % r.segments.length]!;
        const a = endpoint(s, true),
          b = endpoint(next, false);
        if (!a || !b || distance(a, b) > 0.01) throw Error("Routine teleports between activities");
      }
      if (at !== r.dayMs) throw Error("Routine does not cover a day");
      this.routines.set(r.id, structuredClone(r));
    }
    if (
      new Set(residents.map((r) => r.id)).size !== residents.length ||
      residents.some((r) => !this.routines.has(r.routine))
    )
      throw Error("Invalid resident identity");
  }
  at(resident: Resident, worldMs: number): Point & { activity: string; visible: boolean } {
    if (!Number.isFinite(worldMs) || worldMs < 0) throw Error("Invalid world clock");
    const routine = this.routines.get(resident.routine);
    if (!routine) throw Error("Missing resident routine");
    const t = (worldMs + routine.phaseOffsetMs) % routine.dayMs;
    const s = routine.segments.find((s) => t >= s.fromMs && t < s.toMs)!;
    let p = s.position;
    if (s.route) {
      const route = this.routes.get(s.route)!;
      const target = (route.length * (t - s.fromMs)) / (s.toMs - s.fromMs);
      let i = 1;
      while (i < route.cumulative.length - 1 && route.cumulative[i]! < target) i++;
      const a = route.points[Math.max(0, i - 1)]!,
        b = route.points[Math.min(i, route.points.length - 1)]!,
        span = (route.cumulative[i] ?? 0) - (route.cumulative[i - 1] ?? 0),
        fraction = span > 0 ? (target - (route.cumulative[i - 1] ?? 0)) / span : 0;
      p = { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
    }
    return { ...p!, activity: s.activity, visible: !s.indoors };
  }
  nearby(player: Point, worldMs: number, maximum = 16, radius = 1000) {
    if (
      !Number.isFinite(radius) ||
      radius < 0 ||
      !Number.isInteger(maximum) ||
      maximum < 0 ||
      maximum > 16
    )
      throw Error("Invalid resident activation budget");
    return this.residents
      .map((r) => ({ resident: r, ...this.at(r, worldMs) }))
      .filter((r) => r.visible && distance(r, player) <= radius)
      .sort(
        (a, b) =>
          distance(a, player) - distance(b, player) || a.resident.id.localeCompare(b.resident.id),
      )
      .slice(0, maximum);
  }
}
