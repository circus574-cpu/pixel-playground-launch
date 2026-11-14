import { useMemo, useState } from "react";
import {
  CRAFTING_RECIPES,
  getItemById,
  type CraftingRecipe,
  type CraftingStation,
} from "../../game/items";
import { MATERIALS, isMaterial } from "../../game/monsters/materials";
import type { Command, GameViewState } from "../../game/session";
import type { SendCommand } from "./AdventurePanels";

const STATIONS: { id: CraftingStation; label: string; desc: string }[] = [
  { id: "forge", label: "Kuźnia", desc: "Broń, pancerze i tarcze — kowal." },
  { id: "alchemy", label: "Alchemia", desc: "Mikstury i eliksiry — alchemik." },
  { id: "runic", label: "Runy", desc: "Amulety, pierścienie, artefakty i buffy." },
  { id: "cyber_fabricator", label: "Fabrykator", desc: "Narzędzia i urządzenia Nexus-9." },
  { id: "projekt_ksiegi", label: "Księgi", desc: "Receptury z Księgi Zrozumienia." },
];

const RARITY_LABEL: Record<string, string> = {
  common: "zwykły",
  uncommon: "niepospolity",
  rare: "rzadki",
  epic: "epicki",
  legendary: "legendarny",
};

function ingredientHave(p: GameViewState["player"], itemId: string): number {
  return isMaterial(itemId) ? (p.materials[itemId] ?? 0) : (p.bagItems?.[itemId] ?? 0);
}

function ingredientName(itemId: string): string {
  return isMaterial(itemId)
    ? (MATERIALS[itemId]?.name ?? itemId)
    : (getItemById(itemId)?.name ?? itemId);
}

export function recipeReady(p: GameViewState["player"], r: CraftingRecipe): boolean {
  if (p.level < r.requiredLevel) return false;
  if (p.gold < r.craftingCostCoins) return false;
  return r.ingredients.every((ing) => ingredientHave(p, ing.itemId) >= ing.count);
}

export function CraftingPanel({
  authoritative = false,
  state,
  send,
  initialStation = "forge",
  onClose,
}: {
  authoritative?: boolean;
  state: GameViewState;
  send: SendCommand;
  initialStation?: CraftingStation;
  onClose: () => void;
}) {
  const p = state.player;
  const [station, setStation] = useState<CraftingStation>(initialStation);
  const [query, setQuery] = useState("");

  const recipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CRAFTING_RECIPES.filter((r) => r.station === station).filter((r) => {
      if (!q) return true;
      const result = getItemById(r.resultItemId);
      return (
        r.name.toLowerCase().includes(q) ||
        (result?.name ?? "").toLowerCase().includes(q) ||
        r.resultItemId.toLowerCase().includes(q)
      );
    });
  }, [station, query]);

  const active = STATIONS.find((s) => s.id === station)!;

  return (
    <div className="ki-modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Crafting"
        data-race={p.race}
        className="ki-modal ki-frame ki-crafting-panel"
      >
        <header>
          <h2>Wytwarzanie · {active.label}</h2>
          <button autoFocus aria-label="Zamknij crafting" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="ki-adventure-panel">
          <p>
            Poziom <strong>{p.level}</strong> · <strong>{p.gold} monet</strong>. Lepszy sprzęt
            (rzadki, epicki, legendarny) powstaje wyłącznie tutaj — z materiałów i monet.
          </p>
          <div className="ki-craft-stations" role="tablist" aria-label="Stacje craftingu">
            {STATIONS.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={s.id === station}
                className={s.id === station ? "is-active" : ""}
                onClick={() => setStation(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="ki-panel-caption">{active.desc}</p>
          <input
            type="search"
            value={query}
            placeholder="Szukaj receptury lub przedmiotu…"
            aria-label="Szukaj receptury"
            onChange={(e) => setQuery(e.target.value)}
            className="ki-craft-search"
          />
          <div className="ki-craft-list">
            {recipes.length === 0 && <p>Brak receptur dla tego filtra.</p>}
            {recipes.map((r) => {
              const result = getItemById(r.resultItemId);
              const ready = recipeReady(p, r);
              const lowLevel = p.level < r.requiredLevel;
              return (
                <article key={r.id} className="ki-item-row ki-craft-row" aria-label={r.name}>
                  <div className="ki-craft-info">
                    <strong>
                      {result?.name ?? r.resultItemId}
                      {r.resultCount > 1 ? ` ×${r.resultCount}` : ""}
                    </strong>
                    <small>
                      {result ? `${RARITY_LABEL[result.rarity] ?? result.rarity} · ` : ""}
                      wymagany poz. {r.requiredLevel}
                      {lowLevel ? " (za niski poziom)" : ""}
                    </small>
                    <ul className="ki-craft-ingredients">
                      {r.ingredients.map((ing) => {
                        const have = ingredientHave(p, ing.itemId);
                        const ok = have >= ing.count;
                        return (
                          <li key={ing.itemId} className={ok ? "is-ok" : "is-missing"}>
                            {ingredientName(ing.itemId)}: {have}/{ing.count}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="ki-trade-actions">
                    <button
                      disabled={!ready}
                      onClick={() => send({ type: "craft", recipe: r.id })}
                      title={ready ? "Wytwórz przedmiot" : "Brakuje poziomu, monet lub składników"}
                    >
                      Wytwórz · {r.craftingCostCoins} monet
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="ki-panel-caption">
            {authoritative
              ? "Rozmowa nie zatrzymuje czasu na serwerze. Zamknij okno, aby wrócić do gry."
              : "Rozmowa zatrzymuje lokalną symulację. Zamknij okno, aby wrócić do gry."}
          </p>
          <button onClick={onClose}>Wróć do rozmowy</button>
        </div>
      </section>
    </div>
  );
}
