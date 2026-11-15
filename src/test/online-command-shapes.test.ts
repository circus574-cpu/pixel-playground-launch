import { describe, expect, it } from "vitest";
import { onlineCommand } from "../server/characters/commands";
import { KIT_NODES } from "../game/kit";

/**
 * Every command shape the interface sends, written as the components write it. The online server validates strictly
 * (unknown keys end the session with COMMAND_REJECTED), so a shape that drifts from the schema breaks the game for
 * players. "pause" is answered on the client and never reaches the server.
 */
const UI_COMMANDS: Record<string, unknown>[] = [
  { type: "heritage", action: "activity-start", id: "H-V01" },
  { type: "heritage", action: "activity-leave", id: "H-V01" },
  { type: "heritage", action: "activity-finish", id: "H-V01" },
  { type: "heritage", action: "start", id: "H-V01" },
  { type: "heritage", action: "scan", id: "H-V01" },
  { type: "heritage", action: "go", id: "H-V01", targetId: "t1" },
  { type: "heritage", action: "claim", id: "H-V01", choiceId: null },
  { type: "heritage", action: "claim", id: "H-V01", choiceId: "c1" },
  { type: "heritage-weapon", action: "deposit" },
  { type: "heritage-weapon", action: "withdraw" },
  { type: "dialogue", action: "close" },
  { type: "dialogue", action: "upgrade" },
  { type: "dialogue", action: "rumors" },
  { type: "dialogue", action: "claim" },
  { type: "dialogue", action: "accept" },
  { type: "dialogue", action: "boss_enter", bossId: "ygdrasha" },
  { type: "trade", item: "potion", buy: true },
  { type: "trade", item: "potion", buy: false },
  { type: "respec" },
  { type: "learn", node: KIT_NODES.planetary[1]!.id },
  { type: "interact", npc: "trainer" },
  { type: "interact", npc: "guide" },
  { type: "storage-close" },
  { type: "upgrade-gear", slot: "weapon" },
  { type: "unequip", slot: "weapon" },
  { type: "unequip", slot: "armor" },
  { type: "equip", item: "sword" },
  { type: "training", action: "start" },
  { type: "training", action: "reset" },
  { type: "training", action: "start", discipline: "dodge" },
  { type: "target", id: "boar-1" },
  { type: "move", x: 100, y: 200 },
  { type: "rest" },
  { type: "quest-deliver", item: "gel" },
  { type: "fieldwork", id: "f1", action: "act" },
  { type: "expedition", id: "e1", action: "start" },
  { type: "enter", building: "shop" },
  { type: "exit" },
  { type: "development", action: "variant", id: null },
  { type: "development", action: "reset-training" },
  { type: "depot-gold", amount: 10, withdraw: true },
  { type: "depot-gold", amount: 10, withdraw: false },
  { type: "depot", item: "potion", quantity: 2, withdraw: true },
  { type: "depot", item: "potion", quantity: 2, withdraw: false },
  { type: "craft", recipe: "r1" },
  { type: "chest" },
  { type: "brew", recipe: "hp" },
  { type: "brew", recipe: "ki", material: "gel" },
  { type: "loot", id: "loot-1" },
  { type: "ability", ability: "R" },
  { type: "ability", ability: "potion" },
  { type: "dodge" },
  { type: "cancel" },
];

describe("commands sent by the interface", () => {
  for (const command of UI_COMMANDS)
    it(`the server accepts ${JSON.stringify(command)}`, () => {
      expect(() => onlineCommand(command)).not.toThrow();
    });
});
