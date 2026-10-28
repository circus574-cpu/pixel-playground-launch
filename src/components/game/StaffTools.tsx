/**
 * In-game tools of a special administrator / game-master character (state.staff). The session
 * ignores these commands for every other character, so the panel is only a convenience.
 */
import { useState } from "react";
import type { GameViewState } from "../../game/session";
import { v2Places } from "../../game/worlds/v2Places";
import { WORLD_V2 } from "../../game/world/generated/worldVersion";
import type { SendCommand } from "./AdventurePanels";

type Destination = { id: string; name: string };

export function StaffTools({
  state,
  send,
  continents,
  current,
  onTravel,
  style,
}: {
  /** Player-arranged offset (controls editor, `controls.buttons.gm`). */
  style?: Record<string, string> | undefined;
  state: GameViewState;
  send: SendCommand;
  continents: Destination[];
  current: string | undefined;
  onTravel: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: "", y: "" });
  if (!state.staff) return null;
  const places = WORLD_V2 ? v2Places(state.player.continent) : undefined;
  const groups: [string, { name: string; x: number; y: number }[]][] = places
    ? [
        ["Miasta", Object.values(places.cities)],
        ["Słynne miejsca", Object.values(places.famousById)],
        ["Ukryte miejsca", Object.values(places.hidden)],
      ]
    : [];
  const teleport = (x: number, y: number) => send({ type: "staff", action: "teleport", x, y });
  return (
    <div className="ki-staff" data-ability="gm" aria-label="GM" style={style}>
      <button
        className="ki-staff-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={state.staff === "admin" ? "Narzędzia administratora" : "Narzędzia game mastera"}
      >
        {state.staff === "admin" ? "ADM" : "GM"}
      </button>
      {open && (
        <section className="ki-staff-panel" aria-label="Narzędzia postaci specjalnej">
          <header>
            <b>{state.staff === "admin" ? "Administrator" : "Game master"}</b>
            <small>
              {Math.round(state.x)}, {Math.round(state.y)}
            </small>
          </header>
          <div className="ki-staff-row">
            <button onClick={() => send({ type: "staff", action: "heal" })}>Lecz</button>
            <button aria-pressed={state.god} onClick={() => send({ type: "staff", action: "god" })}>
              Nieśmiertelność {state.god ? "✓" : ""}
            </button>
            <button onClick={() => send({ type: "staff", action: "level" })}>+1 poziom</button>
            <button onClick={() => send({ type: "staff", action: "gold" })}>+1000 monet</button>
            <button onClick={() => send({ type: "staff", action: "potions" })}>+10 mikstur</button>
          </div>
          <h4>Teleport na współrzędne</h4>
          <form
            className="ki-staff-row"
            onSubmit={(e) => {
              e.preventDefault();
              const x = Number(coords.x),
                y = Number(coords.y);
              if (Number.isFinite(x) && Number.isFinite(y)) teleport(x, y);
            }}
          >
            <input
              aria-label="X"
              inputMode="numeric"
              placeholder="X"
              value={coords.x}
              onChange={(e) => setCoords({ ...coords, x: e.target.value })}
            />
            <input
              aria-label="Y"
              inputMode="numeric"
              placeholder="Y"
              value={coords.y}
              onChange={(e) => setCoords({ ...coords, y: e.target.value })}
            />
            <button type="submit">Teleport</button>
          </form>
          {groups.map(([title, list]) => (
            <details key={title}>
              <summary>
                {title} ({list.length})
              </summary>
              <div className="ki-staff-list">
                {list.map((p) => (
                  <button key={p.name + p.x} onClick={() => teleport(p.x, p.y)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </details>
          ))}
          <details>
            <summary>Inne krainy ({continents.length - 1})</summary>
            <div className="ki-staff-list">
              {continents
                .filter((c) => c.id !== current)
                .map((c) => (
                  <button key={c.id} onClick={() => onTravel(c.id)}>
                    {c.name}
                  </button>
                ))}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
