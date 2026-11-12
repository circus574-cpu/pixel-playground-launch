import { useMemo, useState } from "react";
import { ITEM_CATALOG, getItemById } from "../../game/items";
import { isShopItem, shopPrice } from "../../game/items/loot";
import type { GameViewState } from "../../game/session";
import type { SendCommand } from "./AdventurePanels";

const RARITY_LABEL: Record<string, string> = {
  common: "zwykły",
  uncommon: "niepospolity",
  rare: "rzadki",
  epic: "epicki",
  legendary: "legendarny",
};

const CATEGORY_LABEL: Record<string, string> = {
  consumable: "Zużywalne",
  weapon: "Broń",
  armor: "Pancerze",
  helmet: "Hełmy",
  gloves: "Rękawice",
  boots: "Buty",
  legs: "Nogawice",
  shield: "Tarcze",
  accessory: "Akcesoria",
  amulet: "Amulety",
  ring: "Pierścienie",
  artifact: "Artefakty",
  buff: "Buffy",
  tool: "Narzędzia",
};

/** Cena skupu przedmiotu katalogowego — zgodna z gałęzią sprzedaży V2 w GameSession. */
export function catalogSellPrice(id: string): number {
  const def = getItemById(id);
  if (!def) return 0;
  return def.price ? Math.max(1, Math.floor(def.price / 2)) : Math.max(5, (def.level || 1) * 8);
}

export function ShopV2Panel({
  state,
  send,
  onClose,
}: {
  state: GameViewState;
  send: SendCommand;
  onClose: () => void;
}) {
  const p = state.player;
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const shopItems = useMemo(() => ITEM_CATALOG.filter(isShopItem), []);
  const categories = useMemo(
    () => Array.from(new Set(shopItems.map((i) => i.category))).sort(),
    [shopItems],
  );

  const buyList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shopItems
      .filter((i) => category === "all" || i.category === category)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
  }, [shopItems, query, category]);

  const sellList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(p.bagItems ?? {})
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ id, n, def: getItemById(id) }))
      .filter((x) => x.def)
      .filter((x) => !q || x.def!.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q));
  }, [p.bagItems, query]);

  return (
    <div className="ki-modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Sklep kupca"
        className="ki-modal ki-frame ki-shop-panel"
      >
        <header>
          <h2>Kupiec · towary</h2>
          <button autoFocus aria-label="Zamknij sklep" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="ki-adventure-panel">
          <p>
            <strong>{p.gold} monet</strong>. Kupiec oferuje tylko słabe przedmioty (zwykłe i
            niepospolite) po wygórowanej cenie. Lepszy sprzęt wytworzysz w craftingu.
          </p>
          <div className="ki-craft-stations" role="tablist" aria-label="Sklep">
            <button
              role="tab"
              aria-selected={tab === "buy"}
              className={tab === "buy" ? "is-active" : ""}
              onClick={() => setTab("buy")}
            >
              Kup ({shopItems.length})
            </button>
            <button
              role="tab"
              aria-selected={tab === "sell"}
              className={tab === "sell" ? "is-active" : ""}
              onClick={() => setTab("sell")}
            >
              Sprzedaj z torby ({sellList.length})
            </button>
          </div>
          <input
            type="search"
            value={query}
            placeholder="Szukaj przedmiotu…"
            aria-label="Szukaj przedmiotu"
            onChange={(e) => setQuery(e.target.value)}
            className="ki-craft-search"
          />
          {tab === "buy" && (
            <select
              value={category}
              aria-label="Filtr kategorii"
              onChange={(e) => setCategory(e.target.value)}
              className="ki-craft-search"
            >
              <option value="all">Wszystkie kategorie</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c] ?? c}
                </option>
              ))}
            </select>
          )}
          <div className="ki-craft-list">
            {tab === "buy" &&
              buyList.map((i) => {
                const price = shopPrice(i);
                const owned = p.bagItems?.[i.id] ?? 0;
                return (
                  <article key={i.id} className="ki-item-row" aria-label={i.name}>
                    <div>
                      <strong>{i.name}</strong>
                      <small>
                        {RARITY_LABEL[i.rarity] ?? i.rarity} ·{" "}
                        {CATEGORY_LABEL[i.category] ?? i.category}
                        {i.level ? ` · poz. ${i.level}` : ""} · masz: {owned}
                      </small>
                    </div>
                    <div className="ki-trade-actions">
                      <button
                        disabled={p.gold < price}
                        onClick={() => send({ type: "trade", item: i.id, buy: true })}
                      >
                        Kup · {price}
                      </button>
                    </div>
                  </article>
                );
              })}
            {tab === "buy" && buyList.length === 0 && <p>Brak przedmiotów dla tego filtra.</p>}
            {tab === "sell" &&
              sellList.map(({ id, n, def }) => (
                <article key={id} className="ki-item-row" aria-label={def!.name}>
                  <div>
                    <strong>{def!.name}</strong>
                    <small>
                      {RARITY_LABEL[def!.rarity] ?? def!.rarity} · masz: {n}
                    </small>
                  </div>
                  <div className="ki-trade-actions">
                    <button onClick={() => send({ type: "trade", item: id, buy: false })}>
                      Sprzedaj · {catalogSellPrice(id)}
                    </button>
                  </div>
                </article>
              ))}
            {tab === "sell" && sellList.length === 0 && (
              <p>Twoja torba nie ma przedmiotów z katalogu do sprzedaży.</p>
            )}
          </div>
          <p className="ki-panel-caption">
            Rozmowa zatrzymuje lokalną symulację. Zamknij okno, aby wrócić do gry.
          </p>
          <button onClick={onClose}>Wróć do rozmowy</button>
        </div>
      </section>
    </div>
  );
}
