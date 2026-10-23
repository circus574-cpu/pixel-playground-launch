import { MONSTERS } from "./catalog";

export const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export type Material = { id: string; name: string; sell: number; level: number };
/** Loot materials dropped by the 40 monsters. They are sold to the merchant; one stack holds up to 99. */
export const MATERIALS: Record<string, Material> = {};
for (const monster of MONSTERS)
  for (const entry of monster.loot) {
    const id = slug(entry.name);
    const existing = MATERIALS[id];
    if (!existing || monster.level < existing.level)
      MATERIALS[id] = {
        id,
        name: entry.name,
        level: monster.level,
        sell: Math.round(2 + monster.level * 1.5),
      };
  }
export const MATERIAL_IDS = Object.keys(MATERIALS);
export const isMaterial = (id: string): boolean => id in MATERIALS;
