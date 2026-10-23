/** Browser-native CPU-world contract. Does not install a world or change saves. */
import { FOOT_RADIUS, WORLD_EDGE_MARGIN } from "../../geometry";
import { Navigation, type Point } from "../../navigation";
import { blockedAt, type Obstacle } from "../../movement";
export type Runs = [number, number][];
export type GridData = {
  cell: number;
  width: number;
  height: number;
  blocked?: Runs;
  flags?: Runs;
};
export function decodeRuns(input: unknown, count: number): Uint8Array {
  if (!Number.isSafeInteger(count) || count < 1 || count > 16_000_000 || !Array.isArray(input))
    throw new Error("Invalid CPU grid size");
  const result = new Uint8Array(count);
  let at = 0;
  for (const run of input) {
    if (
      !Array.isArray(run) ||
      run.length !== 2 ||
      !Number.isInteger(run[0]) ||
      run[0] < 0 ||
      run[0] > 255 ||
      !Number.isSafeInteger(run[1]) ||
      run[1] < 1 ||
      at + run[1] > count
    )
      throw new Error("Invalid CPU grid run");
    result.fill(run[0], at, at + run[1]);
    at += run[1];
  }
  if (at !== count) throw new Error("Incomplete CPU grid");
  return result;
}
export function browserNavigation(
  width: number,
  height: number,
  navigation: GridData,
  terrain: GridData,
  colliders: readonly Obstacle[],
): Navigation {
  if (
    navigation.cell !== 16 ||
    terrain.cell !== 32 ||
    navigation.width * 16 !== width ||
    navigation.height * 16 !== height ||
    terrain.width * 32 !== width ||
    terrain.height * 32 !== height
  )
    throw new Error("CPU grid geometry mismatch");
  const blocked = decodeRuns(navigation.blocked, navigation.width * navigation.height),
    flags = decodeRuns(terrain.flags, terrain.width * terrain.height);
  if (blocked.some((v) => v > 1)) throw new Error("Invalid CPU navigation occupancy");
  const index = new Map<string, Obstacle[]>();
  for (const r of colliders) {
    if (
      ![r.x, r.y, r.width, r.height].every(Number.isFinite) ||
      r.width <= 0 ||
      r.height <= 0 ||
      r.x < 0 ||
      r.y < 0 ||
      r.x + r.width > width + 1 ||
      r.y + r.height > height + 1
    )
      throw new Error("Invalid CPU collider");
    for (let y = Math.floor(r.y / 256); y <= Math.floor((r.y + r.height) / 256); y++)
      for (let x = Math.floor(r.x / 256); x <= Math.floor((r.x + r.width) / 256); x++) {
        const key = x + ":" + y;
        const list = index.get(key) ?? [];
        list.push(r);
        index.set(key, list);
      }
  }
  const walkable = (p: Point) => {
    if (
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      p.x < WORLD_EDGE_MARGIN ||
      p.y < WORLD_EDGE_MARGIN ||
      p.x > width - WORLD_EDGE_MARGIN ||
      p.y > height - WORLD_EDGE_MARGIN
    )
      return false;
    for (
      let y = Math.max(0, Math.floor((p.y - FOOT_RADIUS) / 32));
      y <= Math.min(terrain.height - 1, Math.floor((p.y + FOOT_RADIUS) / 32));
      y++
    )
      for (
        let x = Math.max(0, Math.floor((p.x - FOOT_RADIUS) / 32));
        x <= Math.min(terrain.width - 1, Math.floor((p.x + FOOT_RADIUS) / 32));
        x++
      )
        if (
          !(flags[y * terrain.width + x]! & 1) &&
          blockedAt(p.x, p.y, [{ x: x * 32, y: y * 32, width: 32, height: 32 }])
        )
          return false;
    for (
      let y = Math.floor((p.y - FOOT_RADIUS) / 256);
      y <= Math.floor((p.y + FOOT_RADIUS) / 256);
      y++
    )
      for (
        let x = Math.floor((p.x - FOOT_RADIUS) / 256);
        x <= Math.floor((p.x + FOOT_RADIUS) / 256);
        x++
      )
        if (blockedAt(p.x, p.y, index.get(x + ":" + y) ?? [])) return false;
    return true;
  };
  return new Navigation(width, height, [], { cell: 16, blocked, walkable });
}
