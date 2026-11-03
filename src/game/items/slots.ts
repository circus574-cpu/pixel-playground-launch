import { getSlotForItem } from "../session";

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

export function isEquipmentSlot(slot: string): slot is EquipmentSlot {
  return (EQUIPMENT_SLOTS as readonly string[]).includes(slot);
}

/**
 * True only when the game itself would wear this item in exactly this slot. It delegates to
 * `getSlotForItem`, the rule the in-game "equip" command uses, so the admin panel and the server
 * can never allow or forbid something the game treats differently.
 */
export function itemFitsSlot(slot: string, itemId: string): boolean {
  return isEquipmentSlot(slot) && getSlotForItem(itemId) === slot;
}
