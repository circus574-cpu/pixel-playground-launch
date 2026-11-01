import { getItemById } from "../../items";
import type { DevelopmentState } from "../state";
export type WeaponOwner = {
  weapon: string | null;
  upgrade: number;
  development?: DevelopmentState | undefined;
};
export const personalWeaponAttack = (stage: number) => 6 + stage * 2;
export function equippedAttack(p: WeaponOwner): number {
  if (p.weapon === "sword") return 8 + p.upgrade * 4;
  if (p.weapon === "heritage") {
    const w = p.development?.heritage.weapon;
    return w?.location === "bag" ? personalWeaponAttack(w.stage) : 0;
  }
  if (p.weapon) {
    const item = getItemById(p.weapon);
    if (item?.stats?.atkBonus) return item.stats.atkBonus;
  }
  return 0;
}
export function equippedName(p: WeaponOwner): string {
  if (p.weapon === "heritage") {
    return p.development?.heritage.weapon?.name ?? "Broń dziedzictwa";
  }
  if (p.weapon === "sword") {
    return "Ostrze strażnika" + (p.upgrade ? " +1" : "");
  }
  if (p.weapon) {
    const item = getItemById(p.weapon);
    if (item) return item.name;
    return p.weapon;
  }
  return "brak";
}
export function weaponConsistent(
  p: WeaponOwner & { items: { sword: number } },
  owner: string,
): boolean {
  const w = p.development?.heritage.weapon;
  return (
    (p.weapon !== "sword" || p.items.sword > 0) &&
    (p.weapon !== "heritage" || (!!w && w.location === "bag")) &&
    (!w || w.owner === owner)
  );
}
