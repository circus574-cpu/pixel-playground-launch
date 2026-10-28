import { useState } from "react";
import type { Command, GameViewState } from "../../game/session";
import { emptyDevelopment, MODULE_ENERGY } from "../../game/development/state";
import { MODULES, VARIANTS } from "../../game/development/modifiers";
import {
  DISCIPLINES,
  TRAINING_NAMES,
  examAvailable,
  examId,
  examTier,
  rankCost,
  rankUnavailable,
  type Discipline,
} from "../../game/development/training";
import { examInstructions, examSpec } from "../../game/development/exams";
import { MONSTER_BASE } from "../../game/monsters/base.generated";
import { RACES } from "../../game/world/races";
import "./development.css";

export type StartExam = (discipline: Discipline, tier: number, rehearsal: boolean) => void;
export function DevelopmentPanel({
  state,
  send,
  startExam,
  close,
}: {
  state: GameViewState;
  send: (c: Command) => void;
  startExam?: StartExam | undefined;
  close: () => void;
}) {
  const [tab, setTab] = useState<"training" | "knowledge" | "mastery">("training");
  const [instructions, setInstructions] = useState<{ discipline: Discipline; tier: number } | null>(
    null,
  );
  const p = state.player;
  const development = p.development ?? emptyDevelopment();
  const available = development.practiceEarned - development.practiceSpent;
  const nearTrainer =
    p.interior === "arena" &&
    state.activeNpcs.some((n) => n.id === "trainer" && Math.hypot(n.x - p.x, n.y - p.y) <= 180);
  return (
    <div className="ki-development">
      <p>
        {RACES[p.race].name} · Praktyka: <strong>{available}</strong> · Przydzielone stopnie:{" "}
        <strong>{DISCIPLINES.reduce((n, d) => n + development.training[d], 0)}/90</strong>
      </p>
      <div className="ki-development-tabs" role="tablist" aria-label="Dziedziny rozwoju">
        {(
          [
            ["training", "Trening"],
            ["knowledge", "Wiedza"],
            ["mastery", "Mistrzostwo"],
          ] as const
        ).map(([id, name]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {name}
          </button>
        ))}
      </div>
      {tab === "training" && (
        <>
          <p>
            Trening wzmacnia bazę rasy. Nie zmienia szybkości, nie odnawia HP ani KI. Praktyka jest
            oddzielona od doświadczenia.
          </p>
          {!nearTrainer && (
            <p>
              Podejdź do trenera w sali treningowej, aby ćwiczyć i rozdzielać stopnie.{" "}
              <button
                onClick={() => {
                  close();
                  send({ type: "interact", npc: "trainer" });
                }}
              >
                Podejdź do trenera
              </button>
            </p>
          )}
          {DISCIPLINES.map((d) => {
            const r = development.training[d];
            const reason = rankUnavailable(
              development.training,
              development.passedExamIds,
              available,
              d,
            );
            const tier = examTier(development.training, d);
            const percent =
              d === "strength" || d === "defense" ? 0.4 : d === "kiControl" ? 0.2 : 0.5;
            return (
              <section key={d} className="ki-development-card">
                <h3>
                  {TRAINING_NAMES[d]} <span>{r}/30</span>
                </h3>
                <p>
                  {d === "kiControl"
                    ? "Redukcja pierwotnego kosztu KI"
                    : "Premia do bazowej wartości"}
                  : {(r * percent).toLocaleString("pl-PL")}%
                  {r < 30 && <> → {((r + 1) * percent).toLocaleString("pl-PL")}%</>}
                </p>
                <button
                  disabled={!nearTrainer || Boolean(reason)}
                  title={reason}
                  onClick={() => send({ type: "development", action: "train", discipline: d })}
                >
                  {r === 30 ? "Maksymalny stopień" : `Trenuj · ${rankCost(r)} praktyki`}
                </button>
                {reason && <small>{reason}</small>}
                <button
                  disabled={!nearTrainer || !startExam}
                  onClick={() => setInstructions({ discipline: d, tier })}
                >
                  Egzamin {tier} · zasady i trening
                </button>
                <small>
                  Zdane:{" "}
                  {Array.from({ length: 6 }, (_, i) =>
                    development.passedExamIds.includes(examId(d, i + 1)) ? String(i + 1) : "—",
                  ).join(" · ")}
                </small>
              </section>
            );
          })}
          <button
            disabled={!nearTrainer || development.practiceSpent === 0}
            onClick={() => send({ type: "development", action: "reset-training" })}
          >
            Bezpłatny reset treningu · zwrot {development.practiceSpent} praktyki
          </button>
          {instructions && (
            <section className="ki-development-card" aria-label="Zasady egzaminu">
              <h3>
                {TRAINING_NAMES[instructions.discipline]} · egzamin {instructions.tier}
              </h3>
              <p>{examInstructions(examSpec(instructions.discipline, instructions.tier))}</p>
              <p>
                Wypożyczony profil poziomu 20: zwykły atak oraz zestaw obronny odpowiedni dla rasy,
                bez ekwipunku i mikstur. Oryginalne HP, KI, zasoby, cooldowny i przedmioty pozostają
                bez zmian. Pierwsze zdanie uprawnionego egzaminu: 250 praktyki; przygotowanie i
                powtórki nie dają nagród.
              </p>
              <button
                disabled={
                  !startExam ||
                  !examAvailable(
                    development.training,
                    development.passedExamIds,
                    instructions.discipline,
                    instructions.tier,
                  )
                }
                onClick={() => startExam?.(instructions.discipline, instructions.tier, false)}
              >
                Rozpocznij egzamin
              </button>
              <button
                disabled={!startExam}
                onClick={() => startExam?.(instructions.discipline, instructions.tier, true)}
              >
                Ćwicz bez nagrody
              </button>
              <button onClick={() => setInstructions(null)}>Wróć</button>
            </section>
          )}
        </>
      )}
      {tab === "knowledge" && (
        <>
          <p>
            Poznaj gatunek przez kontakt wzrokowy, zaobserwuj atak, zbadaj jego ślad, a następnie
            pokonaj go podczas wyprawy. Pełne badanie daje raz 50 praktyki. Zaobserwowanie atlasu
            nie jest odkryciem.
          </p>
          {MONSTER_BASE.map((m) => {
            const stage = development.knowledge[m.id] ?? 0;
            return (
              <section key={m.id} className="ki-development-card">
                <h3>{stage ? m.name : "Nieznany gatunek"}</h3>
                <p>
                  {
                    [
                      "Nieodkryty",
                      "Zauważony",
                      "Zaobserwowano atak",
                      "Zbadany — zastosuj wiedzę w walce",
                      "Opanowany · nagroda zapisana",
                    ][stage]
                  }
                </p>
                {stage === 2 && (
                  <>
                    <button
                      onClick={() => {
                        close();
                        send({ type: "development", action: "study-route", species: m.id });
                      }}
                    >
                      Podejdź do śladu
                    </button>
                    <button
                      onClick={() => send({ type: "development", action: "study", species: m.id })}
                    >
                      Zbadaj pobliski ślad
                    </button>
                  </>
                )}
              </section>
            );
          })}
        </>
      )}
      {tab === "mastery" && (
        <>
          <p>
            Jeden aktywny wariant. Wymaga odkrycia oraz poznanej techniki; zmiana poza walką
            zachowuje cooldowny.
          </p>
          <button
            disabled={!development.activeVariantId}
            onClick={() => send({ type: "development", action: "variant", id: null })}
          >
            Wyłącz wariant
          </button>
          {Object.entries(VARIANTS)
            .filter(([, v]) => v.race === p.race)
            .map(([id, v]) => (
              <section key={id} className="ki-development-card">
                <h3>
                  {v.name} · {v.ability}
                </h3>
                <p>{v.description}</p>
                <button
                  disabled={
                    !development.unlockedVariants.includes(id as keyof typeof VARIANTS) ||
                    !p.skills.includes(v.ability)
                  }
                  onClick={() =>
                    send({
                      type: "development",
                      action: "variant",
                      id: id as keyof typeof VARIANTS,
                    })
                  }
                >
                  {development.activeVariantId === id
                    ? "Aktywny"
                    : development.unlockedVariants.includes(id as keyof typeof VARIANTS)
                      ? "Aktywuj"
                      : "Nieodkryty"}
                </button>
              </section>
            ))}
          {p.race === "android" && (
            <>
              <h3>
                Moduły · energia{" "}
                {development.equippedModuleIds.reduce((n, id) => n + MODULE_ENERGY[id], 0)}/10
              </h3>
              <p>
                Najwyżej trzy różne moduły. Zmieniaj konfigurację w warsztacie lub sali treningowej.
              </p>
              {Object.entries(MODULES).map(([id, m]) => {
                const key = id as keyof typeof MODULES;
                const equipped = development.equippedModuleIds.includes(key);
                return (
                  <section key={id} className="ki-development-card">
                    <h3>
                      {m.name} · {MODULE_ENERGY[key]} energii
                    </h3>
                    <p>{m.description}</p>
                    <button
                      disabled={!development.unlockedModules.includes(key)}
                      onClick={() =>
                        send({
                          type: "development",
                          action: "modules",
                          ids: equipped
                            ? development.equippedModuleIds.filter((m) => m !== key)
                            : [...development.equippedModuleIds, key],
                        })
                      }
                    >
                      {equipped
                        ? "Odłącz"
                        : development.unlockedModules.includes(key)
                          ? "Podłącz"
                          : "Nieodkryty"}
                    </button>
                  </section>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
