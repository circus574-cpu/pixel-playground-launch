import { useState } from "react";
import type { Command, GameViewState } from "../../game/session";
import { heritageDefinition } from "../../game/development/heritage/state";
import { forgeProcedure } from "../../game/development/heritage/reducer";
import type { HeritageInteraction } from "../../game/development/heritage/runtime";
import type { HeritageContentId } from "../../game/development/heritage/types";

type Entry = GameViewState["heritage"][number];
export function HeritagePanel({
  state,
  send,
  close,
}: {
  state: GameViewState;
  send: (command: Command) => void;
  close: () => void;
}) {
  const [selection, setSelection] = useState<HeritageContentId | null>(null);
  const entries = state.heritage;
  const entry =
    entries.find((e) => e.id === selection) ??
    entries.find((e) => e.status === "active" || e.status === "ready") ??
    entries.find((e) => e.status !== "done") ??
    entries[0];
  return (
    <>
      <p>
        Rodzinne świadectwa, praca mieszkańców i własne decyzje. Nagrody są jednorazowe, przypisane
        tej postaci. Poznawanie innych kultur nie powiela ich nagród.
      </p>
      {state.heritageScanner && (
        <section className="ki-development-card" aria-label="Skaner lokalnych instalacji">
          <h3>Skaner · lokalne instalacje</h3>
          <p>Odczyt wymaga podejścia i interakcji. Bez odkrywania odległych obiektów.</p>
          {state.heritageScanner.installations.length === 0 && (
            <p>Brak znanej instalacji w polu widzenia.</p>
          )}
          {state.heritageScanner.installations.map((installation) => (
            <button
              key={installation.id}
              disabled={!installation.near}
              onClick={() => send({ type: "heritage", action: "scan", id: installation.id })}
            >
              Zbadaj instalację: {installation.name}
            </button>
          ))}
          {state.heritageScanner.reading && (
            <div role="status">
              <h4>{state.heritageScanner.reading.name}</h4>
              <p>
                {state.heritageScanner.reading.state}. Etapy prac:{" "}
                {state.heritageScanner.reading.completedSteps}/
                {state.heritageScanner.reading.totalSteps}.
              </p>
              <p>{state.heritageScanner.reading.description}</p>
            </div>
          )}
        </section>
      )}
      <div className="ki-development-tabs" aria-label="Rozdziały i projekty">
        {entries.map((e) => (
          <button key={e.id} aria-pressed={entry?.id === e.id} onClick={() => setSelection(e.id)}>
            {heritageDefinition(e.id)!.name}
            {e.status === "done"
              ? " · ukończone"
              : e.status === "active"
                ? " · w toku"
                : e.status === "ready"
                  ? " · odbiór"
                  : ""}
          </button>
        ))}
      </div>
      {entry?.goal.kind !== "measure" &&
        state.heritageActivity &&
        "readings" in state.heritageActivity &&
        state.heritageActivity.readings.length > 0 && (
          <section className="ki-development-card" aria-label="Odczyty z bieżącej wizyty">
            <h3>Ostatnie pomiary · ta wizyta</h3>
            {state.heritageActivity.readings.map((reading) => (
              <p key={reading.target + ":" + reading.at}>
                {reading.target}: trafienie {Math.round(reading.damage)}, ATK {reading.attack}, KI{" "}
                {Math.round(reading.ki)}/{reading.maxKi}
                {reading.resource
                  ? ", " +
                    reading.resource.label +
                    " " +
                    Math.round(reading.resource.value) +
                    "/" +
                    reading.resource.max
                  : ""}
                .
              </p>
            ))}
          </section>
        )}
      {entry && (
        <HeritageEntry
          key={entry.id + ":" + entry.goal.id}
          state={state}
          entry={entry}
          send={send}
          close={close}
        />
      )}
    </>
  );
}
function HeritageEntry({
  state,
  entry,
  send,
  close,
}: {
  state: GameViewState;
  entry: Entry;
  send: (c: Command) => void;
  close: () => void;
}) {
  const [name, setName] = useState("");
  const definition = heritageDefinition(entry.id)!;
  const goal = entry.goal,
    progress = entry.progress;
  const act = (targetId: string, interaction: HeritageInteraction) =>
    send({
      type: "heritage",
      action: "act",
      id: entry.id,
      goalId: goal.id,
      targetId,
      revision: progress?.goal.revision ?? 0,
      interaction,
    });
  const go = (targetId: string) => {
    close();
    send({ type: "heritage", action: "go", id: entry.id, targetId });
  };
  const completed = entry.status === "done";
  const chosen =
    "choices" in definition ? definition.choices.find((c) => c.id === progress?.choiceId) : null;
  return (
    <section className="ki-development-card" aria-label="Dziedzictwo — bieżący rozdział">
      <h3>{definition.name}</h3>
      {"introduction" in definition && <p>{definition.introduction}</p>}
      {"recommendedLevel" in definition && (
        <small>
          Zalecany poziom {definition.recommendedLevel.join("–")}; nie jest wymogiem przyjęcia.
        </small>
      )}
      {entry.locked && <p>{entry.locked}</p>}
      {completed ? (
        <>
          <p>
            Ukończone.{" "}
            {chosen?.chronicle ?? ("effect" in definition ? definition.effect.description : "")}
          </p>
          {progress?.completedGoals.map((g, i) =>
            Object.entries(g.consent).map(([target, mode]) => (
              <p key={target}>
                Świadectwo {i + 1}:{" "}
                {mode === "anonymous"
                  ? "dane świadka chronione — wpis anonimowy"
                  : "świadek wyraził zgodę na podpis"}
                .
              </p>
            )),
          )}
        </>
      ) : (
        <>
          <p>
            Etap {Math.min((progress?.step ?? 0) + 1, definition.goals.length)}/
            {definition.goals.length}: <strong>{goal.label}</strong>
          </p>
          {entry.status === "available" && (
            <button
              disabled={!!entry.locked || !entry.near}
              onClick={() => send({ type: "heritage", action: "start", id: entry.id })}
            >
              Przyjmij zlecenie
            </button>
          )}
          {goal.documents.map((document) => (
            <details key={document.title}>
              <summary>{document.title}</summary>
              <p>{document.text}</p>
            </details>
          ))}
          {goal.kind === "talk" && (
            <>
              <h4>{goal.speaker}</h4>
              {goal.lines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </>
          )}
          {entry.status === "active" && progress?.goal.outcome === "failed" && (
            <>
              <p>Próba etapu nieudana. Zapisane wcześniejsze etapy pozostają ukończone.</p>
              <button onClick={() => act(entry.targets[0]?.id ?? "", { kind: "retry" })}>
                Ponów bieżący etap
              </button>
            </>
          )}
          {goal.kind === "measure" && entry.status === "active" && (
            <section>
              <p>
                Traf trzy odrębne cele bez obrony istniejącym atakiem lub umiejętnością. Podejdź do
                każdego stanowiska na odległość badania (130 j.). Pomiar nie odnawia HP/KI, nie
                skraca odnowienia i nie daje nagrody za strzał.
              </p>
              <button
                disabled={!entry.near}
                onClick={() => {
                  close();
                  send({ type: "heritage", action: "activity-start", id: entry.id });
                }}
              >
                Uruchom stanowisko pomiarowe
              </button>
              <p>
                Bieżący zestaw: ATK {state.stats.attack}, KI {Math.ceil(state.player.ki)}/
                {state.stats.maxKi}.{" "}
                {state.resource
                  ? state.resource.label +
                    ": " +
                    Math.round(state.resource.value) +
                    "/" +
                    state.resource.max
                  : "Brak dodatkowego zasobu w zestawie."}
              </p>
              {state.heritageActivity &&
                "readings" in state.heritageActivity &&
                state.heritageActivity.readings.map((reading) => (
                  <p key={reading.target + ":" + reading.at}>
                    {reading.target}: trafienie {Math.round(reading.damage)}, ATK {reading.attack},
                    KI {Math.round(reading.ki)}/{reading.maxKi}
                    {reading.resource
                      ? ", " +
                        reading.resource.label +
                        " " +
                        Math.round(reading.resource.value) +
                        "/" +
                        reading.resource.max
                      : ""}
                    . Odczyt z tej wizyty.
                  </p>
                ))}
            </section>
          )}
          {goal.kind === "escort" && !goal.combat && entry.status === "active" && (
            <section>
              <p>
                Towarzysz idzie po sprawdzonej trasie i czeka, gdy odejdziesz. Podejdźcie razem do
                każdego punktu. Każdy punkt jest zapisywany; po przerwaniu wróć do punktu
                wznowienia. To dostawa bez walki.
              </p>
              <p>
                Punkty: {progress?.goal.sequence ?? 0}/{goal.checkpoints}
              </p>
              <button
                disabled={!entry.near}
                onClick={() => {
                  close();
                  send({ type: "heritage", action: "activity-start", id: entry.id });
                }}
              >
                Rozpocznij lub wznów eskortę dostawy
              </button>
              {state.heritageActivity?.goalId === goal.id && (
                <button
                  onClick={() => send({ type: "heritage", action: "activity-leave", id: entry.id })}
                >
                  Przerwij eskortę — zachowaj punkty
                </button>
              )}
            </section>
          )}
          {goal.kind === "restraint" && entry.status === "active" && (
            <section>
              <p>
                Próba kontroli: w każdym oknie „CIOS DOZWOLONY” traf raz zwykłym atakiem, potem nie
                atakuj przez „ZATRZYMAJ CIOS”. Na poddanie przerwij atak. Używasz obecnego ruchu i
                ataku; brak nagród za trafienia. Instrukcję zobaczysz w obecnym pasku celu.
              </p>
              {state.heritageActivity?.goalId === goal.id && (
                <p>
                  {state.heritageActivity.message} · {state.heritageActivity.windows}/
                  {state.heritageActivity.target} · błędy {state.heritageActivity.errors}
                </p>
              )}
              <button
                disabled={!entry.near}
                onClick={() => {
                  close();
                  send({ type: "heritage", action: "activity-start", id: entry.id });
                }}
              >
                Rozpocznij lub ponów próbę kontroli
              </button>
              <button
                disabled={state.heritageActivity?.phase !== "passed"}
                onClick={() => send({ type: "heritage", action: "activity-finish", id: entry.id })}
              >
                Zapisz wynik próby
              </button>
              {state.heritageActivity && (
                <button
                  onClick={() => send({ type: "heritage", action: "activity-leave", id: entry.id })}
                >
                  Opuść próbę bez nagrody
                </button>
              )}
            </section>
          )}
          {entry.targets.map((target, i) => {
            const done = progress?.goal.completedTargetIds.includes(target.id);
            const enabled =
              entry.status === "active" &&
              target.near &&
              !done &&
              progress?.goal.outcome === "active";
            return (
              <section
                key={target.id}
                className="ki-development-target"
                data-target-x={target.point.x}
                data-target-y={target.point.y}
                data-target-interior={target.interior ?? "outside"}
              >
                <h4>
                  {target.label}
                  {done ? " · zbadane" : ""}
                </h4>
                <small>
                  {target.near
                    ? "Jesteś przy celu"
                    : target.distance === null
                      ? "Cel wewnątrz lub na zewnątrz budynku"
                      : "Odległość: " + target.distance + " j."}
                </small>
                <button disabled={!!entry.locked || target.near} onClick={() => go(target.id)}>
                  Podejdź: {target.label}
                </button>
                {goal.kind === "talk" &&
                  goal.responses.map((response) => (
                    <button
                      disabled={!enabled}
                      key={response.id}
                      onClick={() => act(target.id, { kind: "talk", responseId: response.id })}
                    >
                      {response.label}
                    </button>
                  ))}
                {goal.kind === "inspect" && (
                  <button disabled={!enabled} onClick={() => act(target.id, { kind: "inspect" })}>
                    Zbadaj znak lub przedmiot
                  </button>
                )}
                {goal.kind === "recover" && (
                  <button disabled={!enabled} onClick={() => act(target.id, { kind: "recover" })}>
                    Odzyskaj: {goal.materialName}
                  </button>
                )}
                {goal.kind === "solve" && goal.puzzles[i] && (
                  <>
                    <p>{goal.puzzles[i]!.prompt}</p>
                    {goal.puzzles[i]!.options.map((option) => (
                      <button
                        disabled={!enabled || i !== progress?.goal.sequence}
                        key={option.id}
                        onClick={() => act(target.id, { kind: "solve", answerId: option.id })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </>
                )}
                {goal.kind === "craft" && (
                  <button disabled={!enabled} onClick={() => act(target.id, { kind: "craft" })}>
                    Wykonaj pracę{goal.kiCost ? " · " + goal.kiCost + " bazowego KI" : ""}
                  </button>
                )}
                {goal.kind === "consent" && (
                  <>
                    <p>{goal.question}</p>
                    <button
                      disabled={!enabled}
                      onClick={() =>
                        act(target.id, { kind: "consent", granted: true, mode: "named" })
                      }
                    >
                      Uzyskaj zgodę na podpis
                    </button>
                    <button
                      disabled={!enabled}
                      onClick={() =>
                        act(target.id, { kind: "consent", granted: true, mode: "anonymous" })
                      }
                    >
                      Uzyskaj zgodę na zapis anonimowy
                    </button>
                    <button
                      disabled={!enabled}
                      onClick={() =>
                        act(target.id, { kind: "consent", granted: false, mode: "anonymous" })
                      }
                    >
                      Uszanuj odmowę — bez zapisu
                    </button>
                  </>
                )}
                {goal.kind === "forge" && (
                  <>
                    <p>
                      Kolejność pracy:{" "}
                      {forgeProcedure(goal, state.player.race)
                        .map((o) => o.label)
                        .join(" → ")}
                      . Postęp: {progress?.goal.sequence ?? 0}.
                    </p>
                    {forgeProcedure(goal, state.player.race).map((operation) => (
                      <button
                        disabled={!enabled}
                        key={operation.id}
                        onClick={() => act(target.id, { kind: "forge", operationId: operation.id })}
                      >
                        {operation.label}
                      </button>
                    ))}
                  </>
                )}
                {goal.kind === "name-weapon" && (
                  <>
                    <label>
                      Nazwa osobistej broni{" "}
                      <input
                        value={name}
                        maxLength={48}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="3–24 znaki"
                      />
                    </label>
                    <button
                      disabled={!enabled}
                      onClick={() => act(target.id, { kind: "name-weapon", name })}
                    >
                      Zapisz nazwę
                    </button>
                  </>
                )}
              </section>
            );
          })}
          {goal.kind === "projects" && (
            <p>
              Ten etap zatwierdza się po zapisanym ukończeniu projektów:{" "}
              {goal.required.map((id) => heritageDefinition(id)!.name).join(", ")}. Zamknij okno po
              zakończeniu prac.
            </p>
          )}
          {goal.kind === "observe" && (
            <p>
              Zamknij okno i odnajdź żywy cel w terenie. Potwierdzenie wymaga rzeczywistego zasięgu
              wzroku i braku przeszkód.
            </p>
          )}
          {entry.status === "ready" && (
            <>
              <p>Wszystkie działania wykonane. Odbierz wynik przy ostatnim stanowisku.</p>
              {"choices" in definition ? (
                definition.choices.map((choice) => (
                  <button
                    key={choice.id}
                    disabled={!entry.near}
                    onClick={() =>
                      send({ type: "heritage", action: "claim", id: entry.id, choiceId: choice.id })
                    }
                  >
                    {choice.label}
                  </button>
                ))
              ) : (
                <button
                  disabled={!entry.near}
                  onClick={() =>
                    send({ type: "heritage", action: "claim", id: entry.id, choiceId: null })
                  }
                >
                  Zakończ projekt i odbierz praktykę
                </button>
              )}
            </>
          )}
          <small>
            Nagroda: {definition.reward.practice} praktyki
            {"xp" in definition.reward
              ? ", " + definition.reward.xp + " XP, " + definition.reward.gold + " monet"
              : ""}
            . Każdy wybór ma równą nagrodę.
          </small>
        </>
      )}
    </section>
  );
}
