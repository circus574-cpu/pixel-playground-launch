/** Local-PvE dungeon progression. Inventory and this snapshot must be saved in one transaction. */
import { distance, type Point } from "../../navigation";
export type DungeonFloor = {
  id: string;
  keys: (Point & { id: string })[];
  gates: (Point & { id: string; key: string })[];
  chests: (Point & { id: string; reward: { gold: number; potion: number } })[];
};
export type DungeonSnapshot = {
  version: 1;
  floor: string;
  keys: string[];
  gates: string[];
  chests: string[];
};
export class DungeonProgress {
  private state: DungeonSnapshot;
  constructor(
    readonly floor: DungeonFloor,
    private readonly canReach: (a: Point, b: Point) => boolean,
    snapshot?: DungeonSnapshot,
  ) {
    const validIds = (values: unknown, allowed: { id: string }[]): values is string[] =>
      Array.isArray(values) &&
      new Set(values).size === values.length &&
      values.every((v) => typeof v === "string" && allowed.some((a) => a.id === v));
    if (
      snapshot &&
      (snapshot.version !== 1 ||
        snapshot.floor !== floor.id ||
        !validIds(snapshot.keys, floor.keys) ||
        !validIds(snapshot.gates, floor.gates) ||
        !validIds(snapshot.chests, floor.chests) ||
        snapshot.gates.some(
          (id) => !snapshot.keys.includes(floor.gates.find((g) => g.id === id)!.key),
        ))
    )
      throw new Error("Unknown, inconsistent or newer dungeon state; preserve original save");
    this.state = snapshot
      ? structuredClone(snapshot)
      : { version: 1, floor: floor.id, keys: [], gates: [], chests: [] };
  }
  snapshot(): DungeonSnapshot {
    return structuredClone(this.state);
  }
  private near(p: Point, target: Point): boolean {
    return (
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      distance(p, target) <= 96 &&
      this.canReach(p, target)
    );
  }
  pickup(id: string, p: Point): boolean {
    const key = this.floor.keys.find((k) => k.id === id);
    if (!key || this.state.keys.includes(id) || !this.near(p, key)) return false;
    this.state.keys.push(id);
    return true;
  }
  open(id: string, p: Point): boolean {
    const gate = this.floor.gates.find((g) => g.id === id);
    if (
      !gate ||
      this.state.gates.includes(id) ||
      !this.state.keys.includes(gate.key) ||
      !this.near(p, gate)
    )
      return false;
    this.state.gates.push(id);
    return true;
  }
  claim(id: string, p: Point): { gold: number; potion: number } | null {
    const chest = this.floor.chests.find((c) => c.id === id);
    if (!chest || this.state.chests.includes(id) || !this.near(p, chest)) return null;
    this.state.chests.push(id);
    return { ...chest.reward };
  }
  lockedGates() {
    return this.floor.gates.filter((g) => !this.state.gates.includes(g.id));
  }
}
