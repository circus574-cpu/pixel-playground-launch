import { describe, expect, it, vi } from "vitest";

// Testujemy wzbogacenie świata v2 — wymuszamy WORLD_V2=true (domyślny URL testów ma ki-world-v1=1).
vi.mock("../game/world/generated/worldVersion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../game/world/generated/worldVersion")>();
  return { ...actual, WORLD_V2: true };
});

import { GameSession, ensurePlayerEquipment, type NpcId } from "../game/session";

const ROLES: NpcId[] = [
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

/** Ustawia gracza przy NPC danej roli (właściwe wnętrze + pozycja), aby nearbyNpc() go zwrócił. */
function atNpc(role: NpcId): GameSession {
  const g = new GameSession();
  ensurePlayerEquipment(g.player);
  const def = g.world.npcs.find((n) => n.id === role);
  g.player.interior = def?.building ?? null;
  g.dialogue = role;
  const npc = g.npcs.find((n) => n.id === role);
  if (npc) {
    g.player.x = npc.x;
    g.player.y = npc.y;
  }
  return g;
}

describe("plotki NPC dla wszystkich ról (rozbudowa NPC 12.11.2026)", () => {
  it("każda rola odpowiada plotką zależną od roli, nie tylko hintem o bossie", () => {
    for (const role of ROLES) {
      const g = atNpc(role);
      g.command({ type: "dialogue", action: "rumors" });
      // Hint kontynentalny zaczyna się od "Plotka:"; plotka roli jest doklejana przed nim.
      expect(g.notice.length, `rola ${role}`).toBeGreaterThan(40);
      expect(g.notice.startsWith("Plotka:"), `rola ${role} powinna mieć plotkę roli`).toBe(false);
    }
  });

  it("plotka pogłębia się wraz z postępem zadań (inne akapity)", () => {
    const g = atNpc("smith");
    g.command({ type: "dialogue", action: "rumors" });
    const first = g.notice;
    g.player.quests.steps = "done";
    g.command({ type: "dialogue", action: "rumors" });
    const second = g.notice;
    expect(second).not.toBe(first);
  });
});
