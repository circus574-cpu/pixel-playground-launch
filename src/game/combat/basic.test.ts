import { describe, expect, it } from "vitest";
import { BasicCombat, inBasicHitbox, type BasicHost } from "./basic";
import { DamageLedger } from "./damage";

describe("manual basic action", () => {
  it("resolves only during active ticks and only once per action, repeats only while held", () => {
    const action = new BasicCombat();
    const hits: string[] = [],
      starts: string[] = [];
    const host: BasicHost = {
      canStart: () => true,
      interval: () => 500,
      facing: () => ({ x: 1, y: 0 }),
      started: (id) => starts.push(id),
      hit: (id) => {
        hits.push(id);
        return true;
      },
    };
    action.enqueue({ kind: "hold", value: true });
    action.step(10, host);
    for (let i = 0; i < 9; i++) action.step(10, host);
    expect(hits).toEqual([]);
    action.step(10, host);
    expect(action.phase).toBe("active");
    expect(hits).toHaveLength(1);
    for (let i = 0; i < 100; i++) action.step(10, host);
    expect(starts.length).toBeGreaterThan(1);
    expect(new Set(hits).size).toBe(hits.length);
    action.enqueue({ kind: "hold", value: false });
    for (let i = 0; i < 100; i++) action.step(10, host);
    const completed = starts.length;
    for (let i = 0; i < 100; i++) action.step(10, host);
    expect(starts).toHaveLength(completed);
  });
  it("cancels windup and overflow cannot leave a stuck attack", () => {
    const action = new BasicCombat();
    let hits = 0;
    const host: BasicHost = {
      canStart: () => true,
      interval: () => 500,
      facing: () => ({ x: 1, y: 0 }),
      started: () => {},
      hit: () => {
        hits++;
        return true;
      },
    };
    action.enqueue({ kind: "press" });
    action.step(10, host);
    action.enqueue({ kind: "cancel" });
    for (let i = 0; i < 100; i++) action.step(10, host);
    expect(hits).toBe(0);
    for (let i = 0; i < 65; i++) action.enqueue({ kind: "hold", value: true });
    for (let i = 0; i < 100; i++) action.step(10, host);
    expect(hits).toBe(0);
  });
  it("cone rejects behind and distant targets", () => {
    const origin = { x: 0, y: 0 },
      facing = { x: 1, y: 0 };
    expect(inBasicHitbox(origin, { x: 70, y: 0 }, facing, 78)).toBe(true);
    expect(inBasicHitbox(origin, { x: -10, y: 0 }, facing, 78)).toBe(false);
    expect(inBasicHitbox(origin, { x: 79, y: 0 }, facing, 78)).toBe(false);
    expect(inBasicHitbox(origin, { x: 1, y: 50 }, facing, 78)).toBe(false);
  });
  it("deduplicates reentrant damage by action, source and target", () => {
    const ledger = new DamageLedger();
    let hp = 100;
    const apply = () => {
      hp -= 10;
      ledger.resolve("a", "p", "e", () => {
        hp -= 10;
        return 10;
      });
      return 10;
    };
    expect(ledger.resolve("a", "p", "e", apply)).toBe(10);
    expect(ledger.resolve("a", "p", "e", apply)).toBe(0);
    expect(hp).toBe(90);
    ledger.resolve("b", "p", "e", () => {
      hp -= 10;
      return 10;
    });
    expect(hp).toBe(80);
    ledger.retire("a", "p");
    ledger.retire("b", "p");
  });
});
