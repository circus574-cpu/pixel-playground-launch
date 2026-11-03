import { getItemById } from "./index";

/** The eight equipment slots of a character, in the order the admin panel shows them. */
export const EQUIPMENT_SLOTS = [
  "head",
  "weapon",
  "armor",
  "offhand",
  "hands",
  "ring",
  "amulet",
  "feet",
] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

/** Catalogue `slot` values that may be worn in each equipment slot. */
const CATALOG_SLOT: Record<EquipmentSlot, string> = {
  head: "helmet",
  weapon: "weapon",
  armor: "armor",
  offhand: "shield",
  hands: "gloves",
  ring: "ring",
  amulet: "amulet",
  feet: "boots",
};

/** The classic starter items that can be equipped, with the slot they belong to. */
const CLASSIC_SLOT: Record<string, EquipmentSlot> = { sword: "weapon", vest: "armor" };

export function isEquipmentSlot(slot: string): slot is EquipmentSlot {
  return (EQUIPMENT_SLOTS as readonly string[]).includes(slot);
}

/** True only when the item is a real piece of gear made for exactly this slot. */
export function itemFitsSlot(slot: string, itemId: string): boolean {
  if (!isEquipmentSlot(slot)) return false;
  const classic = CLASSIC_SLOT[itemId];
  if (classic) return classic === slot;
  const item = getItemById(itemId);
  return !!item && item.slot === CATALOG_SLOT[slot];
}
