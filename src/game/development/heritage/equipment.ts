import type { DevelopmentState } from "../state";
export type WeaponOwner = {
  weapon: "sword" | "heritage" | null;
  upgrade: number;
  development?: DevelopmentState | undefined;
};
export const personalWeaponAttack = (stage: number) => 6 + stage * 2;
export function equippedAttack(p: WeaponOwner): number {
  if (p.weapon === "sword") return 8 + p.upgrade * 4;
  const w = p.development?.heritage.weapon;
  return p.weapon === "heritage" && w?.location === "bag" ? personalWeaponAttack(w.stage) : 0;
}
export function equippedName(p: WeaponOwner): string {
  return p.weapon === "heritage"
    ? (p.development?.heritage.weapon?.name ?? "Broń dziedzictwa")
    : p.weapon === "sword"
      ? "Ostrze strażnika" + (p.upgrade ? " +1" : "")
      : "brak";
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
