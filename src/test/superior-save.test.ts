import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { newPlayer, type StoragePort } from "../game/session";
import { SuperiorSaveStore, type SuperiorIndex } from "../game/world/generated/superiorSave";
const index = JSON.parse(
  readFileSync("public/game/worlds/superior-v1/index.json", "utf8"),
) as SuperiorIndex;
const storage = () => {
  const values = new Map<string, string>();
  const port: StoragePort = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v);
    },
  };
  return { values, port };
};
describe("Superior expedition ownership and travel", () => {
  it("saves full-size planet coordinates and leaves the existing character untouched", () => {
    const { port, values } = storage();
    values.set("accepted-character", "unchanged original bytes");
    const store = new SuperiorSaveStore(port, "expedition", index, "verdant");
    expect(store.load()).toBeUndefined();
    const p = { ...newPlayer(), x: 32000, y: 21000, gold: 73 };
    expect(store.save(p)).toBe(true);
    const loaded = new SuperiorSaveStore(port, "expedition", index, "verdant").load();
    expect(loaded).toMatchObject({ x: 32000, y: 21000, gold: 73 });
    expect(values.get("accepted-character")).toBe("unchanged original bytes");
  });
  it("keeps the original race and inventory across islands, blocking outgoing scene cleanup", () => {
    const { port, values } = storage();
    const store = new SuperiorSaveStore(port, "expedition", index, "verdant");
    store.load();
    const p = { ...newPlayer(), x: 32000, y: 21000, gold: 73 };
    expect(store.save(p)).toBe(true);
    const island = index.features.find((f) => f.id === "island-1")!;
    expect(store.travel(p, island)).toBe(true);
    const afterTravel = values.get("expedition");
    expect(store.save(p)).toBe(false);
    expect(values.get("expedition")).toBe(afterTravel);
    const next = new SuperiorSaveStore(port, "expedition", index, "verdant"),
      loaded = next.load()!;
    expect(next.feature).toBe("island-1");
    expect(loaded).toMatchObject({
      race: "planetary",
      startContinent: "verdant",
      continent: island.affinity,
      x: island.arrival.x,
      y: island.arrival.y,
      gold: 73,
      items: p.items,
    });
  });
  it.each(["newer", "geometry", "inventory"])(
    "preserves %s data instead of replacing it",
    (kind) => {
      const { port, values } = storage();
      const store = new SuperiorSaveStore(port, "expedition", index, "verdant");
      store.load();
      expect(store.save(newPlayer())).toBe(true);
      const raw = JSON.parse(values.get("expedition")!);
      if (kind === "newer") raw.version = 2;
      else if (kind === "geometry") raw.geometry = "unrecognized world revision";
      else {
        raw.player.depot.upgrade = 1;
        raw.player.depot.items.sword = 0;
      }
      const original = JSON.stringify(raw);
      values.set("expedition", original);
      const restored = new SuperiorSaveStore(port, "expedition", index, "verdant");
      expect(restored.load()).toBeUndefined();
      expect(restored.warning).not.toBe("");
      expect(restored.save(newPlayer())).toBe(false);
      expect(values.get("expedition")).toBe(original);
    },
  );
  it("keeps one initial snapshot when another tab writes during asynchronous world preparation", () => {
    const { port, values } = storage();
    const seed = new SuperiorSaveStore(port, "expedition", index, "verdant");
    seed.load();
    expect(seed.save({ ...newPlayer(), gold: 11 })).toBe(true);
    const reader = new SuperiorSaveStore(port, "expedition", index, "verdant");
    const snapshot = reader.load()!;
    const writer = new SuperiorSaveStore(port, "expedition", index, "verdant");
    writer.load();
    expect(writer.save({ ...snapshot, gold: 22 })).toBe(true);
    const original = values.get("expedition");
    expect(reader.load()!.gold).toBe(11);
    expect(reader.save(snapshot)).toBe(false);
    expect(values.get("expedition")).toBe(original);
  });
  it("rejects writes from a stale tab", () => {
    const { port, values } = storage();
    const a = new SuperiorSaveStore(port, "expedition", index, "verdant"),
      b = new SuperiorSaveStore(port, "expedition", index, "verdant");
    a.load();
    b.load();
    expect(a.save(newPlayer())).toBe(true);
    const original = values.get("expedition");
    expect(b.save({ ...newPlayer(), gold: 9999 })).toBe(false);
    expect(values.get("expedition")).toBe(original);
  });
});

it("migrates a v1 expedition with exact recovery bytes and trained parameters", () => {
  const { port, values } = storage();
  const initial = new SuperiorSaveStore(port, "expedition", index, "verdant");
  initial.load();
  expect(initial.save(newPlayer())).toBe(true);
  const legacy = JSON.parse(values.get("expedition")!);
  legacy.version = 1;
  const raw = JSON.stringify(legacy);
  values.set("expedition", raw);
  const next = new SuperiorSaveStore(port, "expedition", index, "verdant");
  const p = next.load()!;
  p.combatTraining = {
    dodge: { rank: 3, progress: 2 },
    attackSpeed: { rank: 4, progress: 1 },
    technique: { rank: 6, progress: 0 },
  };
  expect(next.save(p)).toBe(true);
  expect(values.get("expedition:before-stat-training-v4")).toBe(raw);
  expect(
    new SuperiorSaveStore(port, "expedition", index, "verdant").load()?.combatTraining,
  ).toEqual(p.combatTraining);
});
