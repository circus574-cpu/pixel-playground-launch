import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { newPlayer, SaveStore, SAVE_KEY, type StoragePort } from "../game/session";
import { emptyDevelopment } from "../game/development/state";
import { emptyCombatTraining } from "../game/combatTraining";
import { SuperiorSaveStore, type SuperiorIndex } from "../game/world/generated/superiorSave";
const memory = () => {
  const values = new Map<string, string>();
  const port: StoragePort = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v);
    },
  };
  return { values, port };
};
describe("pending-branch save integration", () => {
  for (const version of [5, 6, 7, 8])
    it(`classic v${version} keeps development, training and GM across two writes`, () => {
      const { values, port } = memory(),
        p = newPlayer();
      p.statOverrides = { attack: 99 };
      if (version === 6 || version === 7) p.development = emptyDevelopment();
      if (version === 8) p.combatTraining = emptyCombatTraining();
      const original = JSON.stringify({ version, revision: "integration-legacy", player: p });
      values.set(SAVE_KEY, original);
      const store = new SaveStore(port),
        loaded = store.load()!;
      expect(loaded).toBeDefined();
      loaded.development ??= emptyDevelopment();
      loaded.combatTraining ??= emptyCombatTraining();
      loaded.combatTraining.technique.rank = 5;
      expect(store.save(loaded)).toBe(true);
      expect(store.save(loaded)).toBe(true);
      const restored = new SaveStore(port).load()!;
      expect(restored.development).toEqual(loaded.development);
      expect(restored.combatTraining).toEqual(loaded.combatTraining);
      expect(restored.statOverrides?.attack).toBe(99);
      expect(JSON.parse(values.get(SAVE_KEY)!).version).toBe(9);
      expect([...values.values()]).toContain(original);
      const without = structuredClone(restored);
      delete without.development;
      expect(store.save(without)).toBe(false);
    });
  for (const version of [1, 2, 3, 4])
    it(`Superior v${version} migrates both progression systems without loss`, () => {
      const { values, port } = memory();
      const index = JSON.parse(
        readFileSync("public/game/worlds/superior-v1/index.json", "utf8"),
      ) as SuperiorIndex;
      const first = new SuperiorSaveStore(port, "expedition", index, "verdant");
      first.load();
      const p = newPlayer();
      if (version === 2 || version === 3) p.development = emptyDevelopment();
      expect(first.save(p)).toBe(true);
      const legacy = JSON.parse(values.get("expedition")!);
      legacy.version = version;
      values.set("expedition", JSON.stringify(legacy));
      const store = new SuperiorSaveStore(port, "expedition", index, "verdant"),
        loaded = store.load()!;
      expect(loaded).toBeDefined();
      loaded.development ??= emptyDevelopment();
      loaded.combatTraining = emptyCombatTraining();
      loaded.combatTraining.dodge.rank = 8;
      expect(store.save(loaded)).toBe(true);
      const next = new SuperiorSaveStore(port, "expedition", index, "verdant"),
        restored = next.load()!;
      expect(next.save(restored)).toBe(true);
      expect(restored.combatTraining?.dodge.rank).toBe(8);
      expect(restored.development).toEqual(loaded.development);
      expect(JSON.parse(values.get("expedition")!).version).toBe(5);
    });
});
