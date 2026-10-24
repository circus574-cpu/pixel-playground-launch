import { describe, it, expect, beforeEach } from "vitest";
import { SuperiorCharacterStore, superiorIndex } from "../game/world/generated/superiorCharacters";
import { SuperiorSaveStore } from "../game/world/generated/superiorSave";
import { RACES, RACE_IDS } from "../game/world/races";

describe("single Superior character slot and authorized reset", () => {
  beforeEach(() => localStorage.clear());
  it.each(RACE_IDS)("starts %s on its generated continent and resumes the same save", (race) => {
    const chars = new SuperiorCharacterStore(localStorage, "test");
    const slot = chars.create(race, "Tester")!;
    expect(slot).toBeDefined();
    const land = superiorIndex.features.find((f) => f.id === RACES[race].world)!;
    expect(slot.player).toMatchObject({ ...land.arrival, race, name: "Tester", level: 1 });
    chars.select(slot);
    const save = new SuperiorSaveStore(localStorage, slot.key, superiorIndex, land.id);
    const player = save.load()!;
    player.gold = 99;
    expect(save.save(player)).toBe(true);
    expect(chars.active()!.player!.gold).toBe(99);
    expect(chars.list()).toHaveLength(1);
    expect(localStorage.length).toBe(2); // one slot and active ID; no expedition copy
    expect(chars.remove(chars.active()!)).toBe(true);
    expect(chars.list()).toEqual([]);
  });
  it("does not import old maps or expedition slots after reset", () => {
    localStorage.setItem("test:character:old", "old bytes");
    localStorage.setItem("test:character:old:superior-v1", "old expedition bytes");
    localStorage.setItem("test:active-character", "old");
    const chars = new SuperiorCharacterStore(localStorage, "test");
    expect(chars.list()).toEqual([]);
    expect(chars.active()).toBeUndefined();
    expect(localStorage.getItem("test:character:old")).toBe("old bytes");
  });
});
