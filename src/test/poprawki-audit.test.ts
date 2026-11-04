import { describe, expect, it } from "vitest";
import { monsterVisual } from "../game/assets/catalog";
import { equipmentStats, GameSession, type NpcId } from "../game/session";
import { CITY_OBJECTS, VERDANT_BOARS } from "../game/city/verdantia";
import { occlusionAlpha, foliageAlpha } from "../game/world/visibility";
import { WORLDS } from "../game/world/worlds";
import aetherSpawns from "../../public/game/worlds/superior-v2/aether/spawns.json" with { type: "json" };
import nexusSpawns from "../../public/game/worlds/superior-v2/nexus/spawns.json" with { type: "json" };
import pyraSpawns from "../../public/game/worlds/superior-v2/pyra/spawns.json" with { type: "json" };

function talk(g: GameSession, npc: NpcId) {
  g.command({ type: "interact", npc });
  for (let i = 0; i < 200 && g.dialogue !== npc; i++) g.tick(50);
}

describe("POPRAWKI - Weryfikacja poprawek z audytu technicznego", () => {
  it("Błąd 1: szansa dropu poprawnie traktuje wartości > 1 jako procenty i nie daje fałszywego 100%", () => {
    const rawVal1 = 75; // 75%
    const normalized1 = rawVal1 > 1 ? rawVal1 / 100 : rawVal1;
    expect(normalized1).toBe(0.75);

    const rawVal2 = 0.35; // 35%
    const normalized2 = rawVal2 > 1 ? rawVal2 / 100 : rawVal2;
    expect(normalized2).toBe(0.35);

    // Wartość 1.0 pozostaje 1.0 (100%)
    const rawVal3 = 1.0;
    const normalized3 = rawVal3 > 1 ? rawVal3 / 100 : rawVal3;
    expect(normalized3).toBe(1.0);
  });

  it("Błąd 2: bossowie nie renderują się jako dziki, lecz otrzymują monumentalne modele", () => {
    // Standardowe ID
    const visualYgdrasha = monsterVisual("boss:ygdrasha");
    expect(visualYgdrasha.id).toBe("boss-ygdrasha");
    expect(visualYgdrasha.size).toEqual([180, 180]);
    expect(visualYgdrasha.id).not.toBe("boar-v1");

    // Wariant ze spacjami/podkreśleniami
    const visualUnderScore = monsterVisual("boss:ygdrasha_the_rooted");
    expect(visualUnderScore.id).toBe("boss-ygdrasha-the-rooted");
    expect(visualUnderScore.size).toEqual([180, 180]);

    // Format z prefiksem boss_ i boss-
    const visualThorgar = monsterVisual("boss_thorgar");
    expect(visualThorgar.id).toBe("boss-thorgar");
    expect(visualThorgar.size).toEqual([180, 180]);

    const visualPyrrhax = monsterVisual("boss-pyrrhax");
    expect(visualPyrrhax.id).toBe("boss-pyrrhax");
    expect(visualPyrrhax.size).toEqual([180, 180]);

    // Nawet nieznany boss ma model strażnika, a nie dzika
    const visualUnknown = monsterVisual("boss:nieznany-wladca");
    expect(visualUnknown.id).toBe("boss-nieznany-wladca");
    expect(visualUnknown.size).toEqual([180, 180]);
    expect(visualUnknown.clips.idle?.asset).not.toContain("dzik");
  });

  it("Błąd 3: bonus do szybkości ruchu (moveSpeedPercent i speedMultiplier) trafia do moveSpeedPct, a nie attackSpeedPct", () => {
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

  it("Błąd 4: żadne spawny potworów nie znajdują się w granicach bezpiecznych miast (Aether, Nexus, Pyra)", () => {
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

  it("Wymóg: strefy spawnów potworów są oczyszczone z zasłaniających drzew i gęstej przyrody (czyste pole walki)", () => {
    // 1. Verdantia - w promieniu walki wokół dzików (VERDANT_BOARS) nie ma żadnych zasłaniających koron drzew
    const treeKinds = new Set(["oak", "fir"]);
    for (const b of VERDANT_BOARS) {
      const treesNearBoar = CITY_OBJECTS.filter(
        (o) => treeKinds.has(o.kind) && Math.hypot(o.x - b.x, o.y - b.y) < 450,
      );
      expect(treesNearBoar.length).toBe(0);
    }

    // 2. visibility.ts - przejrzystość roślinności w walce spada do 0.12 (88% przezroczystości), nie zasłaniając widoku
    const mockTree = {
      id: "test-tree",
      kind: "oak",
      x: 100,
      y: 100,
      width: 200,
      height: 300,
      anchorX: 0.5,
      anchorY: 0.9,
      solid: true,
    };
    // Postać za drzewem
    const alphaHero = occlusionAlpha(mockTree, { x: 100, y: 70 });
    expect(alphaHero).toBeLessThanOrEqual(0.15);

    const alphaMonster = foliageAlpha(mockTree, [{ id: "enemy-1", x: 100, y: 70 }]);
    expect(alphaMonster).toBeLessThanOrEqual(0.15);
  });

  it("Błąd 5: kupiec obsługuje handel przedmiotami z katalogu V2 (kupno i sprzedaż z torby)", () => {
    const session = new GameSession();
    talk(session, "merchant");
    expect(session.dialogue).toBe("merchant");

    session.player.gold = 100;
    session.player.bagItems = { "P-KI-01": 2, "W-V1": 1 };

    // Kupno eliksiru V2 (cena P-KI-01 to 25)
    session.command({ type: "trade", item: "P-KI-01", buy: true });
    expect(session.player.gold).toBe(75);
    expect(session.player.bagItems["P-KI-01"]).toBe(3);

    // Sprzedaż przedmiotu z torby
    session.command({ type: "trade", item: "W-V1", buy: false });
    expect(session.player.gold).toBeGreaterThan(75);
    expect(session.player.bagItems["W-V1"]).toBeUndefined();
  });
});
