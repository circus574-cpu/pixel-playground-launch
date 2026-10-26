/**
 * Walka: the monsters within reach, nearest first, with name, level and health. Tapping one makes it
 * the target, so the basic attack and every skill aim at it (owner 26.10.2026).
 */
import type { GameViewState } from "../../game/session";
import type { SendCommand } from "./AdventurePanels";

export function CombatPanel({ state, send }: { state: GameViewState; send: SendCommand }) {
  if (!state.foes.length) return null;
  return (
    <section className="ki-combat" aria-label="Walka">
      <h3>Walka</h3>
      <ul>
        {state.foes.map((f) => {
          const pct = Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100));
          const selected = state.targetId === f.id;
          return (
            <li key={f.id}>
              <button
                type="button"
                className={
                  "ki-combat-foe" + (selected ? " is-target" : "") + (f.boss ? " is-boss" : "")
                }
                aria-pressed={selected}
                aria-label={`${f.name}, poziom ${f.level}, ${f.hp} z ${f.maxHp} życia`}
                onClick={() => send({ type: "target", id: f.id })}
              >
                <span className="ki-combat-name">
                  {selected && <b aria-hidden>◆ </b>}
                  {f.name}
                  <small> · {f.level}</small>
                </span>
                <span className="ki-combat-hp" aria-hidden>
                  <i style={{ width: pct + "%" }} />
                  <em>
                    {f.hp} / {f.maxHp}
                  </em>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
