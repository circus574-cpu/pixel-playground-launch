import { afterEach, describe, expect, it } from "vitest";
import { BOSS_CATALOG } from "../game/bosses/catalog";
import { RACE_BASE } from "../game/kit";
import { MONSTER_BASE } from "../game/monsters/base.generated";
import { monsterDef } from "../game/monsters/catalog";
import { ITEMS } from "../game/session";
import {
  applyCustomSpawnsForFeature,
  countActiveOverrides,
  emptyAdminWorldOverrides,
  resetAdminWorldOverrides,
  writeAdminWorldOverrides,
} from "../game/world/adminWorldStore";
import { WORLDS } from "../game/world/worlds";
import { ALL_CITIES_V2 } from "../game/worlds";

afterEach(() => {
  resetAdminWorldOverrides(null);
});

describe("AdminWorldStore overrides & reset", () => {
  it("applies overrides to continents, cities, monsters, bosses, races and items, then cleanly resets to canon", () => {
    const origWorldName = WORLDS.verdant.name;
    const origMonsterHp = MONSTER_BASE[0]!.hp;
    const origBossHp = BOSS_CATALOG[0]!.stats.hp;
    const origRaceHp = RACE_BASE.planetary.base.hp;
    const origSwordAtk = ITEMS.sword.attack;
    const origCitySafe = ALL_CITIES_V2[0]!.isSafeZone;

    const draft = emptyAdminWorldOverrides();
    draft.continents.verdant = { name: "Nowa Verdantia" };
    draft.citiesV2[ALL_CITIES_V2[0]!.id] = { isSafeZone: false };
    draft.monsters[MONSTER_BASE[0]!.id] = { hp: 9999 };
    draft.bosses[BOSS_CATALOG[0]!.id] = { hp: 77777 };
    draft.races.planetary = { base: { hp: 500 } };
    draft.runtimeItems.sword = { attack: 55 };

    writeAdminWorldOverrides(draft, null);

    expect(countActiveOverrides(draft)).toBe(6);
    expect(WORLDS.verdant.name).toBe("Nowa Verdantia");
    expect(ALL_CITIES_V2[0]!.isSafeZone).toBe(false);
    expect(MONSTER_BASE[0]!.hp).toBe(9999);
    expect(monsterDef(MONSTER_BASE[0]!.id).hp).toBe(9999);
    expect(BOSS_CATALOG[0]!.stats.hp).toBe(77777);
    expect(RACE_BASE.planetary.base.hp).toBe(500);
    expect(ITEMS.sword.attack).toBe(55);

    resetAdminWorldOverrides(null);

    expect(WORLDS.verdant.name).toBe(origWorldName);
    expect(ALL_CITIES_V2[0]!.isSafeZone).toBe(origCitySafe);
    expect(MONSTER_BASE[0]!.hp).toBe(origMonsterHp);
    expect(monsterDef(MONSTER_BASE[0]!.id).hp).toBe(origMonsterHp);
    expect(BOSS_CATALOG[0]!.stats.hp).toBe(origBossHp);
    expect(RACE_BASE.planetary.base.hp).toBe(origRaceHp);
    expect(ITEMS.sword.attack).toBe(origSwordAtk);
  });

  it("merges custom admin spawns and deletions per feature", () => {
    const baseSpawns = [
      {
        id: "verdant-1",
        kind: "verdant-mchowy-szlamak",
        x: 1000,
        y: 1000,
        homeLeash: 300,
        respawnMs: 25000,
      },
    ];
    const draft = emptyAdminWorldOverrides();
    draft.customSpawns["verdant-admin-1"] = {
      id: "verdant-admin-1",
      feature: "verdant",
      kind: "verdant-cierniowy-wilk",
      x: 2500,
      y: 2600,
      homeLeash: 450,
      respawnMs: 15000,
    };
    const merged = applyCustomSpawnsForFeature("verdant", baseSpawns, draft);
    expect(merged).toHaveLength(2);
    expect(merged.some((s) => s.id === "verdant-admin-1")).toBe(true);
  });
});
