import type { Foe, Hit } from "../kit";
import type { Point } from "../navigation";
export type PracticeContact = {
  raw: number;
  hit: Hit;
  at: number;
  marked: boolean;
  sealed: boolean;
};
export type PracticeTarget = Foe & {
  owner: string;
  name: string;
  interior: string | null;
  created: number;
  markedUntil: number;
  sealedUntil: number;
  hits: number;
  onHit: (contact: PracticeContact) => void;
};
/** Ephemeral technical targets share the production kits and projectile collision. No XP, loot or save port. */
export class PracticeTargets {
  private readonly targets = new Map<string, PracticeTarget>();
  add(
    owner: string,
    name: string,
    point: Point,
    interior: string | null,
    now: number,
    onHit: PracticeTarget["onHit"],
  ) {
    if (!owner || ![point.x, point.y, now].every(Number.isFinite))
      throw Error("Invalid practice target");
    const target: PracticeTarget = {
      id: "practice-target:" + crypto.randomUUID(),
      owner,
      name,
      ...point,
      interior,
      created: now,
      markedUntil: 0,
      sealedUntil: 0,
      hits: 0,
      hp: 1_000_000,
      maxHp: 1_000_000,
      onHit,
    };
    this.targets.set(target.id, target);
    return target;
  }
  get(id: string | null) {
    return id ? this.targets.get(id) : undefined;
  }
  has(foe: Foe) {
    return this.targets.get(foe.id) === foe && foe.hp > 0;
  }
  list(interior: string | null) {
    return [...this.targets.values()].filter((t) => t.interior === interior && t.hp > 0);
  }
  hit(foe: Foe, raw: number, hit: Hit, now: number) {
    if (!this.has(foe) || !Number.isFinite(raw) || raw <= 0) return 0;
    const target = this.targets.get(foe.id)!;
    target.hits++;
    target.onHit({
      raw,
      hit,
      at: now,
      marked: target.markedUntil >= now && target.markedUntil > 0,
      sealed: target.sealedUntil >= now && target.sealedUntil > 0,
    });
    return raw;
  }
  removeOwner(owner: string) {
    for (const [id, target] of this.targets)
      if (target.owner === owner) {
        target.hp = 0;
        this.targets.delete(id);
      }
  }
  clear() {
    for (const target of this.targets.values()) target.hp = 0;
    this.targets.clear();
  }
}
export const isPracticeId = (id: string) => id.startsWith("practice-target:");
