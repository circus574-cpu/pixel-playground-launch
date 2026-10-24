import { describe, expect, it } from "vitest";
import { CONTINENTS } from "../components/planet-map/mapData";
import { GAME_SAVE_KEY, readActiveContinent } from "../components/planet-map/MapChrome";
import { WORLDS } from "../game/world/worlds";
import { RACES } from "../game/world/races";
import { SAVE_KEY } from "../game/session";

describe("planet atlas matches the game", () => {
  it("has exactly the four game continents with the game's names, races and settlements", () => {
    expect(CONTINENTS.map((c) => c.id).sort()).toEqual(Object.keys(WORLDS).sort());
    for (const c of CONTINENTS) {
      const world = WORLDS[c.id as keyof typeof WORLDS];
      expect(c.name).toBe(world.name);
      expect(c.settlement).toBe(world.settlement);
      expect(c.people).toBe(RACES[world.race].name);
    }
  });
  it("reads the active character's continent without writing", () => {
    expect(GAME_SAVE_KEY).toBe(SAVE_KEY);
    const data: Record<string, string> = {
      [SAVE_KEY + ":superior-world-v1:active-character"]: "abc",
      [SAVE_KEY + ":superior-world-v1:character:abc"]: JSON.stringify({
        format: "superior-character",
        feature: "pyra",
      }),
    };
    const storage = { getItem: (k: string) => data[k] ?? null };
    expect(readActiveContinent(storage)).toBe("pyra");
    expect(readActiveContinent({ getItem: () => null })).toBeNull();
    expect(readActiveContinent(null)).toBeNull();
  });
});
