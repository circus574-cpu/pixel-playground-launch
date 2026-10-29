import { describe, it, expect } from "vitest";
import { Navigation } from "../game/navigation";
import { blockedAt } from "../game/movement";
const wall = { x: 450, y: 200, width: 36, height: 550 };
for (const field of [false, true])
  describe("local construction over " + (field ? "precomputed" : "lazy") + " navigation", () => {
    function nav() {
      return new Navigation(
        1008,
        1008,
        [],
        field
          ? {
              cell: 24,
              blocked: new Uint8Array(42 * 42),
              walkable: (p) => p.x >= 12 && p.y >= 12 && p.x <= 996 && p.y <= 996,
            }
          : undefined,
      );
    }
    it("affects movement, line of sight and A* without mutating canonical data; removal opens passage", () => {
      const n = nav(),
        a = { x: 300, y: 500 },
        b = { x: 600, y: 500 };
      expect(n.visible(a, b)).toBe(true);
      n.setLocalObstacles("project", [wall]);
      expect(n.walkable({ x: 468, y: 500 })).toBe(false);
      expect(n.visible(a, b)).toBe(false);
      const route = n.path(a, b);
      expect(route.length).toBeGreaterThan(2);
      for (const p of route) expect(blockedAt(p.x, p.y, [wall], 10)).toBe(false);
      expect(n.obstacles).toEqual([]);
      const step = n.step({ x: 420, y: 500 }, b, 200);
      expect(step.x).toBeLessThan(450);
      n.setLocalObstacles("project", []);
      expect(n.walkable({ x: 468, y: 500 })).toBe(true);
      expect(n.path(a, b)).toEqual([b]);
    });
    it("keeps another character's navigation separate and rejects invalid overlays atomically", () => {
      const a = nav(),
        b = nav();
      a.setLocalObstacles("project", [wall]);
      expect(b.walkable({ x: 468, y: 500 })).toBe(true);
      expect(() => a.setLocalObstacles("project", [{ ...wall, width: NaN }])).toThrow();
      expect(a.walkable({ x: 468, y: 500 })).toBe(false);
      a.setLocalObstacles("second", [{ x: 600, y: 200, width: 30, height: 100 }]);
      a.setLocalObstacles("project", []);
      expect(a.walkable({ x: 615, y: 250 })).toBe(false);
    });
  });
