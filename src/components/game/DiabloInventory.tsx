/**
 * Inventory in the classic action-RPG layout (preview switch ?ki-world-v2=1): the hero in the
 * centre with equipment slots around, a bag grid beside. Uses the existing commands only
 * (equip / use via "equip", unequip), so saves and rules are unchanged.
 */
import { useState } from "react";
import originArt from "../../game/world/origin-art.json";
import {
  ITEMS,
  ITEM_IDS,
  MATERIALS,
  xpNeeded,
  type GameViewState,
  type ItemId,
} from "../../game/session";
import { ItemIcon, type SendCommand } from "./AdventurePanels";

const BAG_CELLS = 40;
/** Slots without items in the game yet are shown locked so the layout stays complete. */
const SLOTS = [
  { id: "head", label: "Hełm", area: "head" },
  { id: "weapon", label: "Broń", area: "weapon" },
  { id: "armor", label: "Pancerz", area: "chest" },
  { id: "offhand", label: "Tarcza", area: "offhand" },
  { id: "hands", label: "Rękawice", area: "hands" },
  { id: "ring", label: "Pierścień", area: "ring" },
  { id: "amulet", label: "Amulet", area: "amulet" },
  { id: "feet", label: "Buty", area: "feet" },
] as const;

type BagEntry =
  { kind: "item"; id: ItemId; count: number } | { kind: "material"; id: string; count: number };

function describe(entry: BagEntry) {
  if (entry.kind === "material")
    return {
      name: MATERIALS[entry.id]?.name ?? entry.id,
      info: "Materiał · sprzedaż " + (MATERIALS[entry.id]?.sell ?? 0) + " monet",
    };
  const item = ITEMS[entry.id];
  return {
    name: item.name,
    info: item.attack
      ? "+" + item.attack + " ataku · broń"
      : item.defense
        ? "+" + item.defense + " obrony · pancerz"
        : entry.id === "potion"
          ? "Przywraca do 65 HP · kliknij, aby wypić"
          : "Materiał · sprzedaż " + item.sell + " monet",
  };
}

export function DiabloInventory({ state, send }: { state: GameViewState; send: SendCommand }) {
  const p = state.player;
  const [focus, setFocus] = useState<BagEntry | null>(null);
  const bag: BagEntry[] = [
    ...ITEM_IDS.filter((id) => p.items[id] > 0 && p.weapon !== id && p.armor !== id).map((id) => ({
      kind: "item" as const,
      id,
      count: p.items[id],
    })),
    ...Object.entries(p.materials).map(([id, count]) => ({ kind: "material" as const, id, count })),
  ];
  const equipped = (slot: string): ItemId | null =>
    slot === "weapon" ? p.weapon : slot === "armor" ? p.armor : null;
  const shown = focus ?? (p.weapon ? { kind: "item" as const, id: p.weapon, count: 1 } : null);
  return (
    <div className="ki-dinv">
      <section className="ki-dinv-doll" aria-label="Postać i wyposażenie">
        <img
          className="ki-dinv-hero"
          src={originArt[p.race].preview}
          alt=""
          width={480}
          height={580}
        />
        {SLOTS.map((slot) => {
          const item = equipped(slot.id);
          const locked = slot.id !== "weapon" && slot.id !== "armor";
          return (
            <button
              key={slot.id}
              className={
                "ki-dinv-slot ki-dinv-" +
                slot.area +
                (item ? " is-filled" : "") +
                (locked ? " is-locked" : "")
              }
              aria-label={
                slot.label +
                (item ? ": " + ITEMS[item].name + " — zdejmij" : locked ? " (wkrótce)" : ": puste")
              }
              title={slot.label + (item ? " · " + ITEMS[item].name : "")}
              disabled={!item}
              onClick={() => item && send({ type: "unequip", slot: slot.id as "weapon" | "armor" })}
              onMouseEnter={() => item && setFocus({ kind: "item", id: item, count: 1 })}
            >
              {item ? (
                <ItemIcon item={item} />
              ) : (
                <span className="ki-dinv-ghost">{slot.label}</span>
              )}
              {item && slot.id === "weapon" && p.upgrade > 0 && (
                <b className="ki-dinv-plus">+{p.upgrade}</b>
              )}
            </button>
          );
        })}
      </section>
      <section className="ki-dinv-side">
        <div className="ki-dinv-stats">
          <span>
            Poziom <b>{p.level}</b>
          </span>
          <span>
            Atak <b>{state.stats.attack}</b>
          </span>
          <span>
            Obrona <b>{state.stats.defense}</b>
          </span>
          <span>
            HP{" "}
            <b>
              {p.hp}/{state.stats.maxHp}
            </b>
          </span>
          <span className="ki-dinv-xp">
            <i style={{ width: Math.min(100, (100 * p.xp) / xpNeeded(p.level)) + "%" }} />
            XP {p.xp}/{xpNeeded(p.level)}
          </span>
        </div>
        <div className="ki-dinv-bag" role="grid" aria-label="Torba">
          {Array.from({ length: BAG_CELLS }, (_, i) => {
            const entry = bag[i];
            if (!entry) return <span key={i} className="ki-dinv-cell" aria-hidden />;
            const d = describe(entry);
            const usable =
              entry.kind === "item" &&
              entry.id !== "tusk" &&
              !(entry.id === "potion" && (p.hp >= state.stats.maxHp || state.potion.remaining > 0));
            return (
              <button
                key={i}
                className="ki-dinv-cell is-filled"
                title={d.name + " — " + d.info}
                aria-label={d.name + " ×" + entry.count + (usable ? " — użyj lub załóż" : "")}
                onMouseEnter={() => setFocus(entry)}
                onFocus={() => setFocus(entry)}
                onClick={() => {
                  setFocus(entry);
                  if (usable && entry.kind === "item") send({ type: "equip", item: entry.id });
                }}
              >
                {entry.kind === "item" ? (
                  <ItemIcon item={entry.id} />
                ) : (
                  <span
                    aria-hidden="true"
                    className="ki-icon ki-item-icon"
                    style={{ backgroundPosition: "100% 50%" }}
                  />
                )}
                {entry.count > 1 && <b>{entry.count}</b>}
              </button>
            );
          })}
        </div>
        <div className="ki-dinv-tooltip" aria-live="polite">
          {shown ? (
            <>
              <strong>{describe(shown).name}</strong>
              <small>{describe(shown).info}</small>
            </>
          ) : (
            <small>Dotknij przedmiotu, aby zobaczyć opis. Kliknij, aby założyć lub użyć.</small>
          )}
        </div>
        <div className="ki-dinv-gold">
          <span aria-hidden>◉</span> {p.gold} monet
        </div>
      </section>
    </div>
  );
}
