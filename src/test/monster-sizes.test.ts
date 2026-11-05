import { describe, expect, it } from "vitest";
import { MONSTER_BASE } from "../game/monsters/base.generated";
import { BODY_EXTENT } from "../game/monsters/bodyExtent.generated";
import {
  CLASS_BODY_PX,
  VISUAL_SCALE,
  monsterFramePx,
  monsterSizesEnabled,
  type SizeClass,
} from "../game/monsters/visualSize";

/** Body size on screen (px): drawn frame x measured body extent. */
const body = (id: string, cls: SizeClass) => monsterFramePx(id, cls)! * BODY_EXTENT[id]!;
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

describe("monster sizes (world v2)", () => {
  it("every bestiary creature has a measured body and a factor", () => {
    for (const m of MONSTER_BASE) {
      expect(BODY_EXTENT[m.id], m.id).toBeGreaterThan(0.3);
      expect(VISUAL_SCALE[m.id], m.id).toBeDefined();
    }
  });

  it("factors stay in 0.75-1.2 so bosses (about 145 px of body) remain the biggest", () => {
    for (const [id, f] of Object.entries(VISUAL_SCALE)) {
      expect(f, id).toBeGreaterThanOrEqual(0.75);
      expect(f, id).toBeLessThanOrEqual(1.2);
    }
    for (const m of MONSTER_BASE) expect(body(m.id, m.size as SizeClass), m.id).toBeLessThan(145);
  });

  it("classes differ clearly on screen: S < M < L", () => {
    const avg = (c: SizeClass) =>
      mean(MONSTER_BASE.filter((m) => m.size === c).map((m) => body(m.id, c)));
    expect(avg("M") / avg("S")).toBeGreaterThan(1.4);
    expect(avg("L") / avg("M")).toBeGreaterThan(1.3);
    expect(avg("S")).toBeCloseTo(CLASS_BODY_PX.S, -1);
  });

  it("creatures within one class are not all the same size", () => {
    const sizes = MONSTER_BASE.filter((m) => m.size === "M").map((m) =>
      Math.round(body(m.id, "M")),
    );
    expect(new Set(sizes).size).toBeGreaterThanOrEqual(10);
    expect(Math.max(...sizes) / Math.min(...sizes)).toBeGreaterThan(1.3);
  });

  it("is on by default and off only with ?ki-monster-sizes=0", () => {
    expect(monsterSizesEnabled("")).toBe(true);
    expect(monsterSizesEnabled("?ki-monster-sizes=0")).toBe(false);
  });

  it("a creature without a measured body keeps the old size", () => {
    expect(monsterFramePx("nie-ma-takiego", "M")).toBeUndefined();
  });
});
