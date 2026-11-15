import { describe, expect, it } from "vitest";
import { MATERIAL_IDS, MATERIALS } from "../game/monsters/materials";
import { ITEM_CATALOG } from "../game/items";
import { ensurePlayerEquipment, GameSession, type Loot } from "../game/session";

function ground(g: GameSession, drop: string, entries: Partial<Loot>[]) {
  entries.forEach((e, i) =>
    g.loot.push({
      id: drop + "-" + i,
      x: g.player.x,
      y: g.player.y,
      item: "",
      quantity: 0,
      gold: 0,
      drop,
      ...e,
    }),
  );
}

describe("otwieranie łupu", () => {
  it("otwarcie jednego wpisu zabiera cały łup: przedmioty i monety, i zapisuje, co w nim było", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    const material = MATERIAL_IDS[0]!;
    const weapon = ITEM_CATALOG.find((i) => i.category === "weapon")!;
    const gold = g.player.gold;
    ground(g, "d1", [
      { item: material, quantity: 2, gold: 7 },
      { item: weapon.id, quantity: 1 },
      { item: "", quantity: 0, gold: 5 },
    ]);
    ground(g, "d2", [{ item: "tusk", quantity: 1 }]); // inny łup zostaje nietknięty
    let events = 0;
    const before = g.events.length;
    g.command({ type: "loot", id: "d1-2" });
    events = g.events.slice(before).filter((e) => e.type === "loot").length;
    expect(g.player.materials[material]).toBe(2);
    expect(g.player.bagItems[weapon.id]).toBe(1);
    expect(g.player.gold).toBe(gold + 12);
    expect(g.loot.map((l) => l.drop)).toEqual(["d2"]);
    expect(events).toBe(1); // jedno otwarcie, jedno zdarzenie dla sceny (rozbłysk)
    expect(g.lootReceipt).toMatchObject({ gold: 12 });
    expect(g.lootReceipt!.lines).toEqual([
      { item: material, name: MATERIALS[material]!.name, quantity: 2, kept: true },
      { item: weapon.id, name: weapon.name, quantity: 1, rarity: weapon.rarity, kept: true },
    ]);
  });

  it("numer otwarcia rośnie przy każdym otwarciu, więc interfejs rozpoznaje nowy łup", () => {
    const g = new GameSession();
    ground(g, "a", [{ item: "", quantity: 0, gold: 1 }]);
    g.command({ type: "loot", id: "a-0" });
    const first = g.lootReceipt!.id;
    ground(g, "b", [{ item: "", quantity: 0, gold: 1 }]);
    g.command({ type: "loot", id: "b-0" });
    expect(g.lootReceipt!.id).toBe(first + 1);
  });

  it("pozycja bez miejsca w plecaku zostaje w łupie, a monety są wypłacone tylko raz", () => {
    const g = new GameSession();
    const gold = g.player.gold;
    g.player.items.tusk = 99;
    ground(g, "full", [
      { item: "tusk", quantity: 1, gold: 4 },
      { item: "", quantity: 0, gold: 3 },
    ]);
    g.command({ type: "loot", id: "full-0" });
    expect(g.player.gold).toBe(gold + 7);
    expect(g.loot).toHaveLength(1);
    expect(g.loot[0]).toMatchObject({ item: "tusk", gold: 0 });
    expect(g.lootReceipt!.lines).toEqual([
      { item: "tusk", name: "Kieł dzika", quantity: 1, kept: false },
    ]);
    expect(g.notice).toMatch(/Brak miejsca/);
    // po zrobieniu miejsca łup otwiera się dalej, bez drugiej wypłaty monet
    g.player.items.tusk = 0;
    g.command({ type: "loot", id: "full-0" });
    expect(g.player.items.tusk).toBe(1);
    expect(g.player.gold).toBe(gold + 7);
    expect(g.loot).toHaveLength(0);
    expect(g.lootReceipt!.lines[0]).toMatchObject({ kept: true });
  });

  it("daleki łup otwiera się dopiero po dojściu, a wtedy cały", () => {
    const g = new GameSession();
    ground(g, "far", [
      { item: "tusk", quantity: 2, x: g.player.x + 260 },
      { item: "", quantity: 0, gold: 6, x: g.player.x + 260 },
    ]);
    g.command({ type: "loot", id: "far-1" });
    expect(g.lootReceipt).toBeNull();
    for (let i = 0; i < 400 && g.loot.length; i++) g.tick(50);
    expect(g.loot).toHaveLength(0);
    expect(g.player.items.tusk).toBe(2);
    expect(g.lootReceipt!.gold).toBe(6);
  });

  it("migawka sesji niesie zawartość ostatniego łupu (tak jak widzi ją tryb online)", () => {
    const g = new GameSession();
    expect(g.snapshot().lootReceipt).toBeNull();
    ground(g, "s", [{ item: "", quantity: 0, gold: 2 }]);
    g.command({ type: "loot", id: "s-0" });
    expect(g.snapshot().lootReceipt).toMatchObject({ gold: 2 });
  });
});
