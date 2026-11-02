import { expect, it } from "vitest";
import { boundTownNpc } from "../game/world/generated/simulationWorld";
import { v2Places } from "../game/worlds/v2Places";
import { ALL_CITIES_V2 } from "../game/worlds";

it("every quest NPC of a smaller v2 town is the named NPC of its bound role", () => {
  let checked = 0;
  for (const city of ALL_CITIES_V2) {
    const continent = city.npcs[0]?.bindingId.split(".")[0];
    if (!continent) continue;
    const places = v2Places(continent);
    const settlement = places?.cities[city.id]?.settlement;
    if (!settlement || settlement.endsWith("-capital")) continue;
    for (const npc of city.npcs) {
      const role = npc.bindingId.split(".").at(-1)!;
      const bound = boundTownNpc(continent, settlement, places, role);
      expect(bound?.id).toBe(npc.id);
      expect(bound?.name).toBe(npc.name);
      checked++;
    }
  }
  expect(checked).toBe(12);
});

it("roles without a bound quest NPC keep the generic town name", () => {
  const places = v2Places("verdant");
  expect(boundTownNpc("verdant", "verdant-town-3", places, "smith")).toBeUndefined();
  expect(boundTownNpc("verdant", "verdant-town-3", places, "merchant")?.name).toMatch(/^Nela/);
});
