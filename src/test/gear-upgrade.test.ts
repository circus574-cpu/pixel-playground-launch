import { describe, expect, it } from "vitest";
import {
  GameSession,
  ensurePlayerEquipment,
  equipmentStats,
  GEAR_UPGRADE_COST,
} from "../game/session";
import { ITEM_CATALOG } from "../game/items";
import { onlineCommand } from "../server/characters/commands";

const weapon = ITEM_CATALOG.find((i) => i.category === "weapon" && i.stats?.atkBonus)!;
const armor = ITEM_CATALOG.find((i) => i.category === "armor" && i.stats?.defBonus)!;

describe("ulepszanie sprzętu V2 u kowala (FABULA §12, rozbudowa NPC 12.11.2026)", () => {
  it("ulepsza broń V2 o +2 ATK za stopień i pobiera rosnący koszt", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    g.dialogue = "smith";
    g.player.gold = 1000;
    g.player.equipment!.weapon = weapon.id;
    const before = equipmentStats(g.player).attack;
    g.command({ type: "upgrade-gear", slot: "weapon" });
    expect(g.player.equipmentUpgrades?.["weapon"]).toBe(1);
    expect(g.player.gold).toBe(1000 - GEAR_UPGRADE_COST["weapon"]![0]!);
    expect(equipmentStats(g.player).attack).toBe(before + 2);
  });

  it("ulepsza pancerz V2 o +1 DEF za stopień", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    g.dialogue = "smith";
    g.player.gold = 1000;
    g.player.equipment!.armor = armor.id;
    const before = equipmentStats(g.player).defense;
    g.command({ type: "upgrade-gear", slot: "armor" });
    expect(g.player.equipmentUpgrades?.["armor"]).toBe(1);
    expect(equipmentStats(g.player).defense).toBe(before + 1);
  });

  it("broń ma limit 3 stopni, potem odmawia", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    g.dialogue = "smith";
    g.player.gold = 10000;
    g.player.equipment!.weapon = weapon.id;
    for (let i = 0; i < 3; i++) g.command({ type: "upgrade-gear", slot: "weapon" });
    expect(g.player.equipmentUpgrades?.["weapon"]).toBe(3);
    const gold = g.player.gold;
    g.command({ type: "upgrade-gear", slot: "weapon" });
    expect(g.player.equipmentUpgrades?.["weapon"]).toBe(3);
    expect(g.player.gold).toBe(gold);
  });

  it("nie ulepsza biżuterii ani pustego slotu", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    g.dialogue = "smith";
    g.player.gold = 1000;
    g.command({ type: "upgrade-gear", slot: "ring" });
    g.command({ type: "upgrade-gear", slot: "head" });
    expect(g.player.equipmentUpgrades?.["ring"]).toBeUndefined();
    expect(g.player.equipmentUpgrades?.["head"]).toBeUndefined();
    expect(g.player.gold).toBe(1000);
  });

  it("schemat online przyjmuje upgrade-gear i odrzuca zły slot", () => {
    expect(onlineCommand({ type: "upgrade-gear", slot: "weapon" })).toMatchObject({
      type: "upgrade-gear",
      slot: "weapon",
    });
    expect(() => onlineCommand({ type: "upgrade-gear", slot: "zly-slot" })).toThrow();
  });
});
