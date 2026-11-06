import { describe, expect, it } from "vitest";
import { ALL_NPC_DIALOGUES, getNpcDialogue } from "../game/dialogue";
import { ALL_CITIES_V2 } from "../game/worlds/index";
import { v2Places } from "../game/worlds/v2Places";
import { boundTownNpc } from "../game/world/generated/simulationWorld";
import { GameSession, type NpcId } from "../game/session";
import { WORLDS } from "../game/world/worlds";

/**
 * Katalog `src/game/dialogue` ma gotowe teksty dla wszystkich NPC miast v2. Gra ich nie czytała,
 * bo panel rozmowy szukał wpisu po identyfikatorze roli („merchant"), a katalog jest kluczowany
 * „npc-mei". Te testy pilnują, że połączenie nie zniknie ponownie.
 */
function rozmowa(g: GameSession, npc: NpcId) {
  g.command({ type: "interact", npc });
  for (let i = 0; i < 2000 && g.dialogue !== npc; i++) g.tick(50);
  expect(g.dialogue, `timeout: ${g.notice}`).toBe(npc);
}

describe("katalog dialogów jest podłączony do NPC miast v2", () => {
  it("każdy NPC każdego miasta v2 ma wpis w katalogu", () => {
    const npc = ALL_CITIES_V2.flatMap((c) => c.npcs);
    expect(npc.length).toBeGreaterThan(0);
    for (const miasto of ALL_CITIES_V2)
      for (const postac of miasto.npcs)
        expect(getNpcDialogue(postac.id), `${miasto.id}/${postac.id}`).toBeDefined();
  });
  it("rola w osadzie zwraca klucz katalogu, po którym panel znajdzie tekst", () => {
    const places = v2Places("aether");
    expect(places).toBeDefined();
    const osada = Object.values(places!.cities)[0]!.settlement;
    const związany = boundTownNpc("aether", osada, places, "guide");
    expect(związany).toBeDefined();
    expect(ALL_NPC_DIALOGUES[związany!.id]).toBeDefined();
  });
  it("plotka bierze tekst z katalogu, gdy rozmówca ma klucz", () => {
    const swiat = structuredClone(WORLDS.verdant);
    swiat.npcs.find((n) => n.id === "innkeeper")!.dialogueId = "npc-ren";
    const gra = new GameSession(undefined, "planetary", { world: swiat });
    rozmowa(gra, "innkeeper");
    gra.command({ type: "dialogue", action: "rumors" });
    expect(gra.notice).toContain(getNpcDialogue("npc-ren")!.rumors[0]);
    expect(gra.notice).toContain("Plotka: Drwale ostrzegają");
  });
  it("bez klucza zostaje sam hint kontynentowy, więc stary świat się nie zmienia", () => {
    const gra = new GameSession(undefined, "planetary", {
      world: structuredClone(WORLDS.verdant),
    });
    rozmowa(gra, "innkeeper");
    gra.command({ type: "dialogue", action: "rumors" });
    expect(gra.notice).toBe(
      "Plotka: Drwale ostrzegają przed leżem Ygdrashy w głębi wschodniej puszczy. Jej korzenie więżą, a jad zatruwa, ale jej kora jest wrażliwa na ogień i skupione uderzenia Ki!",
    );
  });
  it("licznik rozmów rośnie, więc powitania z katalogu się zmieniają", () => {
    const gra = new GameSession(undefined, "planetary", { world: structuredClone(WORLDS.verdant) });
    expect(gra.dialogueTurn).toBe(0);
    rozmowa(gra, "innkeeper");
    expect(gra.dialogueTurn).toBe(1);
    expect(gra.snapshot().dialogueTurn).toBe(1);
    gra.command({ type: "dialogue", action: "close" });
    rozmowa(gra, "innkeeper");
    expect(gra.dialogueTurn).toBe(2);
    const ren = getNpcDialogue("npc-ren")!;
    expect(ren.greetings[1 % ren.greetings.length]).not.toBe(ren.greetings[2 % ren.greetings.length]);
  });
});
