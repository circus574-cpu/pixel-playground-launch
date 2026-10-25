import { describe, expect, it } from "vitest";
import { CONTINENTS_WORLD_V2 } from "..";
import { v2Places } from "../v2Places";
import index from "../../../../public/game/worlds/superior-v2/index.json";

describe("Argon places on world v2", () => {
  for (const [id, continent] of Object.entries(CONTINENTS_WORLD_V2)) {
    it(id + ": every city has its own v2 town and every famous place lies on the land", () => {
      const places = v2Places(id)!;
      const towns = continent.cities.map((c) => places.cities[c.id]?.settlement);
      expect(towns.every(Boolean)).toBe(true);
      expect(new Set(towns).size).toBe(continent.cities.length);
      expect(
        places.cities[continent.cities.find((c) => c.role === "capital")!.id]?.settlement,
      ).toBe(id + "-capital");
      const feature = index.features.find((f) => f.id === id)!;
      expect(places.famous).toHaveLength(continent.famousLocations.length);
      for (const f of places.famous) {
        expect(f.x).toBeGreaterThan(0);
        expect(f.y).toBeGreaterThan(0);
        expect(f.x).toBeLessThan(feature.width);
        expect(f.y).toBeLessThan(feature.height);
      }
    });
  }
});
