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
