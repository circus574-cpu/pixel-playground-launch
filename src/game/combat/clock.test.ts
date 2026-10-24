import { describe, expect, it } from "vitest";
import { CombatClock } from "./clock";
describe("combat fixed clock", () => {
  for (const fps of [10, 15, 30, 60, 120])
    it(`${fps} FPS has the same simulation time`, () => {
      const clock = new CombatClock();
      let time = 0;
      for (let f = 0; f < fps * 10; f++) clock.advance(1000 / fps, (dt) => (time += dt));
      expect(clock.ticks).toBe(600);
      expect(time).toBeCloseTo(10000);
      expect(clock.droppedMs).toBe(0);
    });
  for (const gap of [250, 1000])
    it(`bounds ${gap} ms catch-up`, () => {
      const clock = new CombatClock();
      clock.advance(gap, () => {});
      expect(clock.ticks).toBe(8);
      expect(clock.droppedMs).toBeCloseTo(gap - 8 * clock.stepMs);
      clock.advance(clock.stepMs, () => {});
      expect(clock.ticks).toBe(9);
    });
  it("discards backlog under sustained overload and resets fractional time", () => {
    const clock = new CombatClock();
    for (let i = 0; i < 100; i++) clock.advance(1000, () => {});
    expect(clock.ticks).toBe(800);
    clock.advance(8, () => {});
    clock.reset();
    clock.advance(9, () => {});
    expect(clock.ticks).toBe(800);
    for (const bad of [NaN, Infinity, -1]) clock.advance(bad, () => {});
    expect(clock.ticks).toBe(800);
  });
});
