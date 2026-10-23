import { FOOT_RADIUS, WORLD_EDGE_MARGIN } from "./geometry";
import { blockedAt, clearSight, type Obstacle } from "./movement";

export type Point = { x: number; y: number };
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Precomputed CPU grid; collision callback retains exact circular-foot geometry. */
export type NavigationField = {
  cell: number;
  blocked: Uint8Array;
  walkable: (p: Point) => boolean;
};

/** Cached foot-clearance grid. A* never cuts a diagonal through obstacle corners. */
export class Navigation {
  readonly cell: number;
  private cols: number;
  private rows: number;
  private blocked: Uint8Array;
  constructor(
    readonly width: number,
    readonly height: number,
    readonly obstacles: readonly Obstacle[],
    private readonly field?: NavigationField,
  ) {
    this.cell = field?.cell ?? 24;
    this.cols = Math.ceil(width / this.cell);
    this.rows = Math.ceil(height / this.cell);
    if (field) {
      if (field.blocked.length !== this.cols * this.rows)
        throw new Error("Invalid navigation field size");
      this.blocked = field.blocked;
      return;
    }
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let i = 0; i < this.blocked.length; i++) {
      const p = this.point(i);
      this.blocked[i] = this.walkable(p) ? 0 : 1;
    }
  }
  walkable(p: Point): boolean {
    if (this.field)
      return (
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= WORLD_EDGE_MARGIN &&
        p.y >= WORLD_EDGE_MARGIN &&
        p.x <= this.width - WORLD_EDGE_MARGIN &&
        p.y <= this.height - WORLD_EDGE_MARGIN &&
        this.field.walkable(p)
      );
    return (
      p.x >= WORLD_EDGE_MARGIN &&
      p.y >= WORLD_EDGE_MARGIN &&
      p.x <= this.width - WORLD_EDGE_MARGIN &&
      p.y <= this.height - WORLD_EDGE_MARGIN &&
      !blockedAt(p.x, p.y, this.obstacles, FOOT_RADIUS)
    );
  }
  visible(a: Point, b: Point): boolean {
    return this.field ? this.segment(a, b) : clearSight(a.x, a.y, b.x, b.y, this.obstacles);
  }
  private segment(a: Point, b: Point): boolean {
    const steps = Math.max(1, Math.ceil(distance(a, b) / 8));
    for (let i = 1; i <= steps; i++)
      if (
        !this.walkable({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps })
      )
        return false;
    return true;
  }
  private index(p: Point) {
    return (
      Math.max(0, Math.min(this.rows - 1, Math.floor(p.y / this.cell))) * this.cols +
      Math.max(0, Math.min(this.cols - 1, Math.floor(p.x / this.cell)))
    );
  }
  private point(i: number): Point {
    return {
      x: ((i % this.cols) + 0.5) * this.cell,
      y: (Math.floor(i / this.cols) + 0.5) * this.cell,
    };
  }
  private accessibleCell(p: Point): number {
    const at = this.index(p),
      cx = at % this.cols,
      cy = Math.floor(at / this.cols);
    let best = -1,
      nearest = Infinity;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx,
          y = cy + dy,
          i = y * this.cols + x;
        if (x < 0 || y < 0 || x >= this.cols || y >= this.rows || this.blocked[i]) continue;
        const point = this.point(i),
          d = distance(p, point);
        if (d < nearest && this.segment(p, point)) {
          best = i;
          nearest = d;
        }
      }
    return best;
  }
  safe(p: Point): Point {
    if (this.walkable(p)) return { ...p };
    const start = this.point(this.index(p));
    for (let r = this.cell; r < 600; r += this.cell)
      for (let angle = 0; angle < 16; angle++) {
        const q = {
          x: start.x + Math.cos((angle * Math.PI) / 8) * r,
          y: start.y + Math.sin((angle * Math.PI) / 8) * r,
        };
        if (this.walkable(q)) return q;
      }
    throw new Error("Brak bezpiecznego punktu na mapie.");
  }
  path(from: Point, requested: Point): Point[] {
    const to = this.safe(requested);
    if (this.segment(from, to)) return [to];
    const start = this.accessibleCell(from),
      goal = this.accessibleCell(to);
    if (start < 0 || goal < 0) return [];
    if (this.field) return this.fieldPath(start, goal, to);
    const open = new Set([start]),
      closed = new Set<number>();
    const parent = new Map<number, number>(),
      cost = new Map([[start, 0]]);
    const score = (i: number) => (cost.get(i) ?? Infinity) + distance(this.point(i), to);
    for (let attempts = 0; open.size && attempts < this.blocked.length; attempts++) {
      let cur = -1,
        best = Infinity;
      for (const i of open) {
        const s = score(i);
        if (s < best) {
          best = s;
          cur = i;
        }
      }
      if (cur === goal) {
        const result: Point[] = [to];
        let at = cur;
        while (at !== start) {
          result.unshift(this.point(at));
          at = parent.get(at)!;
        }
        result.unshift(this.point(start));
        return result;
      }
      open.delete(cur);
      closed.add(cur);
      const cx = cur % this.cols,
        cy = Math.floor(cur / this.cols);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = cx + dx,
            y = cy + dy,
            n = y * this.cols + x;
          if (
            x < 0 ||
            y < 0 ||
            x >= this.cols ||
            y >= this.rows ||
            this.blocked[n] ||
            closed.has(n)
          )
            continue;
          if (dx && dy && (this.blocked[cy * this.cols + x] || this.blocked[y * this.cols + cx]))
            continue;
          const c = (cost.get(cur) ?? Infinity) + this.cell * Math.hypot(dx, dy);
          if (c < (cost.get(n) ?? Infinity)) {
            cost.set(n, c);
            parent.set(n, cur);
            open.add(n);
          }
        }
    }
    return [];
  }
  private fieldPath(start: number, goal: number, to: Point): Point[] {
    const queue: { id: number; cost: number; score: number }[] = [];
    const push = (item: (typeof queue)[number]) => {
      let i = queue.length;
      queue.push(item);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (queue[p]!.score <= item.score) break;
        queue[i] = queue[p]!;
        i = p;
      }
      queue[i] = item;
    };
    const pop = () => {
      const first = queue[0]!,
        last = queue.pop()!;
      if (queue.length) {
        let i = 0;
        while (i * 2 + 1 < queue.length) {
          let child = i * 2 + 1;
          if (child + 1 < queue.length && queue[child + 1]!.score < queue[child]!.score) child++;
          if (queue[child]!.score >= last.score) break;
          queue[i] = queue[child]!;
          i = child;
        }
        queue[i] = last;
      }
      return first;
    };
    const costs = new Map<number, number>([[start, 0]]),
      parents = new Map<number, number>();
    const closed = new Set<number>();
    push({ id: start, cost: 0, score: distance(this.point(start), to) });
    while (queue.length && closed.size < 1_000_000) {
      const current = pop(),
        at = current.id;
      if (closed.has(at)) continue;
      if (at === goal) {
        const path: Point[] = [to];
        let v = at;
        while (v !== start) {
          path.push(this.point(v));
          v = parents.get(v)!;
        }
        path.push(this.point(start));
        return path.reverse();
      }
      closed.add(at);
      const x = at % this.cols,
        y = Math.floor(at / this.cols);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx,
            ny = y + dy,
            next = ny * this.cols + nx;
          if (
            nx < 0 ||
            ny < 0 ||
            nx >= this.cols ||
            ny >= this.rows ||
            this.blocked[next] ||
            closed.has(next)
          )
            continue;
          if (dx && dy && (this.blocked[y * this.cols + nx] || this.blocked[ny * this.cols + x]))
            continue;
          const cost = current.cost + Math.hypot(dx, dy) * this.cell;
          if (cost >= (costs.get(next) ?? Infinity)) continue;
          costs.set(next, cost);
          parents.set(next, at);
          push({ id: next, cost, score: cost + distance(this.point(next), to) });
        }
    }
    return [];
  }
  step(p: Point, to: Point, amount: number): Point {
    const d = distance(p, to);
    if (d < 0.01) return p;
    const step = Math.min(amount, d);
    const next = { x: p.x + ((to.x - p.x) / d) * step, y: p.y + ((to.y - p.y) / d) * step };
    if (this.walkable(next) && (!this.field || this.segment(p, next))) return next;
    if (
      this.walkable({ x: next.x, y: p.y }) &&
      (!this.field || this.segment(p, { x: next.x, y: p.y }))
    )
      return { x: next.x, y: p.y };
    if (
      this.walkable({ x: p.x, y: next.y }) &&
      (!this.field || this.segment(p, { x: p.x, y: next.y }))
    )
      return { x: p.x, y: next.y };
    return p;
  }
}
