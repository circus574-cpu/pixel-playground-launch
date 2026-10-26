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
import { type SendCommand } from "./AdventurePanels";

/** Painted item icons (GPU, public/game/icons-v2); every slot and bag item has one. */
function ItemIcon({ item }: { item: string }) {
  return <img className="ki-dinv-icon" src={`/game/icons-v2/${item}.webp`} alt="" aria-hidden />;
}

const BAG_CELLS = 40;
/** Slots without items in the game yet are shown locked so the layout stays complete. */
const SLOTS = [
  { id: "head", label: "Hełm", area: "head", icon: "helmet" },
  { id: "weapon", label: "Broń", area: "weapon", icon: "sword" },
  { id: "armor", label: "Pancerz", area: "chest", icon: "vest" },
  { id: "offhand", label: "Tarcza", area: "offhand", icon: "shield" },
  { id: "hands", label: "Rękawice", area: "hands", icon: "gloves" },
  { id: "ring", label: "Pierścień", area: "ring", icon: "ring" },
  { id: "amulet", label: "Amulet", area: "amulet", icon: "amulet" },
  { id: "feet", label: "Buty", area: "feet", icon: "boots" },
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
                <>
                  <img
                    className="ki-dinv-icon ki-dinv-ghost-icon"
                    src={`/game/icons-v2/${slot.icon}.webp`}
                    alt=""
                    aria-hidden
                  />
                  <span className="ki-dinv-ghost">{slot.label}</span>
                </>
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
                {entry.kind === "item" ? <ItemIcon item={entry.id} /> : <ItemIcon item="tusk" />}
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
