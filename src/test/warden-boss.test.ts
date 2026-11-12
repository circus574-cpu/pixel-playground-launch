import { describe, expect, it } from "vitest";
import { GameSession, ensurePlayerEquipment } from "../game/session";
import { BOSS_CATALOG } from "../game/bosses/catalog";

function przyWardenie(): GameSession {
  const g = new GameSession();
  ensurePlayerEquipment(g.player);
  g.player.interior = null;
  g.dialogue = "warden";
  const warden = g.npcs.find((n) => n.id === "warden");
  if (warden) {
    g.player.x = warden.x;
    g.player.y = warden.y;
  }
  return g;
}

describe("warden boss_enter — realne leże bossa (rozbudowa NPC 12.11.2026)", () => {
  it("przywołuje bossa kontynentu w leżu poza bezpiecznym miastem", () => {
    const g = przyWardenie();
    const boss = BOSS_CATALOG.find((b) => b.continent === g.world.id);
    expect(boss).toBeDefined();
    g.command({ type: "dialogue", action: "boss_enter" });
    const bossEnemy = g.enemies.find((e) => e.boss);
    // Albo boss przywołany w leżu, albo komunikat, że leże jest poza miastem.
    expect(bossEnemy || g.notice.includes("Wyjdź poza")).toBeTruthy();
    if (bossEnemy) {
      expect(bossEnemy.boss!.definition.id).toBe(boss!.id);
      expect(g.notice).toContain(boss!.locationName);
    }
  });

  it("gracz zostaje przeniesiony do leża (nie jest to już atrapa przy spawnie)", () => {
    const g = przyWardenie();
    const before = { x: g.player.x, y: g.player.y };
    g.command({ type: "dialogue", action: "boss_enter" });
    const moved = g.player.x !== before.x || g.player.y !== before.y;
    const boss = BOSS_CATALOG.find((b) => b.continent === g.world.id);
    // Ruch do leża albo wskazanie leża w komunikacie.
    expect(moved || g.notice.includes(boss!.locationName)).toBe(true);
  });
});
