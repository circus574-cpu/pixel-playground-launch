import { describe, expect, it } from "vitest";
import { newPlayer, stats, characterFullStats, type Player } from "../game/session";
import { StoredCharacter } from "../server/characters/repository";
import {
  listAllServerCharacters,
  getServerCharacterDetails,
  executeLiveAdminAction,
  type ServerCharacterUpdatePatch,
} from "../server/adminCharacterService";

describe("Server Character Admin Management Service", () => {
  it("gracefully returns empty array when database is not connected", async () => {
    const list = await listAllServerCharacters();
    expect(Array.isArray(list)).toBe(true);
  });

  it("gracefully handles character details lookup when database is not connected", async () => {
    const fakeUuid = "00000000-0000-0000-0000-000000000000";
    const detail = await getServerCharacterDetails(fakeUuid);
    expect(detail).toBeNull();
  });

  it("applies full statOverrides and equipment slots according to StoredCharacter schema", () => {
    const p = newPlayer("planetary");
    expect(p.level).toBe(1);

    // Prepare full admin patch
    const patch: ServerCharacterUpdatePatch = {
      name: "SuperMistrz",
      level: 15,
      xp: 25000,
      hp: 850,
      ki: 400,
      gold: 99999,
      depotGold: 500000,
      dead: false,
      respecs: 5,
      continent: "verdant",
      x: 4200,
      y: 2500,
      statOverrides: {
        maxHp: 1500,
        maxKi: 600,
        attack: 85,
        defense: 45,
        speed: 250,
        kiRegen: 5,
        crit: 25,
        attackInterval: 500,
        range: 48,
      },
      equipment: {
        head: "helmet_of_valor",
        weapon: "blade_of_light",
        armor: "plate_of_legends",
        offhand: "shield_of_aegis",
        hands: "gloves_of_fury",
        ring: "ring_of_power",
        amulet: "amulet_of_wisdom",
        feet: "boots_of_haste",
      },
      bagItems: {
        wood: 25,
        herb: 50,
        potion: 15,
        helmet_of_valor: 1,
      },
      depotItems: {
        items: { potion: 5, tusk: 2, sword: 1, vest: 1 },
        materials: { stone: 99 },
        bagItems: { blade_of_light: 1 },
      },
      quests: {
        steps: "done",
        boars: "done",
        gear: "done",
      },
      skills: ["R", "A1", "A2", "B1", "C1"],
    };

    // Apply patch to player
    const modified: Player = {
      ...p,
      name: patch.name!,
      level: patch.level!,
      xp: patch.xp!,
      hp: patch.hp!,
      ki: patch.ki!,
      gold: patch.gold!,
      dead: patch.dead!,
      respecs: patch.respecs!,
      continent: patch.continent!,
      x: patch.x!,
      y: patch.y!,
      upgrade: 1,
      statOverrides: {
        maxHp: patch.statOverrides?.maxHp ?? undefined,
        maxKi: patch.statOverrides?.maxKi ?? undefined,
        attack: patch.statOverrides?.attack ?? undefined,
        defense: patch.statOverrides?.defense ?? undefined,
        speed: patch.statOverrides?.speed ?? undefined,
        kiRegen: patch.statOverrides?.kiRegen ?? undefined,
        crit: patch.statOverrides?.crit ?? undefined,
        attackInterval: patch.statOverrides?.attackInterval ?? undefined,
        range: patch.statOverrides?.range ?? undefined,
      },
      equipment: {
        head: patch.equipment?.head ?? null,
        weapon: patch.equipment?.weapon ?? null,
        armor: patch.equipment?.armor ?? null,
        offhand: patch.equipment?.offhand ?? null,
        hands: patch.equipment?.hands ?? null,
        ring: patch.equipment?.ring ?? null,
        amulet: patch.equipment?.amulet ?? null,
        feet: patch.equipment?.feet ?? null,
      },
      bagItems: { ...patch.bagItems },
      depot: {
        ...p.depot,
        gold: patch.depotGold!,
        items: {
          potion: patch.depotItems?.items?.potion ?? p.depot.items.potion,
          tusk: patch.depotItems?.items?.tusk ?? p.depot.items.tusk,
          sword: patch.depotItems?.items?.sword ?? p.depot.items.sword,
          vest: patch.depotItems?.items?.vest ?? p.depot.items.vest,
        },
        materials: { ...p.depot.materials, ...patch.depotItems?.materials },
        bagItems: { ...p.depot.bagItems, ...patch.depotItems?.bagItems },
      },
      quests: {
        steps: patch.quests!.steps!,
        boars: patch.quests!.boars!,
        gear: patch.quests!.gear!,
      },
      skills: [...patch.skills!],
    };

    // Validate that modified state strictly matches StoredCharacter zod schema
    const stored = StoredCharacter.parse({
      format: "server-character-1",
      player: modified,
      runtime: { feature: "verdant" },
    });

    expect(stored.format).toBe("server-character-1");
    expect(stored.player.name).toBe("SuperMistrz");
    expect(stored.player.level).toBe(15);
    expect(stored.player.statOverrides?.attack).toBe(85);
    expect(stored.player.equipment?.head).toBe("helmet_of_valor");
    expect(stored.player.upgrade).toBe(1);
    expect(stored.player.bagItems?.["herb"]).toBe(50);
    expect(stored.player.depot?.gold).toBe(500000);
    expect(stored.player.quests?.gear).toBe("done");
    expect(stored.player.skills).toContain("A1");
  });

  it("calculates accurate maxHp and maxKi with stat overrides", () => {
    const p = newPlayer("sage");
    const baseStats = stats(p);

    // Apply combat stat override
    const modified: Player = {
      ...p,
      statOverrides: {
        maxHp: 2500,
        maxKi: 1200,
      },
    };

    const newStats = stats(modified);
    expect(newStats.maxHp).toBe(2500);
    expect(newStats.maxKi).toBe(1200);
    expect(newStats.maxHp).toBeGreaterThan(baseStats.maxHp);
    expect(newStats.maxKi).toBeGreaterThan(baseStats.maxKi);
  });

  it("handles live admin actions logic gracefully", async () => {
    const fakeUuid = "11111111-1111-1111-1111-111111111111";

    // Action kick when player is offline
    const kickRes = await executeLiveAdminAction(fakeUuid, { type: "kick" }, "admin-1");
    expect(kickRes.ok).toBe(true);

    // Action heal without DB gracefully returns failure
    const healRes = await executeLiveAdminAction(fakeUuid, { type: "heal" }, "admin-1");
    expect(healRes.ok).toBe(false);
  });

  it("calculates complete live effective stats including speed, attack interval, attack rate and breakdown", () => {
    const p = newPlayer("planetary");
    const full = characterFullStats(p);

    // Initial level 1 Planetary speed and attack interval
    expect(full.stats.speed).toBe(185);
    expect(full.stats.attackInterval).toBe(650);
    expect(full.attacksPerSecond).toBeCloseTo(1.54, 1);
    expect(full.stats.maxHp).toBe(125);
    expect(full.stats.maxKi).toBe(50);
    expect(full.stats.attack).toBe(12);
    expect(full.stats.defense).toBe(5);

    // Check breakdown table contains required keys
    expect(full.breakdown.speed).toBeDefined();
    expect(full.breakdown.attackInterval).toBeDefined();
    expect(full.breakdown.attack).toBeDefined();
    expect(full.breakdown.defense).toBeDefined();

    // Check overrides take priority
    const overridden = characterFullStats({
      ...p,
      statOverrides: {
        speed: 350,
        attackInterval: 250,
      },
      combatTraining: {
        dodge: { rank: 50, progress: 0 },
        attackSpeed: { rank: 40, progress: 0 },
        technique: { rank: 20, progress: 0 },
      },
    });

    expect(overridden.stats.speed).toBe(350);
    expect(overridden.stats.attackInterval).toBe(250);
    expect(overridden.attacksPerSecond).toBe(4);
    // Dodge bonus: 50 * 0.1 = +5%
    expect(overridden.stats.dodgeChance).toBeGreaterThanOrEqual(5);
    expect(overridden.stats.technique).toBe(20);
    expect(overridden.breakdown.speed.gm).toBe(350 - overridden.breakdown.speed.base);
  });
});
