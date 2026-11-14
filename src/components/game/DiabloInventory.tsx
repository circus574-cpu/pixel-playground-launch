import { equippedAttack, equippedName } from "../../game/development/heritage/equipment";
import { HeritageWeaponCard } from "./HeritageWeaponCard";
import { useState } from "react";
import originArt from "../../game/world/origin-art.json";
import {
  BAG_CELLS,
  ITEMS,
  ITEM_IDS,
  MATERIALS,
  xpNeeded,
  type GameViewState,
  type ItemId,
  type EquipmentSlot,
  type Player,
} from "../../game/session";
import { getItemById } from "../../game/items";
import { type SendCommand } from "./AdventurePanels";

export function getItemIconName(itemId: string): string {
  if (itemId in ITEMS) return itemId;
  const def = getItemById(itemId);
  if (!def) return "tusk";
  const slot = def.slot || def.category;
  switch (slot) {
    case "weapon":
      return "sword";
    case "armor":
      return "vest";
    case "helmet":
      return "helmet";
    case "gloves":
      return "gloves";
    case "boots":
      return "boots";
    case "shield":
      return "shield";
    case "ring":
      return "ring";
    case "amulet":
    case "accessory":
    case "artifact":
    case "buff":
      return "amulet";
    case "consumable":
      return "potion";
    default:
      if (slot.startsWith("artifact_")) return "amulet";
      return "tusk";
  }
}

/** Painted item icons (public/game/items/<id>.webp with fallback to public/game/icons-v2); every slot and bag item has one. */
function ItemIcon({ item }: { item: string }) {
  const fallbackIcon = getItemIconName(item);
  return (
    <img
      className="ki-dinv-icon"
      src={`/game/items/${item}.webp`}
      onError={(e) => {
        const target = e.currentTarget;
        const fallback = `/game/icons-v2/${fallbackIcon}.webp`;
        if (!target.src.endsWith(fallback)) {
          target.src = fallback;
        }
      }}
      alt=""
      aria-hidden
    />
  );
}

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
  | { kind: "item"; id: ItemId; count: number }
  | { kind: "material"; id: string; count: number }
  | { kind: "bagItem"; id: string; count: number };

interface ItemDescription {
  name: string;
  info: string;
}

function describe(entry: BagEntry): ItemDescription {
  if (entry.kind === "material") {
    const mat = MATERIALS[entry.id];
    return {
      name: mat?.name ?? entry.id,
      info: "Materiał · sprzedaż " + (mat?.sell ?? 0) + " monet",
    };
  }
  if (entry.kind === "item") {
    const item = ITEMS[entry.id];
    return {
      name: item.name,
      info: item.attack
        ? "+" + item.attack + " ataku · broń"
        : item.defense
          ? "+" + item.defense + " obrony · pancerz"
          : entry.id === "potion"
            ? "Przywraca 40% maks. HP · kliknij, aby wypić"
            : "Materiał · sprzedaż " + item.sell + " monet",
    };
  }
  const def = getItemById(entry.id);
  if (!def) return { name: entry.id, info: "Przedmiot w torbie" };

  const parts: string[] = [];
  if (def.level) parts.push(`Wym. poziom ${def.level}`);
  if (def.stats?.atkBonus) parts.push(`+${def.stats.atkBonus} ataku`);
  if (def.stats?.defBonus) parts.push(`+${def.stats.defBonus} obrony`);
  if (def.stats?.hpBonus) parts.push(`+${def.stats.hpBonus} HP`);
  if (def.stats?.kiBonus) parts.push(`+${def.stats.kiBonus} KI`);
  if (def.stats?.critChancePercent) parts.push(`+${def.stats.critChancePercent}% kryt`);
  if (def.stats?.moveSpeedPercent) parts.push(`+${def.stats.moveSpeedPercent}% szybkości`);
  if (def.buff?.value) parts.push(`Pasyw: +${def.buff.value}%`);
  if (def.setId) parts.push(`Zestaw: ${def.setId}`);
  if (def.category === "consumable") parts.push("Użyj, aby odzyskać siły");

  return {
    name: def.name,
    info: parts.length > 0 ? parts.join(" · ") : def.description,
  };
}

function describeEquipped(slotId: EquipmentSlot, itemId: string, p: Player): ItemDescription {
  if (slotId === "weapon" && itemId === "heritage") {
    return {
      name: equippedName(p),
      info: "Broń dziedzictwa · " + equippedAttack(p) + " ataku · kliknij, aby zdjąć",
    };
  }
  if (itemId in ITEMS) {
    const d = describe({ kind: "item", id: itemId as ItemId, count: 1 });
    return { name: d.name, info: d.info + " · kliknij, aby zdjąć" };
  }
  const def = getItemById(itemId);
  if (def) {
    const d = describe({ kind: "bagItem", id: itemId, count: 1 });
    const upg = p.equipmentUpgrades?.[slotId] ?? 0;
    const upgNote =
      upg > 0 ? ` · +${upg} (${slotId === "weapon" ? `+${upg * 2} ataku` : `+${upg} obrony`})` : "";
    return {
      name: upg > 0 ? `${d.name} +${upg}` : d.name,
      info: d.info + upgNote + " · kliknij, aby zdjąć",
    };
  }
  return { name: itemId, info: "Wyposażenie · kliknij, aby zdjąć" };
}

