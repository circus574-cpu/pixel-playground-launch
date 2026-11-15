import { describe, expect, it } from "vitest";
import {
  SCENERY_KEEP,
  keepsScenery,
  positionHash,
  thinScenery,
} from "../game/world/sceneryThinning";

const grid = (kind: string, solid = false) =>
  Array.from({ length: 4000 }, (_, i) => ({
    kind,
    solid,
    x: (i % 80) * 97,
    y: Math.floor(i / 80) * 131,
  }));

describe("open-world scenery thinning", () => {
  it("keeps about the configured share of each decoration kind", () => {
    for (const kind of Object.keys(SCENERY_KEEP)) {
      const kept = thinScenery(grid(kind)).length / 4000;
      expect(kept).toBeGreaterThan(SCENERY_KEEP[kind]! - 0.04);
      expect(kept).toBeLessThan(SCENERY_KEEP[kind]! + 0.04);
    }
  });
  it("never drops an object with a collision footprint, nor anything that is not a plain decoration", () => {
    expect(thinScenery(grid("bush", true))).toHaveLength(4000);
    expect(thinScenery(grid("structure"))).toHaveLength(4000);
    expect(thinScenery(grid("ambient-effect"))).toHaveLength(4000);
  });
  it("decides by position, so a chunk looks the same every time it is loaded", () => {
    const first = thinScenery(grid("tree")).map((o) => o.x + ":" + o.y);
    const again = thinScenery([...grid("tree")].reverse()).map((o) => o.x + ":" + o.y);
    expect(new Set(again)).toEqual(new Set(first));
    expect(keepsScenery({ kind: "tree", x: 1234, y: 5678 })).toBe(
      keepsScenery({ kind: "tree", x: 1234, y: 5678 }),
    );
    expect(positionHash(0, 0)).toBeGreaterThanOrEqual(0);
    expect(positionHash(99999, 88888)).toBeLessThan(1);
  });
});
