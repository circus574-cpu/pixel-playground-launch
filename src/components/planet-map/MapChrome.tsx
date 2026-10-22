/**
 * Shared game link for both atlas views (2D and 3D): back control, "you are here"
 * chip and the region note. `current` is the continent of the active character;
 * the views only read it, they never write saves.
 */
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CONTINENTS, ZONE_DIR_NAMES, zonesOf, type MapRegion } from "./mapData";

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

/** Must equal SAVE_KEY in src/game/session.ts (checked by a unit test). */
export const GAME_SAVE_KEY = "ki-legends:adventure:v1";

/** Read-only: continent of the active character slot, without loading game code. */
export function readActiveContinent(storage: Pick<Storage, "getItem"> | null) {
  try {
    const id = storage?.getItem(GAME_SAVE_KEY + ":active-character");
    if (!id) return null;
    const raw = storage?.getItem(GAME_SAVE_KEY + ":character:" + id);
    if (!raw) return null;
    const continent = (JSON.parse(raw) as { player?: { continent?: unknown } }).player?.continent;
    const value = typeof continent === "string" ? continent : "verdant";
    return (GAME_CONTINENTS as readonly string[]).includes(value) ? value : null;
  } catch {
    return null;
  }
}

/** The four zones around a continent's city, as listed in the region panel. */
export function ZoneList({ region }: { region: MapRegion }) {
  const zones = zonesOf(region.id);
  if (!zones.length) return null;
  return (
    <ul className="pm-zones" aria-label={`Strefy regionu ${region.name}`}>
      {zones.map((z) => (
        <li key={z.id}>
          <strong>
            {ZONE_DIR_NAMES[z.dir]} · {z.name}
          </strong>
          <span>{z.summary}</span>
        </li>
      ))}
    </ul>
  );
}
