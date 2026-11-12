import { describe, expect, it } from "vitest";
import { GameSession, ensurePlayerEquipment } from "../game/session";
import { onlineCommand } from "../server/characters/commands";

describe("brew z wyborem materiału (rozbudowa NPC 12.11.2026)", () => {
  it("zużywa wybrany materiał, nie pierwszy z listy", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    g.dialogue = "alchemist";
    g.player.gold = 100;
    g.player.items.potion = 0;
    g.player.materials["aaa-first"] = 1;
    g.player.materials["zzz-chosen"] = 1;
    g.command({ type: "brew", recipe: "hp", material: "zzz-chosen" });
    expect(g.player.materials["zzz-chosen"]).toBeUndefined();
    expect(g.player.materials["aaa-first"]).toBe(1);
    expect(g.player.items.potion).toBe(1);
  });

  it("bez wyboru zużywa pierwszy materiał z listy", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    g.dialogue = "alchemist";
    g.player.gold = 100;
    g.player.items.potion = 0;
    g.player.materials["aaa-first"] = 1;
    g.player.materials["zzz-other"] = 1;
    g.command({ type: "brew", recipe: "hp" });
    expect(g.player.materials["aaa-first"]).toBeUndefined();
    expect(g.player.materials["zzz-other"]).toBe(1);
  });

  it("nieznany materiał wraca do pierwszego (bez błędu)", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    g.dialogue = "alchemist";
    g.player.gold = 100;
    g.player.items.potion = 0;
    g.player.materials["aaa-first"] = 1;
    g.command({ type: "brew", recipe: "hp", material: "nie-ma-takiego" });
    expect(g.player.materials["aaa-first"]).toBeUndefined();
    expect(g.player.items.potion).toBe(1);
  });

  it("schemat online przyjmuje brew z materiałem i bez", () => {
    expect(onlineCommand({ type: "brew", recipe: "hp", material: "m1" })).toMatchObject({
      type: "brew",
      material: "m1",
    });
    expect(onlineCommand({ type: "brew", recipe: "ki" })).toMatchObject({
      type: "brew",
      recipe: "ki",
    });
  });
});