export function DiabloInventory({ state, send }: { state: GameViewState; send: SendCommand }) {
  const p = state.player;
  const [focusDesc, setFocusDesc] = useState<ItemDescription | null>(null);

  const bag: BagEntry[] = [
    ...ITEM_IDS.filter(
      (id) =>
        p.items[id] > 0 &&
        p.weapon !== id &&
        p.armor !== id &&
        p.equipment?.weapon !== id &&
        p.equipment?.armor !== id,
    ).map((id) => ({
      kind: "item" as const,
      id,
      count: p.items[id],
    })),
    ...Object.entries(p.bagItems ?? {})
      .filter(([id, count]) => count > 0 && !Object.values(p.equipment ?? {}).includes(id))
      .map(([id, count]) => ({
        kind: "bagItem" as const,
        id,
        count,
      })),
    ...Object.entries(p.materials)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({ kind: "material" as const, id, count })),
  ];

  const equipped = (slot: EquipmentSlot): string | null => {
    if (p.equipment?.[slot]) return p.equipment[slot];
    if (slot === "weapon") return p.weapon;
    if (slot === "armor") return p.armor;
    return null;
  };

  const defaultShown: ItemDescription | null = p.weapon
    ? describeEquipped("weapon", p.weapon, p)
    : null;
  const shown = focusDesc ?? defaultShown;

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
          const item = equipped(slot.id as EquipmentSlot);
          const personal = slot.id === "weapon" && p.weapon === "heritage";
          const desc = item ? describeEquipped(slot.id as EquipmentSlot, item, p) : null;
          const v2Upgrade =
            item && !(item in ITEMS) && item !== "heritage"
              ? (p.equipmentUpgrades?.[slot.id as EquipmentSlot] ?? 0)
              : 0;
          return (
            <button
              key={slot.id}
              className={
                "ki-dinv-slot ki-dinv-" + slot.area + (item || personal ? " is-filled" : "")
              }
              aria-label={
                slot.label + (desc ? ": " + desc.name + " — kliknij, aby zdjąć" : ": puste")
              }
              title={slot.label + (desc ? " · " + desc.name : ": puste")}
              disabled={!item && !personal}
              onClick={() =>
                (item || personal) && send({ type: "unequip", slot: slot.id as EquipmentSlot })
              }
              onMouseEnter={() => desc && setFocusDesc(desc)}
              onFocus={() => desc && setFocusDesc(desc)}
            >
              {personal ? (
                <ItemIcon item="sword" />
              ) : item ? (
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
              {item === "sword" && slot.id === "weapon" && p.upgrade > 0 && (
                <b className="ki-dinv-plus">+{p.upgrade}</b>
              )}
              {v2Upgrade > 0 && <b className="ki-dinv-plus">+{v2Upgrade}</b>}
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
              {Math.ceil(p.hp)}/{state.stats.maxHp}
            </b>
          </span>
          <span className="ki-dinv-xp">
            <i style={{ width: Math.min(100, (100 * p.xp) / xpNeeded(p.level)) + "%" }} />
            XP {p.xp}/{xpNeeded(p.level)}
          </span>
        </div>
        <HeritageWeaponCard state={state} send={send} />
        <div className="ki-dinv-bag" role="grid" aria-label="Torba">
          {Array.from({ length: BAG_CELLS }, (_, i) => {
            const entry = bag[i];
            if (!entry) return <span key={i} className="ki-dinv-cell" aria-hidden />;
            const d = describe(entry);
            const usable =
              entry.kind === "bagItem" ||
              (entry.kind === "item" &&
                entry.id !== "tusk" &&
                !(
                  entry.id === "potion" &&
                  (p.hp >= state.stats.maxHp || state.potion.remaining > 0)
                ));
            return (
              <button
                key={i}
                className="ki-dinv-cell is-filled"
                title={d.name + " — " + d.info}
                aria-label={d.name + " ×" + entry.count + (usable ? " — załóż lub użyj" : "")}
                onMouseEnter={() => setFocusDesc(d)}
                onFocus={() => setFocusDesc(d)}
                onClick={() => {
                  setFocusDesc(d);
                  if (usable) {
                    send({ type: "equip", item: entry.id });
                  }
                }}
              >
                <ItemIcon item={entry.id} />
                {entry.count > 1 && <b>{entry.count}</b>}
              </button>
            );
          })}
        </div>
        <div className="ki-dinv-tooltip" aria-live="polite">
          {shown ? (
            <>
              <strong>{shown.name}</strong>
              <small>{shown.info}</small>
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
