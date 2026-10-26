import { describe, expect, it } from "vitest";
import {
  RECOVERY_PREFIX,
  pushChanges,
  syncAll,
  syncableKeys,
  type CloudPort,
  type CloudRow,
  type KeyStorage,
} from "../game/account/cloudSaves";
import { applyEdit, summarize } from "../game/account/gmEdit";
import { newPlayer, xpNeeded } from "../game/session";

class MemoryStorage implements KeyStorage {
  map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

/** In-memory stand-in for the characters table, with the database's revision rule. */
class MemoryCloud implements CloudPort {
  rows = new Map<string, CloudRow>();
  async list() {
    return [...this.rows.values()].map((r) => structuredClone(r));
  }
  async insert(key: string, data: unknown) {
    if (this.rows.has(key)) throw Error("duplicate key");
    const row = { save_key: key, data, revision: 1 };
    this.rows.set(key, row);
    return structuredClone(row);
  }
  async update(key: string, data: unknown, revision: number) {
    const row = this.rows.get(key);
    if (!row || row.revision !== revision) return null;
    row.data = data;
    row.revision++;
    return structuredClone(row);
  }
  /** A game master's change, as the panel writes it. */
  gmSet(key: string, data: unknown) {
    const row = this.rows.get(key)!;
    row.data = data;
    row.revision++;
  }
}

const KEY = "ki-legends:adventure:v1:superior-world-v2:character:a";
const save = (gold: number) => JSON.stringify({ format: "superior-character", player: { gold } });

describe("cloud saves", () => {
  it("uploads game saves, never interface preferences or recovery copies", async () => {
    const s = new MemoryStorage();
    s.setItem(KEY, save(5));
    s.setItem("ki_legends_save_v5", "{}");
    s.setItem("ki-legends:ui-preferences:v1", "{}");
    s.setItem("ki-legends:recovery:before-v5:x", "old");
    s.setItem("other-app", "x");
    s.setItem("ki-legends:adventure:v1:stage2-1-20261020:character:q", "{}");
    expect(syncableKeys(s)).toEqual([KEY, "ki_legends_save_v5"].sort());
    const cloud = new MemoryCloud();
    const report = await syncAll(s, "u1", cloud);
    expect(report.pushed.sort()).toEqual([KEY, "ki_legends_save_v5"].sort());
    expect(cloud.rows.get(KEY)!.data).toEqual(JSON.parse(save(5)));
  });

  it("a new device receives the account's saves", async () => {
    const cloud = new MemoryCloud();
    await cloud.insert(KEY, JSON.parse(save(9)));
    const device = new MemoryStorage();
    const report = await syncAll(device, "u1", cloud);
    expect(report.pulled).toEqual([KEY]);
    expect(JSON.parse(device.getItem(KEY)!)).toEqual(JSON.parse(save(9)));
  });

  it("local progress is pushed; a game-master edit reaches the device at the next sync", async () => {
    const s = new MemoryStorage();
    s.setItem(KEY, save(1));
    const cloud = new MemoryCloud();
    await syncAll(s, "u1", cloud);
    s.setItem(KEY, save(2));
    expect((await pushChanges(s, "u1", cloud)).pushed).toEqual([KEY]);
    expect(cloud.rows.get(KEY)!.data).toEqual(JSON.parse(save(2)));
    cloud.gmSet(KEY, JSON.parse(save(500)));
    const report = await syncAll(s, "u1", cloud);
    expect(report.pulled).toEqual([KEY]);
    expect(report.replaced).toEqual([]);
    expect(JSON.parse(s.getItem(KEY)!).player.gold).toBe(500);
  });

  it("a running game cannot overwrite a game-master edit; its own change is kept for recovery", async () => {
    const s = new MemoryStorage();
    s.setItem(KEY, save(1));
    const cloud = new MemoryCloud();
    await syncAll(s, "u1", cloud);
    cloud.gmSet(KEY, JSON.parse(save(500)));
    s.setItem(KEY, save(3));
    const push = await pushChanges(s, "u1", cloud);
    expect(push.refused).toEqual([KEY]);
    expect(cloud.rows.get(KEY)!.data).toEqual(JSON.parse(save(500)));
    const report = await syncAll(s, "u1", cloud);
    expect(report.replaced).toEqual([KEY]);
    expect(JSON.parse(s.getItem(KEY)!).player.gold).toBe(500);
    expect(s.getItem(RECOVERY_PREFIX + KEY)).toBe(save(3));
  });

  it("non-JSON values survive a round trip", async () => {
    const s = new MemoryStorage();
    s.setItem("ki-legends:adventure:v1:active-character", "slot-7");
    const cloud = new MemoryCloud();
    await syncAll(s, "u1", cloud);
    const other = new MemoryStorage();
    await syncAll(other, "u1", cloud);
    expect(other.getItem("ki-legends:adventure:v1:active-character")).toBe("slot-7");
  });
});

describe("game-master edits", () => {
  const character = () => ({
    format: "superior-character",
    player: { ...newPlayer("planetary"), level: 5, xp: 10, skills: ["R"] },
  });

  it("changes gold, level and items within the game's rules", () => {
    const r = applyEdit(character(), { gold: 999, level: 7, items: { potion: 12 } });
    expect(r.ok).toBe(true);
    const s = summarize(r.ok ? r.data : null)!;
    expect([s.gold, s.level, s.items.potion]).toEqual([999, 7, 12]);
  });

  it("refuses edits the game would reject on load", () => {
    expect(applyEdit(character(), { xp: xpNeeded(5) }).ok).toBe(false);
    expect(applyEdit(character(), { level: 0 }).ok).toBe(false);
    expect(applyEdit(character(), { gold: -1 }).ok).toBe(false);
    expect(applyEdit(character(), { items: { potion: 100 } }).ok).toBe(false);
    expect(applyEdit(character(), { items: { dragon: 1 } as never }).ok).toBe(false);
    expect(applyEdit({ quests: {} }, { gold: 1 }).ok).toBe(false);
  });

  it("does not touch the original save object", () => {
    const original = character();
    applyEdit(original, { gold: 1 });
    expect(original.player.gold).toBe(newPlayer("planetary").gold);
  });
});
