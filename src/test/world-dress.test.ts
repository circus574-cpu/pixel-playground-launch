import { describe, expect, it, vi } from "vitest";

declare global {
  var __dressPrefixes: string[] | undefined;
}

// Katalog udostępnia tylko wiązania z listy w `__dressPrefixes`; reszta nie istnieje, więc
// generator nie może poprosić o grafikę, której brak (to twardy błąd „Brak grafiki świata").
// Cała logika musi być w fabryce: `vi.mock` jest podnoszony nad importy modułu testowego.
vi.mock("../game/assets/catalog", () => {
  const prefixes = () => globalThis.__dressPrefixes ?? [];
  const renderBindings = new Proxy({} as Record<string, unknown>, {
    get: (_t, key) =>
      typeof key === "string" &&
      key.startsWith("object.") &&
      prefixes().some((p) => key.startsWith(p))
        ? { asset: "a" }
        : undefined,
  });
  return { catalog: { renderBindings }, textureId: (b: string) => b };
});
import {
  continentAir,
  continentDress,
  townDress,
  TOWN_CAP,
  TOWN_INNER,
  TOWN_OUTER,
  WILD_CAP,
} from "../game/world/generated/worldDress";

const trueAll = () => true;
const biome0 = () => 0;
const SIDE = 2048;
const pełny = [
  "object.verdantia-continent.",
  "object.verdantia-extra.",
  "object.pyra-continent.",
  "object.aetheria-continent.",
  "object.nexus-continent.",
  "object.island-",
];
globalThis.__dressPrefixes = pełny;

describe("generator dekoracji dziczy", () => {
  it("odrzuca motywy z pakietu, którego nie ma w katalogu", () => {
    globalThis.__dressPrefixes = ["object.verdantia-continent."];
    const items = continentDress("verdant", 0, 0, [], trueAll, trueAll, biome0);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items)
      expect(item.binding.startsWith("object.verdantia-continent.")).toBe(true);
    globalThis.__dressPrefixes = pełny;
  });
  it("wypełnia chunk i nigdy nie przekracza limitu", () => {
    for (const land of ["verdant", "pyra", "aether", "nexus"]) {
      const items = continentDress(land, 0, 0, [], trueAll, trueAll, biome0);
      expect(items.length, land).toBeGreaterThan(0);
      expect(items.length, land).toBeLessThanOrEqual(WILD_CAP);
    }
  });
  it("jest wyłącznie prezentacją: bez kolizji i bez footprintu", () => {
    const items = continentDress("verdant", 0, 0, [], trueAll, trueAll, biome0);
    for (const item of items) {
      expect(item.solid).toBe(false);
      expect(item.footprint).toBeUndefined();
      expect(item.layer).toBe("objects");
      expect(item.x).toBeGreaterThanOrEqual(0);
      expect(item.x).toBeLessThan(SIDE);
      expect(item.y).toBeGreaterThanOrEqual(0);
      expect(item.y).toBeLessThan(SIDE);
    }
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
  it("jest deterministyczny: ten sam chunk daje ten sam kadr", () => {
    const a = continentDress("pyra", SIDE, -SIDE, [], trueAll, trueAll, biome0);
    const b = continentDress("pyra", SIDE, -SIDE, [], trueAll, trueAll, biome0);
    expect(a).toEqual(b);
  });
  it("nie stawia dekoracji w wodzie, w mieście ani na drodze", () => {
    expect(continentDress("aether", 0, 0, [], () => false, trueAll, biome0)).toEqual([]);
    expect(continentDress("aether", 0, 0, [], trueAll, () => false, biome0)).toEqual([]);
    const road = {
      points: [[0, 1024] as [number, number], [SIDE, 1024] as [number, number]],
      width: 120,
      kind: "road",
    };
    const items = continentDress("nexus", 0, 0, [road], trueAll, trueAll, biome0);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(Math.abs(item.y - 1024)).toBeGreaterThan(120 / 2 + 58);
  });
  it("dodaje powietrze tylko tam, gdzie pakiet ma efekt", () => {
    expect(continentAir("aether", 0, 0, trueAll, trueAll)).toEqual([]);
    expect(continentAir("verdant", 0, 0, trueAll, trueAll)).toEqual([]);
    const motes = continentAir("pyra", 0, 0, trueAll, trueAll);
    expect(motes.length).toBeGreaterThan(0);
    for (const mote of motes) {
      expect(mote.kind).toBe("ambient-effect");
      expect(mote.layer).toBe("overhead");
      expect(mote.solid).toBe(false);
      expect(mote.binding.startsWith("object.pyra-continent.fx-")).toBe(true);
    }
  });
});

describe("oprawa osad wysp", () => {
  const settlement = { x: 7952, y: 5200, bounds: { x: 6416, y: 3920, width: 3072, height: 2560 } };
  it("otacza plac pierścieniem dekoracji, nie zasłaniając go", () => {
    const items = townDress("island-2", [settlement], [], []);
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(TOWN_CAP);
    for (const item of items) {
      const d = Math.hypot(item.x - settlement.x, item.y - settlement.y);
      expect(d).toBeGreaterThanOrEqual(TOWN_INNER);
      expect(d).toBeLessThanOrEqual(TOWN_OUTER);
      expect(item.binding.startsWith("object.island-2.")).toBe(true);
      expect(item.solid).toBe(false);
      expect(item.footprint).toBeUndefined();
    }
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
  it("omija budynki i nie wchodzi w ich obrys", () => {
    const hall = { x: 7952, y: 4336, width: 492, height: 455 };
    const items = townDress("island-2", [settlement], [hall], []);
    for (const item of items) {
      const inside =
        Math.abs(item.x - hall.x) < hall.width / 2 + 40 &&
        Math.abs(item.y - hall.y) < hall.height / 2 + 40;
      expect(inside).toBe(false);
    }
  });
  it("nie zna motywów dla lądu, który ich nie ma", () => {
    expect(townDress("verdant", [settlement], [], [])).toEqual([]);
  });
});
