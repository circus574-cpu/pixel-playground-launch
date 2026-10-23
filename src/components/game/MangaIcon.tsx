import type { CSSProperties } from "react";

/** Cell positions in the hand-painted 4 × 3 atlas. Item artwork keeps its own atlas. */
export type MangaSymbol =
  | "attack"
  | "slash"
  | "energy"
  | "shield"
  | "potion"
  | "inventory"
  | "journal"
  | "skills"
  | "settings"
  | "map"
  | "chat"
  | "exit";
const cells: Record<MangaSymbol, number> = {
  attack: 0,
  slash: 1,
  energy: 2,
  shield: 3,
  potion: 4,
  inventory: 5,
  journal: 6,
  skills: 7,
  settings: 8,
  map: 9,
  chat: 10,
  exit: 11,
};
export function MangaIcon({ symbol }: { symbol: MangaSymbol }) {
  const cell = cells[symbol];
  return (
    <span
      aria-hidden="true"
      className="ki-manga-icon"
      style={
        {
          backgroundPosition: `${((cell % 4) * 100) / 3}% ${Math.floor(cell / 4) * 50}%`,
        } as CSSProperties
      }
    />
  );
}
