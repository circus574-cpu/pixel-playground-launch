import { Navigation } from "../game/navigation";
import { describe, expect, it } from "vitest";
import { applyEdit, summarize } from "../game/account/gmEdit";
import { GameSession, SaveStore, newPlayer, stats } from "../game/session";
import { CharacterStatsSchema, applyCharacterStats } from "../game/characterStats";
import { atlasToWorld, worldToAtlas } from "../components/planet-map/worldToAtlas";
import overlay from "../components/planet-map/worldOverlay.v2.json";
import { readFileSync } from "node:fs";
import { SuperiorSaveStore, type SuperiorIndex } from "../game/world/generated/superiorSave";

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
};
describe("Coder character parameters", () => {
  it.each(["planetary", "sage", "android", "legend"] as const)(
    "edits and restores real kit parameters for %s",
    (race) => {
      const original = newPlayer(race);
      const canonical = stats(original);
      const edited = applyEdit(
        { player: original },
        {
          statOverrides: {
            speed: 700,
            attack: 42,
            maxHp: 999,
            maxKi: 900,
            defense: 50,
            crit: 25,
            kiRegen: 10,
            attackInterval: 500,
            range: 220,
          },
        },
      );
      expect(edited.ok).toBe(true);
      const summary = summarize(edited.ok ? edited.data : null)!;
      expect(summary.statOverrides.speed).toBe(700);
      expect(original.statOverrides).toBeUndefined();
      const storage = memory();
      const store = new SaveStore(storage, "stats-test");
      store.load();
      const p = { ...original, statOverrides: summary.statOverrides };
      store.save(p);
      const g = new GameSession(new SaveStore(storage, "stats-test"), race);
      expect(g.kit.stats).toMatchObject(summary.statOverrides);
      expect(g.snapshot().stats.speed).toBe(700);
      expect(stats(g.player).maxHp).toBe(999);
      const reset = applyEdit(edited.ok ? edited.data : null, { statOverrides: {} });
      const resetPlayer = (reset.ok ? (reset.data as { player: typeof p }) : { player: p }).player;
      expect(stats(resetPlayer)).toEqual(canonical);
    },
  );
  it.each([NaN, Infinity, -1, 2001])(
    "rejects invalid speed %s without changing the save",
    (speed) => {
      const data = { player: newPlayer() };
      expect(applyEdit(data, { statOverrides: { speed } }).ok).toBe(false);
      expect(data.player.statOverrides).toBeUndefined();
    },
  );
  it("refuses unknown knobs and ignores undefined override entries", () => {
    expect(CharacterStatsSchema.safeParse({ god: true }).success).toBe(false);
    const base = {
      maxHp: 100,
      maxKi: 50,
      attack: 10,
      defense: 1,
      speed: 220,
      kiRegen: 1,
      crit: 0,
      attackInterval: 600,
      range: 80,
    };
    expect(applyCharacterStats({ ...base }, { speed: undefined }).speed).toBe(220);
  });
});
it("uses edited speed in actual movement while retaining obstacle checks", () => {
  const run = (speed: number) => {
    const g = new GameSession(new SaveStore(null));
    g.player.statOverrides = { speed };
    // Deterministic open navigation fixture; movement itself is the production session.
    g.nav = new Navigation(4000, 3000, [{ x: 1300, y: 0, width: 40, height: 3000 }]);
    g.player.x = 1000;
    g.player.y = 1500;
    g.command({ type: "move", x: 1200, y: 1500 });
    g.tick(100);
    return g;
  };
  const slow = run(100),
    fast = run(700);
  expect(fast.player.x - 1000).toBeGreaterThan(slow.player.x - 1000);
  fast.command({ type: "move", x: 1800, y: 1500 });
  for (let i = 0; i < 30; i++) fast.tick(100);
  expect(fast.player.x).toBeLessThan(1300);
});

describe("2D atlas teleport projection", () => {
  it("inverts actual cells of every land without changing world geometry", () => {
    const lands = new Set<string>();
    for (const tile of overlay.tiles) {
      if (lands.has(tile.land)) continue;
      const x =
        (tile.crop[0]! + tile.crop[2]! / 2) *
        overlay.lands[tile.land as keyof typeof overlay.lands].upp;
      const y =
        (tile.crop[1]! + tile.crop[3]! / 2) *
        overlay.lands[tile.land as keyof typeof overlay.lands].upp;
      const at = worldToAtlas(overlay, tile.land, x, y)!;
      const point = atlasToWorld(overlay, at, tile.land)!;
      expect(point.land).toBe(tile.land);
      expect(point.x).toBeCloseTo(x, 3);
      expect(point.y).toBeCloseTo(y, 3);
      lands.add(tile.land);
    }
    expect(lands.size).toBe(10);
  });
  it("rejects ocean, invalid inputs and a different land", () => {
    expect(atlasToWorld(overlay, { x: -100, y: -100 })).toBeNull();
    expect(atlasToWorld(overlay, { x: NaN, y: 20 })).toBeNull();
    expect(atlasToWorld(overlay, { x: 100, y: 200 }, "not-a-land")).toBeNull();
  });
  it("persists selected coordinates across a cross-land travel and blocks outgoing cleanup", () => {
    const index = JSON.parse(
      readFileSync("public/game/worlds/superior-v1/index.json", "utf8"),
    ) as SuperiorIndex;
    const storage = memory();
    const save = new SuperiorSaveStore(storage, "teleport-save", index, "verdant");
    save.load();
    const p = newPlayer();
    save.save(p);
    const next = index.features.find((f) => f.id === "aether")!;
    const point = { x: next.arrival.x + 24, y: next.arrival.y + 24 };
    expect(save.travel(p, next, point)).toBe(true);
    expect(save.save(p)).toBe(false);
    const reloaded = new SuperiorSaveStore(storage, "teleport-save", index, "verdant");
    expect(reloaded.load()).toMatchObject(point);
    expect(reloaded.feature).toBe("aether");
  });
  it("ignores unauthorized and non-finite teleports", () => {
    const g = new GameSession(new SaveStore(null));
    const before = { x: g.player.x, y: g.player.y };
    g.command({ type: "staff", action: "teleport", x: 1000, y: 1000 });
    expect(g.player).toMatchObject(before);
    g.staff = "gm";
    g.command({ type: "staff", action: "teleport", x: NaN, y: 1000 });
    expect(g.player).toMatchObject(before);
  });
});
