import { describe, expect, it } from "vitest";
import {
  FOREST,
  FOREST_OBJECTS,
  forestObstacles,
  terrainMask,
  tileIndex,
} from "../game/world/forest";
import { blockedAt } from "../game/movement";
import atlas from "../../public/game/assets/anime-forest-v1/objects.json";

describe("production forest world", () => {
  it("uses independent atlas sprites and a complete tile grid, not a baked illustration", () => {
    expect(FOREST.layers).toHaveLength(4);
    for (const layer of FOREST.layers) {
      expect(layer).toHaveLength(FOREST.rows);
      for (const row of layer) {
        expect(row).toHaveLength(FOREST.cols);
        expect(row.every((index) => index >= -1 && index < FOREST.terrainFrameCount)).toBe(true);
      }
    }
    for (const obj of FOREST_OBJECTS) expect(obj.kind in atlas.frames).toBe(true);
    expect(FOREST_OBJECTS.length).toBeGreaterThan(100);
  });
  it("derives every terrain transition from the shared corner grid", () => {
    for (let y = 0; y < FOREST.rows; y++)
      for (let x = 0; x < FOREST.cols; x++) {
        const top = FOREST.vertices[y]!;
        const bottom = FOREST.vertices[y + 1]!;
        const corners = [top[x]!, top[x + 1]!, bottom[x + 1]!, bottom[x]!];
        for (const material of [1, 2, 3] as const)
          expect(FOREST.layers[material]![y]![x]).toBe(
            tileIndex(material, terrainMask(corners, material), (y % 4) * 4 + (x % 4)),
          );
      }
  });
  it("keeps spawns and the bridge open while houses and the river remain solid", () => {
    const obstacles = forestObstacles();
    expect(blockedAt(FOREST.spawn.x, FOREST.spawn.y, obstacles)).toBe(false);
    for (const enemy of FOREST.enemies)
      expect(blockedAt(enemy.x, enemy.y, obstacles), `spawn ${enemy.x},${enemy.y}`).toBe(false);
    expect(blockedAt(FOREST.bridge.x, FOREST.bridge.y, obstacles)).toBe(false);
    const house = FOREST_OBJECTS.find((obj) => obj.kind === "inn")!;
    expect(blockedAt(house.x, house.y, obstacles)).toBe(true);
    const river = FOREST.riverRows[0]!;
    expect(blockedAt(river.x + 100, river.y + 16, obstacles)).toBe(true);
  });
});
