import { describe, it, expect } from "vitest";
import { GameSession, newPlayer, ensurePlayerEquipment, EQUIPMENT_SLOTS } from "../game/session";
import { cityRoom } from "../game/city/room";
import { getItemById } from "../game/items";

describe("Inventory, Equipment & City Depot System", () => {
  it("initializes player with all 8 equipment slots, bagItems, and empty depot with gold", () => {
    const p = newPlayer("planetary");
    expect(p.equipment).toBeDefined();
    for (const slot of EQUIPMENT_SLOTS) {
      expect(p.equipment![slot]).toBeNull();
    }
    expect(p.bagItems).toEqual({});
    expect(p.depot.gold).toBe(0);
    expect(p.depot.bagItems).toEqual({});
    expect(p.gold).toBeGreaterThan(0);
  });

  it("equips and unequips catalog equipment items and updates player combat stats", () => {
    const session = new GameSession();
    const p = session.player;
    ensurePlayerEquipment(p);

    const weaponId = "W-V1";
    p.bagItems![weaponId] = 1;

    // Equip weapon
    session.command({ type: "equip", item: weaponId });
    expect(p.equipment!.weapon).toBe(weaponId);
    expect(p.weapon).toBe(weaponId);
    expect(p.bagItems![weaponId]).toBeUndefined();

    // Unequip weapon
    session.command({ type: "unequip", slot: "weapon" });
    expect(p.equipment!.weapon).toBeNull();
    expect(p.weapon).toBeNull();
    expect(p.bagItems![weaponId]).toBe(1);
  });

  it("handles city depot gold deposit and withdrawal", () => {
    const session = new GameSession();
    const p = session.player;
    ensurePlayerEquipment(p);

    p.gold = 100;
    p.depot.gold = 0;
    p.interior = "depot";
    (session as unknown as { depotOpen: boolean }).depotOpen = true;

    const chest = cityRoom("depot", p.continent).chest;
    p.x = chest.x;
    p.y = chest.y;

    // Deposit 40 gold
    session.command({ type: "depot-gold", amount: 40, withdraw: false });
    expect(p.gold).toBe(60);
    expect(p.depot.gold).toBe(40);

    // Withdraw 25 gold
    session.command({ type: "depot-gold", amount: 25, withdraw: true });
    expect(p.gold).toBe(85);
    expect(p.depot.gold).toBe(15);
  });

  it("handles city depot item and equipment deposit and withdrawal", () => {
    const session = new GameSession();
    const p = session.player;
    ensurePlayerEquipment(p);

    p.interior = "depot";
    (session as unknown as { depotOpen: boolean }).depotOpen = true;

    const chest = cityRoom("depot", p.continent).chest;
    p.x = chest.x;
    p.y = chest.y;

    const helmetId = "H-V1";
    p.bagItems![helmetId] = 2;

    // Deposit 1 helmet
    session.command({ type: "depot", item: helmetId, quantity: 1, withdraw: false });
    expect(p.bagItems![helmetId]).toBe(1);
    expect(p.depot.bagItems![helmetId]).toBe(1);

    // Withdraw 1 helmet
    session.command({ type: "depot", item: helmetId, quantity: 1, withdraw: true });
    expect(p.bagItems![helmetId]).toBe(2);
    expect(p.depot.bagItems![helmetId]).toBeUndefined();
  });
});
