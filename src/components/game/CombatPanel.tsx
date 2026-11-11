/**
 * Walka: the monsters within reach, nearest first, with name, level and health. Tapping one makes it
 * the target, so the basic attack and every skill aim at it (owner 26.10.2026).
 */
import { memo } from "react";
import type { GameViewState } from "../../game/session";
import type { SendCommand } from "./AdventurePanels";
import { gpuIcon } from "./gpuIcons";

function CombatPanelImpl({ state, send }: { state: GameViewState; send: SendCommand }) {
  if (!state.foes.length) return null;
  return (
    <section className="ki-combat" aria-label="Walka">
      <h3>
        {gpuIcon("hud-combat") && (
          <img className="ki-combat-icon" src={gpuIcon("hud-combat")} alt="" aria-hidden />
        )}
        Walka
      </h3>
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
                  {selected &&
                    (gpuIcon("hud-target") ? (
                      <img
                        className="ki-combat-icon"
                        src={gpuIcon("hud-target")}
                        alt=""
                        aria-hidden
                      />
                    ) : (
                      <b aria-hidden>◆ </b>
                    ))}
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

/**
 * Faza 2 (memo HUD): panel walki zależy tylko od listy wrogów (id, hp, maxHp, poziom, nazwa, boss)
 * i celu. Snapshot tworzy nowe obiekty co 10×/s, ale gdy HP wrogów i cel się nie zmieniają,
 * porównanie treści pomija re-render. W walce HP się zmienia, więc panel aktualizuje się na bieżąco.
 */
export const CombatPanel = memo(CombatPanelImpl, (a, b) => {
  if (a.send !== b.send || a.state.targetId !== b.state.targetId) return false;
  const fa = a.state.foes,
    fb = b.state.foes;
  if (fa.length !== fb.length) return false;
  for (let i = 0; i < fa.length; i++) {
    const x = fa[i]!,
      y = fb[i]!;
    if (
      x.id !== y.id ||
      x.hp !== y.hp ||
      x.maxHp !== y.maxHp ||
      x.level !== y.level ||
      x.name !== y.name ||
      x.boss !== y.boss
    )
      return false;
  }
  return true;
});
