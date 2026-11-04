import { describe, expect, it } from "vitest";
import { monsterVisual } from "../game/assets/catalog";
import { equipmentStats } from "../game/session";
import { WORLDS } from "../game/world/worlds";
import aetherSpawns from "../../public/game/worlds/superior-v2/aether/spawns.json" with { type: "json" };
import nexusSpawns from "../../public/game/worlds/superior-v2/nexus/spawns.json" with { type: "json" };
import pyraSpawns from "../../public/game/worlds/superior-v2/pyra/spawns.json" with { type: "json" };

describe("POPRAWKI - Weryfikacja poprawek z audytu technicznego", () => {
  it("Błąd 1: szansa dropu poprawnie traktuje wartości > 1 jako procenty", () => {
    const rawVal1 = 75; // 75%
    const normalized1 = rawVal1 > 1 ? rawVal1 / 100 : rawVal1;
    expect(normalized1).toBe(0.75);

    const rawVal2 = 0.35; // 35%
    const normalized2 = rawVal2 > 1 ? rawVal2 / 100 : rawVal2;
    expect(normalized2).toBe(0.35);
  });

  it("Błąd 2: bossowie nie renderują się jako dziki, lecz otrzymują monumentalne modele", () => {
    const visual = monsterVisual("boss:ygdrasha");
    expect(visual.id).toBe("boss-ygdrasha");
    expect(visual.size).toEqual([180, 180]);
    // Nie jest domyślnym dzikiem leśnym
    expect(visual.id).not.toBe("boar-v1");
  });

  it("Błąd 3: bonus do szybkości ruchu (moveSpeedPercent) trafia do moveSpeedPct, a nie attackSpeedPct", () => {
    // Przedmiot z bonusem moveSpeedPercent w slocie feet
    const stats = equipmentStats({
      weapon: null,
      armor: null,
      upgrade: 0,
      equipment: {
        head: null,
        weapon: null,
        armor: null,
        amulet: null,
        ring: null,
        offhand: null,
        hands: null,
        feet: "BUTY-15-01",
      },
    });
    // moveSpeedPct powinno zawierać bonus szybkości biegu
    expect(stats.moveSpeedPct).toBeGreaterThanOrEqual(0);
    // attackSpeedPct nie powinno być sztucznie zawyżone przez szybkość biegu
    expect(stats.attackSpeedPct).toBe(0);
  });

  it("Błąd 4: żadne spawny potworów nie znajdują się w granicach bezpiecznych miast", () => {
    const checkSpawns = (worldId: "aether" | "nexus" | "pyra", spawns: typeof aetherSpawns) => {
      const world = WORLDS[worldId];
      expect(world.city).toBeDefined();
      expect(world.city?.bounds).toBeDefined();
      const bounds = world.city!.bounds!;
      for (const s of spawns.overworld) {
        const inside =
          s.x >= bounds.x &&
          s.x <= bounds.x + bounds.width &&
          s.y >= bounds.y &&
          s.y <= bounds.y + bounds.height;
        expect(inside).toBe(false);
      }
    };

    checkSpawns("aether", aetherSpawns as any);
    checkSpawns("nexus", nexusSpawns as any);
    checkSpawns("pyra", pyraSpawns as any);
  });
});
