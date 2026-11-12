import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useCallback, useState } from "react";
import { GameHud } from "../components/game/GameHud";
import { GameSession, ensurePlayerEquipment, ITEMS, type Command } from "../game/session";
import { CRAFTING_RECIPES, ITEM_CATALOG } from "../game/items";
import { isShopItem, shopPrice } from "../game/items/loot";
import { isMaterial } from "../game/monsters/materials";

afterEach(cleanup);

function mountSession(session: GameSession) {
  let update = () => {};
  function View() {
    const [state, setState] = useState(() => session.snapshot());
    update = () => setState(session.snapshot());
    const send = useCallback((command: Command) => {
      session.command(command);
      setState(session.snapshot());
    }, []);
    return (
      <GameHud
        state={state}
        error={null}
        zoom={0.48}
        onZoom={() => {}}
        fullscreen={false}
        onFullscreen={() => {}}
        onCommand={send}
      />
    );
  }
  render(<View />);
  return {
    advance(until: () => boolean, limit = 2000) {
      act(() => {
        for (let i = 0; i < limit && !until(); i++) session.tick(50);
        update();
      });
      expect(until()).toBe(true);
    },
  };
}

describe("sklep V2 i crafting w rozmowie z NPC (UI ekonomii 12.11.2026)", () => {
  it("kupiec: panel katalogowy kupuje słaby przedmiot i zapisuje go w torbie", () => {
    const session = new GameSession();
    ensurePlayerEquipment(session.player);
    const item = ITEM_CATALOG.find((i) => isShopItem(i) && !(i.id in ITEMS))!;
    session.player.gold = shopPrice(item) + 200;
    const ui = mountSession(session);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz mapę świata" }));
    fireEvent.click(screen.getByRole("button", { name: "Idź do Mio · Kupczyni" }));
    ui.advance(() => session.dialogue === "merchant");
    fireEvent.click(screen.getByRole("button", { name: /Przeglądaj towary kupca/ }));
    expect(screen.getByRole("dialog", { name: "Sklep kupca" })).toBeVisible();
    const row = screen.getByRole("article", { name: item.name });
    fireEvent.click(within(row).getByRole("button", { name: /Kup/ }));
    expect(session.player.bagItems[item.id]).toBe(1);
    expect(session.player.gold).toBe(200);
  });

  it("kupiec: panel sprzedaży oferuje przedmioty z torby", () => {
    const session = new GameSession();
    ensurePlayerEquipment(session.player);
    const item = ITEM_CATALOG.find((i) => isShopItem(i) && !(i.id in ITEMS))!;
    session.player.bagItems[item.id] = 2;
    const ui = mountSession(session);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz mapę świata" }));
    fireEvent.click(screen.getByRole("button", { name: "Idź do Mio · Kupczyni" }));
    ui.advance(() => session.dialogue === "merchant");
    fireEvent.click(screen.getByRole("button", { name: /Przeglądaj towary kupca/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Sprzedaj z torby/ }));
    const row = screen.getByRole("article", { name: item.name });
    fireEvent.click(within(row).getByRole("button", { name: /Sprzedaj/ }));
    expect(session.player.bagItems[item.id]).toBe(1);
  });

  it("kowal: warsztat wytwarza przedmiot z receptury forge, zużywając składniki i monety", () => {
    const session = new GameSession();
    ensurePlayerEquipment(session.player);
    const recipe = CRAFTING_RECIPES.find((r) => r.station === "forge")!;
    session.player.level = Math.max(session.player.level, recipe.requiredLevel);
    session.player.gold = recipe.craftingCostCoins + 100;
    for (const ing of recipe.ingredients) {
      if (isMaterial(ing.itemId)) session.player.materials[ing.itemId] = ing.count;
      else session.player.bagItems[ing.itemId] = ing.count;
    }
    session.dialogue = "smith";
    mountSession(session);
    fireEvent.click(screen.getByRole("button", { name: /Otwórz warsztat kowalski/ }));
    expect(screen.getByRole("dialog", { name: "Crafting" })).toBeVisible();
    const row = screen.getByRole("article", { name: recipe.name });
    fireEvent.click(within(row).getByRole("button", { name: /Wytwórz/ }));
    const got =
      (session.player.bagItems[recipe.resultItemId] ?? 0) +
      ((session.player.items as Record<string, number>)[recipe.resultItemId] ?? 0);
    expect(got).toBeGreaterThanOrEqual(recipe.resultCount);
    expect(session.player.gold).toBe(100);
  });

  it("kowal: przycisk Wytwórz jest zablokowany bez składników", () => {
    const session = new GameSession();
    ensurePlayerEquipment(session.player);
    const recipe = CRAFTING_RECIPES.find((r) => r.station === "forge")!;
    session.player.level = Math.max(session.player.level, recipe.requiredLevel);
    session.player.gold = recipe.craftingCostCoins + 100;
    session.dialogue = "smith";
    mountSession(session);
    fireEvent.click(screen.getByRole("button", { name: /Otwórz warsztat kowalski/ }));
    const row = screen.getByRole("article", { name: recipe.name });
    expect(within(row).getByRole("button", { name: /Wytwórz/ })).toBeDisabled();
  });
});
