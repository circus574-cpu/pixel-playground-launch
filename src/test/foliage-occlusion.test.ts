import { describe, expect, it } from "vitest";
import { foliageAlpha, focusOcclusion } from "../game/world/visibility";
import type { ForestObject } from "../game/world/forest";

const tree = {
  kind: "forest-pine-tree",
  x: 1000,
  y: 1000,
  width: 300,
  height: 400,
  anchorX: 0.5,
  anchorY: 0.92,
} as unknown as ForestObject;

describe("foliage never hides creatures", () => {
  it("fades a crown that covers a monster standing behind it", () => {
    focusOcclusion.reset();
    const alpha = foliageAlpha(tree, [{ id: "enemy:a", x: 1000, y: 800 }]);
    expect(alpha).toBeLessThan(0.5);
    expect(focusOcclusion.covered("enemy:a")).toBe(true);
  });
  it("leaves the crown opaque when nothing stands behind it", () => {
    focusOcclusion.reset();
    expect(foliageAlpha(tree, [{ id: "enemy:b", x: 3000, y: 800 }])).toBe(1);
    expect(foliageAlpha(tree, [{ id: "enemy:c", x: 1000, y: 1200 }])).toBe(1);
    expect(focusOcclusion.covered("enemy:b")).toBe(false);
  });
  it("uses the strongest fade of all creatures behind the same crown", () => {
    focusOcclusion.reset();
    const a = foliageAlpha(tree, [
      { id: "enemy:d", x: 1000, y: 800 },
      { id: "npc:e", x: 1100, y: 850 },
    ]);
    expect(a).toBeLessThan(0.5);
    expect(focusOcclusion.covered("npc:e")).toBe(true);
  });
});
