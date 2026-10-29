import type { GameViewState } from "../../game/mountGame";
import {
  TRAINABLE_STATS,
  TRAINABLE_NAMES,
  emptyCombatTraining,
  trainingRequirement,
  techniqueEffects,
  type TrainableStat,
} from "../../game/combatTraining";

const labels: Record<string, string> = {
  maxHp: "Maksymalne HP",
  maxKi: "Maksymalne KI",
  attack: "Atak",
  defense: "Obrona",
  speed: "Szybkość ruchu",
  kiRegen: "Regeneracja KI / s",
  crit: "Szansa krytyczna (%)",
  attackInterval: "Odstęp ataków (ms)",
  range: "Zasięg",
  dodgeChance: "Unik (%)",
  attackSpeedPct: "Premia szybkości ataku (%)",
  technique: "Technika",
};
const number = (v: number) => Number(v.toFixed(2)).toLocaleString("pl-PL");
export function CharacterStatsPanel({
  state,
  train,
}: {
  state: GameViewState;
  train: (stat: TrainableStat) => void;
}) {
  const training = state.player.combatTraining ?? emptyCombatTraining();
  const effects = techniqueEffects(state.stats.technique);
  return (
    <div style={{ padding: "12px", overflowY: "auto", maxHeight: "65dvh" }}>
      <p>Poziom {state.player.level}</p>
      <dl>
        {Object.entries(state.statBreakdown)
          .filter(([key]) => labels[key])
          .map(([key, row]) => {
            const overridden =
              state.player.statOverrides?.[
                key as keyof NonNullable<typeof state.player.statOverrides>
              ] !== undefined;
            const itemBonus = overridden ? 0 : row.items;
            return (
              <div
                key={key}
                data-stat={key}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid #ffffff20",
                }}
              >
                <dt>
                  <span>{labels[key]}</span>:
                </dt>
                <dd style={{ margin: 0 }}>
                  <strong>{number(row.total - itemBonus)}</strong>
                  {itemBonus !== 0 && (
                    <span
                      className="ki-item-stat-bonus"
                      style={{ color: "#ff6262", marginLeft: 6 }}
                    >
                      {itemBonus > 0 ? "+ " : "− "}
                      {number(Math.abs(itemBonus))}
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
      </dl>
      <p>Tempo ataku: {number(1000 / state.stats.attackInterval)} / s.</p>
      <p>
        Technika: +{number(effects.crit)} pkt proc. szansy krytycznej, +
        {number(effects.kiDamage * 100)}% obrażeń KI, {number(effects.resetChance)}% szansy
        ponowienia umiejętności bez odnowienia. Ponowienie nadal kosztuje KI; nie obejmuje
        transformacji i technik podtrzymywanych.
      </p>
      <h3>Trening</h3>
      <p>
        Dom Treningu: Unik — wykonuj uniki; szybkość ataku — uderzaj manekin podstawowym atakiem;
        Technika — trafiaj manekin zdolnościami. Maksymalnie jeden punkt ćwiczenia na sekundę, bez
        XP i monet.
      </p>
      {TRAINABLE_STATS.map((stat) => (
        <div key={stat} style={{ marginBottom: 12 }}>
          <div>
            {TRAINABLE_NAMES[stat]} · ranga {training[stat].rank}/100 · {training[stat].progress}/
            {trainingRequirement(training[stat].rank)}
          </div>
          <button
            disabled={state.player.interior !== "arena" || training[stat].rank >= 100}
            onClick={() => train(stat)}
          >
            Trenuj: {TRAINABLE_NAMES[stat]}
          </button>
        </div>
      ))}
      {state.player.interior !== "arena" && <p>Wejdź do Domu Treningu, aby rozpocząć ćwiczenia.</p>}
    </div>
  );
}
