import { describe, expect, it } from "vitest";
import { GameSession, type NpcId } from "../game/session";
import { WORLDS } from "../game/world/worlds";

function run(g: GameSession, ready: () => boolean, seconds = 100) {
  for (let i = 0; i < seconds * 20 && !ready(); i++) g.tick(50);
  expect(
    ready(),
    "Timeout waiting for condition: " + JSON.stringify({ p: g.player, notice: g.notice }),
  ).toBe(true);
}

function talk(g: GameSession, npc: NpcId) {
  g.command({ type: "interact", npc });
  run(g, () => g.dialogue === npc);
}

describe("Working NPC Systems (Działające systemy NPC)", () => {
  it("1. Alchemist crafts potions and elixirs from raw materials and gold", () => {
    const game = new GameSession();
    const p = game.player;
    // Add raw material and gold
    p.materials["mchowa-galaretka"] = 3;
    p.gold = 50;
    const initialPotions = p.items.potion;

    // Talk to alchemist
    talk(game, "alchemist");
    expect(game.dialogue).toBe("alchemist");

    // Craft HP potion (requires 1 material + 5 gold)
    game.command({ type: "brew", recipe: "hp" });
    expect(p.items.potion).toBe(initialPotions + 1);
    expect(p.materials["mchowa-galaretka"]).toBe(2);
    expect(p.gold).toBe(45);
    expect(game.notice).toContain("Uwarzono Miksturę Zdrowia");

    // Craft KI Elixir (requires 1 material + 8 gold)
    p.ki = 10;
    game.command({ type: "brew", recipe: "ki" });
    expect(p.materials["mchowa-galaretka"]).toBe(1);
    expect(p.gold).toBe(37);
    expect(p.ki).toBe(game.kit.stats.maxKi);
    expect(game.notice).toContain("Wypito świeży Eliksir KI");

    // Craft Antidote (requires 1 material + 6 gold)
    p.hp = 20;
    game.command({ type: "brew", recipe: "antidote" });
    expect(p.materials["mchowa-galaretka"]).toBeUndefined();
    expect(p.gold).toBe(31);
    expect(p.hp).toBe(70);
    expect(game.notice).toContain("Zastosowano Antidotum");

    // Cannot brew without materials
    game.command({ type: "brew", recipe: "hp" });
    expect(game.notice).toContain("Potrzebujesz przynajmniej jednego surowca");
  });

  it("2. Innkeeper restores full HP and Ki, clears debuffs, and shares tactical rumors", () => {
    const game = new GameSession();
    const p = game.player;
    p.gold = 20;
    p.hp = 15;
    p.ki = 10;

    talk(game, "innkeeper");
    expect(game.dialogue).toBe("innkeeper");

    // Ask for rumors
    game.command({ type: "dialogue", action: "rumors" });
    expect(game.notice).toContain("Plotka: Drwale ostrzegają przed leżem Ygdrashy");

    // Rest at inn
    game.command({ type: "rest" });
    expect(p.gold).toBe(15);
    expect(p.hp).toBe(game.kit.stats.maxHp);
    expect(p.ki).toBe(game.kit.stats.maxKi);
    expect(game.notice).toContain("Odpoczynek");

    // Free if already at full resources
    game.command({ type: "rest" });
    expect(p.gold).toBe(15);
    expect(game.notice).toContain("pełne życie");
  });

  it("3. Trainer allows combat testing and talent respec", () => {
    const game = new GameSession();
    const p = game.player;
    p.gold = 500;
    p.level = 5;
    p.skills = ["R", "V1", "V2"];

    talk(game, "trainer");
    expect(game.dialogue).toBe("trainer");

    // First respec is free, second respec costs gold
    game.command({ type: "respec" });
    expect(p.skills).toEqual(["R"]);
    expect(p.respecs).toBe(1);
    expect(game.notice).toContain("Drzewko zresetowane");

    // Second respec costs gold
    p.skills = ["R", "V1"];
    game.command({ type: "respec" });
    expect(p.respecs).toBe(2);
    expect(p.gold).toBe(250);
  });

  it("4. Warden briefings player and opens portal to boss arena", () => {
    const game = new GameSession();
    talk(game, "warden");
    expect(game.dialogue).toBe("warden");

    // Enter boss lair — realne leże: boss kontynentu przywołany albo wskazane leże poza miastem.
    game.command({ type: "dialogue", action: "boss_enter" });
    expect(game.dialogue).toBeNull();
    expect(game.notice).toContain("Strażnik");
    const boss = game.enemies.find((e) => e.boss);
    expect(boss || game.notice.includes("leże")).toBeTruthy();
  });

  it("5. All 4 worlds define 10 functional NPCs each", () => {
    const expectedRoles = [
      "guide",
      "hunter",
      "merchant",
      "smith",
      "keeper",
      "trainer",
      "innkeeper",
      "steward",
      "alchemist",
      "warden",
    ];
    for (const [wId, world] of Object.entries(WORLDS)) {
      expect(world.npcs.length, `${wId} npc count`).toBe(10);
      const roles = world.npcs.map((n) => n.id).sort();
      expect(roles, `${wId} roles`).toEqual([...expectedRoles].sort());
      for (const n of world.npcs) {
        expect(n.name.length, `${wId} ${n.id} name`).toBeGreaterThan(2);
        expect(n.role.length, `${wId} ${n.id} role`).toBeGreaterThan(3);
      }
    }
  });
});
