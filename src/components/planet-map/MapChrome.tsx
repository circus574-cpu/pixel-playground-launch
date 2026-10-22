/**
 * Shared game link for both atlas views (2D and 3D): back control, "you are here"
 * chip and the region note. `current` is the continent of the active character;
 * the views only read it, they never write saves.
 */
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CONTINENTS, type MapRegion } from "./mapData";

export type GameLink = {
  /** Continent of the active character (verdant/aether/nexus/pyra), if any. */
  current?: string | null | undefined;
  /** Opened from inside the game: close the overlay instead of navigating. */
  onClose?: (() => void) | undefined;
};

export const GAME_CONTINENTS = ["verdant", "aether", "nexus", "pyra"] as const;

export function currentContinent(current: GameLink["current"]) {
  return CONTINENTS.find((c) => c.id === current) ?? null;
}

export function BackToGame({ onClose }: Pick<GameLink, "onClose">) {
  if (onClose)
    return (
      <button type="button" className="pm-back" onClick={onClose} aria-label="Wróć do gry">
        <ArrowLeft aria-hidden size={16} />
        <span>Gra</span>
      </button>
    );
  return (
    <Link to="/" className="pm-back" aria-label="Wróć do gry">
      <ArrowLeft aria-hidden size={16} />
      <span>Gra</span>
    </Link>
  );
}

export function PlayerChip({ current, globe }: Pick<GameLink, "current"> & { globe?: boolean }) {
  const here = currentContinent(current);
  return (
    <p className={`pm-demo-chip${globe ? " pg-chip" : ""}${here ? " is-here" : ""}`} role="note">
      {here ? (
        <>
          <strong>Tu jesteś</strong> · {here.name} · {here.settlement}
        </>
      ) : (
        <>
          <strong>Atlas</strong> · wybierz postać w grze, aby zobaczyć swoją krainę
        </>
      )}
    </p>
  );
}

export function RegionGameNote({ region, current, onClose }: GameLink & { region: MapRegion }) {
  if (!(GAME_CONTINENTS as readonly string[]).includes(region.id)) return null;
  if (region.id === current)
    return (
      <p className="pm-here-note">
        <strong>Tu jesteś.</strong> Twoja postać przebywa w tej krainie — {region.settlement}.
      </p>
    );
  if (onClose)
    return (
      <p className="pm-here-note">
        Kraina rasy <strong>{region.people}</strong>. Aby tu zagrać, wybierz lub utwórz postać tej
        rasy w menu postaci.
      </p>
    );
  return (
    <Link to="/" search={{ continent: region.id } as never} className="pm-enter-world">
      Wejdź do gry — {region.name}
    </Link>
  );
}
