import { describe, expect, it } from "vitest";
import { onlineCommand } from "../server/characters/commands";

describe("parytet komend NPC online (rozbudowa NPC 12.11.2026)", () => {
  it("przyjmuje craft (panel wytwarzania działa na serwerze)", () => {
    expect(onlineCommand({ type: "craft", recipe: "rec-potion-basic" })).toMatchObject({
      type: "craft",
      recipe: "rec-potion-basic",
    });
  });

  it("przyjmuje interact z alchemikiem i strażnikiem (było odrzucane)", () => {
    expect(onlineCommand({ type: "interact", npc: "alchemist" })).toMatchObject({
      type: "interact",
      npc: "alchemist",
    });
    expect(onlineCommand({ type: "interact", npc: "warden" })).toMatchObject({
      type: "interact",
      npc: "warden",
    });
  });

  it("przyjmuje depot-gold (skarbiec złota online)", () => {
    expect(onlineCommand({ type: "depot-gold", amount: 50, withdraw: false })).toMatchObject({
      type: "depot-gold",
      amount: 50,
    });
    expect(onlineCommand({ type: "depot-gold", amount: 50, withdraw: true })).toMatchObject({
      type: "depot-gold",
      withdraw: true,
    });
  });

  it("przyjmuje handel V2 (kupno/sprzedaż przedmiotu z katalogu)", () => {
    expect(onlineCommand({ type: "trade", item: "W-V1", buy: true })).toMatchObject({
      type: "trade",
      item: "W-V1",
      buy: true,
    });
  });

  it("przyjmuje equip i unequip sprzętu V2 (sloty katalogowe)", () => {
    expect(onlineCommand({ type: "equip", item: "W-V1" })).toMatchObject({
      type: "equip",
      item: "W-V1",
    });
    expect(onlineCommand({ type: "unequip", slot: "head" })).toMatchObject({
      type: "unequip",
      slot: "head",
    });
    expect(onlineCommand({ type: "unequip", slot: "amulet" })).toMatchObject({
      type: "unequip",
      slot: "amulet",
    });
    expect(() => onlineCommand({ type: "unequip", slot: "nieznany-slot" })).toThrow();
  });

  it("odrzuca craft bez receptury i depot-gold spoza zakresu", () => {
    expect(() => onlineCommand({ type: "craft" })).toThrow();
    expect(() => onlineCommand({ type: "craft", recipe: "" })).toThrow();
    expect(() => onlineCommand({ type: "depot-gold", amount: 0, withdraw: false })).toThrow();
    expect(() => onlineCommand({ type: "depot-gold", amount: -5, withdraw: false })).toThrow();
  });

  it("nadal odrzuca nieznane role NPC", () => {
    expect(() => onlineCommand({ type: "interact", npc: "nieznana-rola" })).toThrow();
  });
});
