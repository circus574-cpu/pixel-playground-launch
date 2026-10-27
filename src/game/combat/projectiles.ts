import type { Point } from "../navigation";

/** First contact with a circular hurtbox, measured along the swept segment [0,1]. */
export function segmentContact(
  a: Point,
  b: Point,
  target: Point,
  radius: number,
): number | undefined {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    ox = a.x - target.x,
    oy = a.y - target.y;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const length = dx * dx + dy * dy;
  if (length < 1e-12) return undefined;
  const dot = ox * dx + oy * dy,
    disc = dot * dot - length * c;
  if (disc < 0) return undefined;
  const t = (-dot - Math.sqrt(disc)) / length;
  return t >= 0 && t <= 1 ? t : undefined;
}
export type Shot = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  remaining: number;
  target: Point;
  radius: number;
  valid: () => boolean;
  hit: () => void;
};
/** A bounded, reusable pool. Damage is independent of rendering and never homes after launch. */
export class Projectiles {
  readonly active: Shot[] = [];
  private spare: Shot[] = [];
  private seq = 0;
  constructor(
    private prefix: string,
    private clear: (a: Point, b: Point) => boolean,
    private ended: (shot: Shot) => void,
    readonly limit = 96,
  ) {}
  launch(
    from: Point,
    to: Point,
    speed: number,
    range: number,
    target: Point,
    valid: () => boolean,
    hit: () => void,
    radius = 18,
  ) {
    if (this.active.length >= this.limit) return undefined;
    const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const shot = this.spare.pop() ?? ({} as Shot);
    Object.assign(shot, {
      id: this.prefix + this.seq++,
      x: from.x,
      y: from.y,
      vx: ((to.x - from.x) / d) * speed,
      vy: ((to.y - from.y) / d) * speed,
      remaining: (range / speed) * 1000,
      target,
      radius,
      valid,
      hit,
    });
    this.active.push(shot);
    return shot;
  }
  tick(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      if (!s) continue;
      if (!s.valid()) {
        this.release(i);
        continue;
      }
      const elapsed = Math.min(dt, s.remaining);
      const to = { x: s.x + (s.vx * elapsed) / 1000, y: s.y + (s.vy * elapsed) / 1000 };
      const contact = segmentContact(s, to, s.target, s.radius);
      const end =
        contact === undefined
          ? to
          : { x: s.x + (to.x - s.x) * contact, y: s.y + (to.y - s.y) * contact };
      if (!this.clear(s, end)) {
        this.release(i);
        continue;
      }
      s.x = end.x;
      s.y = end.y;
      s.remaining -= elapsed;
      if (contact !== undefined) {
        const hit = s.hit;
        this.release(i); // remove before callback: lethal hits cannot hit again or corrupt iteration
        hit();
      } else if (s.remaining <= 0) this.release(i);
    }
  }
  private release(i: number) {
    const s = this.active[i];
    if (!s) return;
    this.active.splice(i, 1);
    this.ended(s);
    s.hit = () => {};
    s.valid = () => false;
    this.spare.push(s);
  }
  cancel() {
    while (this.active.length) this.release(this.active.length - 1);
  }
}
