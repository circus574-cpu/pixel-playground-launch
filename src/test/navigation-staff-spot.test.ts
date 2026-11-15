import { describe, expect, it } from "vitest";
import { Navigation } from "../game/navigation";

/** A 1600 x 1600 land: a rock at 700..900 and a lake on the west edge; the field mimics a generated land. */
function land() {
  const size = 1600,
    cell = 16;
  const rock = (p: { x: number; y: number }) => p.x > 700 && p.x < 900 && p.y > 700 && p.y < 900;
  const water = (p: { x: number; y: number }) => p.x < 300;
  return new Navigation(size, size, [], {
    cell,
    blocked: new Uint8Array((size / cell) ** 2),
    walkable: (p) => !rock(p) && !water(p),
    water,
  });
}

describe("staff teleport spot", () => {
  it("keeps a free point as it is", () => {
    expect(land().staffSpot({ x: 1000, y: 1000 })).toEqual({ x: 1000, y: 1000 });
  });
  it("moves a point on an obstacle to the nearest place a character can stand", () => {
    const nav = land();
    const spot = nav.staffSpot({ x: 800, y: 800 })!;
    expect(nav.walkable(spot)).toBe(true);
    expect(Math.hypot(spot.x - 800, spot.y - 800)).toBeLessThan(200);
  });
  it("refuses water and points off the map, nothing else", () => {
    const nav = land();
    expect(nav.staffSpot({ x: 100, y: 800 })).toBeNull();
    expect(nav.staffSpot({ x: -5, y: 800 })).toBeNull();
    expect(nav.staffSpot({ x: 800, y: 99_999 })).toBeNull();
    expect(nav.staffSpot({ x: NaN, y: 800 })).toBeNull();
  });
  it("treats a land without terrain data as dry", () => {
    const nav = new Navigation(1600, 1600, []);
    expect(nav.isWater({ x: 100, y: 100 })).toBe(false);
    expect(nav.staffSpot({ x: 800, y: 800 })).toEqual({ x: 800, y: 800 });
  });
});
