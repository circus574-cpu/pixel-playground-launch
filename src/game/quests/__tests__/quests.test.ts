import { describe, expect, it } from "vitest";
import { KIT_NODES } from "../../kit/nodes.generated";
import { MONSTERS, OWNER_BESTIARY_IDS } from "../bestiary";
import {
  ALL_CITIES_V2,
  ALL_FAMOUS_LOCATIONS_V2,
  ALL_WORLD_EVENTS_V2,
  CONTINENTS_WORLD_V2,
  isPositionInSafeCity,
} from "../../worlds";
import {
  ALL_QUESTS_V2,
  QUEST_BY_ID,
  createDefaultSaveV5,
  discoverFamousLocation,
  getNpcQuestMarker,
  isLocationDiscovered,
  migrateSaveV4ToV5,
  recordQuestObjectiveEvent,
  startQuest,
  triggerWorldEvent,
  validateQuestCatalogIntegrity,
} from "../engine";
import { LegacySaveV4 } from "../types";

describe("KI Legends World V2 & Quests Engine (Unit Suite — Section 10)", () => {
  it("1. Weryfikuje strukturę 4 kontynentów, 16 miast, 16 sławnych lokacji i 40 potworów bestiariusza", () => {
    expect(Object.keys(CONTINENTS_WORLD_V2)).toEqual(["verdant", "pyra", "aether", "nexus"]);
    expect(ALL_CITIES_V2).toHaveLength(16);
    expect(ALL_FAMOUS_LOCATIONS_V2).toHaveLength(16);
    expect(MONSTERS).toHaveLength(40);
    expect(OWNER_BESTIARY_IDS.size).toBe(40);

    // Każda rasa ma dokładnie 29 węzłów w drzewku (łącznie 116)
    expect(KIT_NODES.planetary).toHaveLength(29);
    expect(KIT_NODES.legend).toHaveLength(29);
    expect(KIT_NODES.sage).toHaveLength(29);
    expect(KIT_NODES.android).toHaveLength(29);
  });

  it("2. Waliduje wszystkie ID NPC, miast, landmarków, potworów i przedmiotów w katalogu 106 questów", () => {
    expect(ALL_QUESTS_V2.length).toBe(106);

    const validation = validateQuestCatalogIntegrity();
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
  });

  it("3. Odblokowuje questy po spełnieniu warunków i sprawdza zależności między zadaniami", () => {
    let save = createDefaultSaveV5("verdant");

    // O-V01 ma minLevel: 1 bez zależności -> jest od razu 'available'
    expect(save.quests["O-V01"]!.state).toBe("available");
    // O-V02 wymaga ukończenia O-V01 -> na starcie jest 'unavailable'
    expect(save.quests["O-V02"]!.state).toBe("unavailable");

    // Rozpocznij i ukończ O-V01
    save = startQuest(save, "O-V01");
    expect(save.quests["O-V01"]!.state).toBe("active");

    // Etap 1: porozmawiaj z Airą (npc-aira)
    save = recordQuestObjectiveEvent(save, "talk", "npc-aira", 1);
    expect(save.quests["O-V01"]!.currentStageIndex).toBe(1);

    // Etap 2: odkryj fountain-5 (famous-verdant-1) i porozmawiaj z Airą
    save = recordQuestObjectiveEvent(save, "discover", "fountain-5", 1);
    save = recordQuestObjectiveEvent(save, "talk", "npc-aira", 1);

    expect(save.quests["O-V01"]!.state).toBe("completed");
    // Po ukończeniu O-V01, zależne zadanie O-V02 automatycznie przechodzi w stan 'available'
    expect(save.quests["O-V02"]!.state).toBe("available");
  });

  it("4. Obsługuje liczniki postępu dla wszystkich 5 typów celów: combat, talk, discover, visit, deliver", () => {
    let save = createDefaultSaveV5("aether");

    // Uruchom O-A01 (talk + discover + combat)
    save = startQuest(save, "O-A01");
    save = recordQuestObjectiveEvent(save, "talk", "npc-sora", 1);
    save = recordQuestObjectiveEvent(save, "discover", "sanctum-0", 1);
    expect(save.quests["O-A01"]!.currentStageIndex).toBe(1);

    // Combat częściowy (2 z 3)
    save = recordQuestObjectiveEvent(save, "combat", "aether-swietlik-pieczeci", 2);
    expect(save.quests["O-A01"]!.objectiveProgress["O-A01-obj3"]).toBe(2);
    save = recordQuestObjectiveEvent(save, "combat", "aether-swietlik-pieczeci", 1);
    save = recordQuestObjectiveEvent(save, "talk", "npc-mei", 1);
    expect(save.quests["O-A01"]!.state).toBe("completed");

    // Uruchom O-A02 (discover + talk + combat + deliver)
    save = startQuest(save, "O-A02");
    save = recordQuestObjectiveEvent(save, "discover", "archive-1", 1);
    save = recordQuestObjectiveEvent(save, "talk", "npc-enso", 1);
    expect(save.quests["O-A02"]!.currentStageIndex).toBe(1);

    save = recordQuestObjectiveEvent(save, "combat", "aether-pergaminowy-straznik", 4);
    const potionsBefore = save.inventory.potion;
    save = recordQuestObjectiveEvent(save, "deliver", "potion", 1);
    expect(save.inventory.potion).toBe(potionsBefore - 1);
    expect(save.quests["O-A02"]!.state).toBe("completed");

    // Uruchom O-A03 z celem 'visit' (aether-tarasy-switu)
    save = startQuest(save, "O-A03");
    save = recordQuestObjectiveEvent(save, "visit", "aether-tarasy-switu", 1);
    expect(save.quests["O-A03"]!.objectiveProgress["O-A03-obj1"]).toBe(1);
  });

  it("5. Gwarantuje jednorazowe przyznanie nagrody i chroni przed duplikacją przy ponownej ewaluacji", () => {
    let save = createDefaultSaveV5("aether");
    const initialCoins = save.coins;
    const quest = QUEST_BY_ID["S-A01"]!;

    save = startQuest(save, "S-A01");
    save = recordQuestObjectiveEvent(save, "combat", "aether-swietlik-pieczeci", 3);
    save = recordQuestObjectiveEvent(save, "talk", "npc-mei", 1);

    expect(save.quests["S-A01"]!.state).toBe("completed");
    expect(save.quests["S-A01"]!.completionCount).toBe(1);
    expect(save.rewardClaimedQuestIds).toContain("S-A01");
    expect(save.coins).toBe(initialCoins + quest.reward.coins);

    // Ponowne wysłanie tych samych zdarzeń dla niepowtarzalnego zadania NIE może dodać nagrody po raz drugi
    const coinsAfterFirstCompletion = save.coins;
    save = startQuest(save, "S-A01");
    save = recordQuestObjectiveEvent(save, "combat", "aether-swietlik-pieczeci", 3);
    save = recordQuestObjectiveEvent(save, "talk", "npc-mei", 1);

    expect(save.coins).toBe(coinsAfterFirstCompletion);
  });

  it("6. Obsługuje zadania powtarzalne (repeatable: true) oraz wydarzenia świata (once vs repeatable)", () => {
    let save = createDefaultSaveV5("aether");
    // Podnieś poziom do 3, aby odblokować powtarzalny quest S-A05
    save = { ...save, level: 5 };
    save = startQuest(save, "S-A05");
    expect(QUEST_BY_ID["S-A05"]!.repeatable).toBe(true);
    expect(save.quests["S-A05"]!.state).toBe("active");

    // Pierwsze ukończenie S-A05
    save = recordQuestObjectiveEvent(save, "combat", "aether-szmaragdowy-waz", 4);
    save = recordQuestObjectiveEvent(save, "talk", "npc-aether-ferryman", 1);
    expect(save.quests["S-A05"]!.state).toBe("completed");
    expect(save.quests["S-A05"]!.completionCount).toBe(1);

    // Ponowne uruchomienie i drugie ukończenie zadania odnawialnego
    save = startQuest(save, "S-A05");
    expect(save.quests["S-A05"]!.state).toBe("active");
    save = recordQuestObjectiveEvent(save, "combat", "aether-szmaragdowy-waz", 4);
    save = recordQuestObjectiveEvent(save, "talk", "npc-aether-ferryman", 1);
    expect(save.quests["S-A05"]!.state).toBe("completed");
    expect(save.quests["S-A05"]!.completionCount).toBe(2);

    // Wydarzenie jednorazowe ('once')
    const onceEvent = ALL_WORLD_EVENTS_V2.find(
      (e) => e.repeatability === "once" && e.implementationStatus === "active_in_engine",
    )!;
    const coinsBeforeEvent = save.coins;
    save = triggerWorldEvent(save, onceEvent.id);
    expect(save.coins).toBe(coinsBeforeEvent + onceEvent.reward.coins);
    // Drugi raz to samo wydarzenie 'once' nie przyznaje nagrody
    save = triggerWorldEvent(save, onceEvent.id);
    expect(save.coins).toBe(coinsBeforeEvent + onceEvent.reward.coins);
  });

  it("7. Odkrywa sławne lokacje, przyznaje nagrodę za pierwsze odkrycie i odblokowuje ukryte questy", () => {
    let save = createDefaultSaveV5("aether");
    expect(save.quests["H-A01"]!.state).toBe("unavailable");

    const coinsBefore = save.coins;
    save = discoverFamousLocation(save, "sanctum-0");
    expect(isLocationDiscovered(save, "sanctum-0")).toBe(true);
    expect(isLocationDiscovered(save, "famous-aether-1")).toBe(true);
    expect(save.coins).toBeGreaterThan(coinsBefore);

    // Ukryty quest H-A01 wymaga odkrycia famous-aether-1 (sanctum-0) -> teraz staje się 'available'
    expect(save.quests["H-A01"]!.state).toBe("available");

    // Ponowne odkrycie tej samej lokacji nie duplikuje nagrody
    const coinsAfterFirst = save.coins;
    save = discoverFamousLocation(save, "sanctum-0");
    expect(save.coins).toBe(coinsAfterFirst);
  });

  it("8. Poprawnie migruje zapis Save v4 do Save v5 bez utraty danych", () => {
    const legacyV4: LegacySaveV4 = {
      version: 4,
      heroRace: "android",
      continent: "nexus",
      level: 7,
      xp: 1650,
      coins: 540,
      position: { x: 1650, y: 620 },
      inventory: { potion: 6, tusk: 4, sword: 2, vest: 1 },
      swordUpgraded: true,
      completedQuests: ["O-N01", "S-N01"],
      activeQuestId: "O-N02",
    };

    const migrated = migrateSaveV4ToV5(legacyV4);
    expect(migrated.version).toBe(5);
    expect(migrated.migratedFromV4).toBe(true);
    expect(migrated.heroRace).toBe("android");
    expect(migrated.continent).toBe("nexus");
    expect(migrated.level).toBe(7);
    expect(migrated.coins).toBe(540);
    expect(migrated.swordUpgraded).toBe(true);
    expect(migrated.inventory).toEqual({ potion: 6, tusk: 4, sword: 2, vest: 1 });
    expect(migrated.quests["O-N01"]!.state).toBe("completed");
    expect(migrated.quests["S-N01"]!.state).toBe("completed");
    expect(migrated.quests["O-N02"]!.state).toBe("active");
    expect(migrated.rewardClaimedQuestIds).toContain("O-N01");
  });

  it("9. Zwraca poprawne znaczniki zadań nad NPC (! dla dostępnych, ? dla aktywnych rozmów) oraz sprawdza strefy bezpiecznych miast", () => {
    let save = createDefaultSaveV5("verdant");
    // npc-aira ma dostępne zadanie O-V01 -> znacznik '!'
    expect(getNpcQuestMarker(save, "npc-aira")).toBe("!");

    // Po rozpoczęciu O-V01 w etapie 1 jest cel rozmowy z npc-aira -> znacznik '?'
    save = startQuest(save, "O-V01");
    expect(getNpcQuestMarker(save, "npc-aira")).toBe("?");

    // Sprawdzenie bezpiecznego miasta (Zielona Przystań w Verdantii: x 980..1760, y 720..1580)
    expect(isPositionInSafeCity("verdant", 1480, 900)).not.toBeNull();
    expect(isPositionInSafeCity("verdant", 100, 100)).toBeNull();
  });
});
