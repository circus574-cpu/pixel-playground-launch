import { describe, expect, it } from "vitest";
import { buildSceneryGrid, sceneryNear, sceneryReach } from "../game/world/sceneryStream";

function world(n: number, width = 49000, height = 31400) {
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  return Array.from({ length: n }, () => ({
    x: Math.floor(rnd() * width),
    y: Math.floor(rnd() * height),
    width: 120 + Math.floor(rnd() * 380),
    height: 100 + Math.floor(rnd() * 400),
    anchorX: 0.5,
    anchorY: 0.92,
  }));
}

describe("scenery streaming", () => {
  const objects = world(30000);
  const grid = buildSceneryGrid(objects);
  const reach = sceneryReach(objects);
  it("keeps only a small neighbourhood alive on a 30 000 object continent", () => {
    const view = { left: 20000, right: 21400, top: 10000, bottom: 11000 };
    const near = sceneryNear(grid, view, reach + 128);
    expect(near.length).toBeGreaterThan(0);
    expect(near.length).toBeLessThan(objects.length * 0.03);
  });
  it("never drops an object that can be visible", () => {
    const view = { left: 30500, right: 31900, top: 15000, bottom: 16000 };
    const near = new Set(sceneryNear(grid, view, reach + 128));
    objects.forEach((o, i) => {
      const left = o.x - o.width * o.anchorX,
        top = o.y - o.height * o.anchorY;
      const visible =
        left < view.right &&
        left + o.width > view.left &&
        top < view.bottom &&
        top + o.height > view.top;
      if (visible) expect(near.has(i), "object " + i).toBe(true);
    });
  });
  it("builds the grid of a 300 000 object world quickly", () => {
    const big = world(300000);
    const t = performance.now();
    buildSceneryGrid(big);
    expect(performance.now() - t).toBeLessThan(1500);
  });
});
