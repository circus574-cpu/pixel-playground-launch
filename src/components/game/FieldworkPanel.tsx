import { useState } from "react";
import type { Command, GameViewState } from "../../game/session";
import { understandingBook } from "../../game/development/fieldwork/knowledge";

/** Existing development menu, real contacts and ordinary commands. */
export function FieldworkPanel({
  state,
  send,
  close,
}: {
  state: GameViewState;
  send: (c: Command) => void;
  close: () => void;
}) {
  const [allocation, setAllocation] = useState<[number, number]>([0, 0]);
  const field = state.fieldwork;
  if (!field) return null;
  const command = (id: string, action: "go" | "start" | "act" | "leave", answer?: string) =>
    send({ type: "fieldwork", id, action, ...(answer !== undefined ? { answer } : {}) });
  return (
    <section aria-label="Dziedziny w świecie">
      <p>
        Zdobyte rangi działają przy miejscowych obiektach. Stanowiska korzystają z Twojej postaci,
        umiejętności i zasobów. Zapisane działania nie wypłacają ponownie praktyki ani nie przyznają
        ukrytych statystyk.
      </p>
      {field.active && (
        <aside role="status">
          <strong>Aktywne: {field.active.target.label}</strong>
          <p>
            {field.active.activity?.message ??
              "Podejdź do kolejnego stanowiska. Pomiary wymagają rzeczywistych trafień, skupienie pełnego C1."}
          </p>
          <button onClick={() => command(field.active!.id, "leave")}>Przerwij działanie</button>
        </aside>
      )}
      {field.reading && (
        <article className="ki-development-card" role="status">
          <h3>{field.reading.title}</h3>
          <p>{field.reading.text}</p>
        </article>
      )}
      {field.entries.map((e) => (
        <article
          key={e.id}
          className="ki-development-card"
          aria-label={e.action}
          data-field-id={e.id}
          data-target-x={e.target?.point.x}
          data-target-y={e.target?.point.y}
          data-target-interior={e.target?.interior ?? ""}
        >
          <h3>
            {e.name} · stopień {e.tier}
          </h3>
          <p>
            {e.action} · {e.progress.step}/{e.steps}
            {e.progress.done ? " · zapisane" : ""}
          </p>
          {e.locked && <p>{e.locked}</p>}
          {e.target && (
            <p>
              {e.target.interior ? "Stanowisko wewnątrz budynku" : "Miejscowy obiekt w terenie"}
              {e.near ? " · jesteś przy nim" : " · podejdź, aby działać"}
            </p>
          )}
          <button
            disabled={!e.target || e.progress.done}
            onClick={() => {
              close();
              command(e.id, "go");
            }}
          >
            Podejdź: {e.action}
          </button>
          <button
            disabled={!!e.locked || !e.near || field.active?.id === e.id}
            onClick={() => {
              close();
              command(e.id, "start");
            }}
          >
            Rozpocznij: {e.action}
          </button>
          {e.puzzle && field.active?.id === e.id && (
            <div aria-label="Materiały stanowiska">
              <h4>{e.puzzle.title}</h4>
              <p style={{ whiteSpace: "pre-line" }}>{e.puzzle.text}</p>
              {e.puzzle.allocation && (
                <>
                  <label>
                    Pierwszy odbiorca
                    <input
                      aria-label="Pierwszy odbiorca"
                      type="number"
                      min={0}
                      max={e.puzzle.allocation.total}
                      value={allocation[0]}
                      onChange={(v) => setAllocation([Number(v.target.value), allocation[1]])}
                    />
                  </label>
                  <label>
                    Drugi odbiorca
                    <input
                      aria-label="Drugi odbiorca"
                      type="number"
                      min={0}
                      max={e.puzzle.allocation.total}
                      value={allocation[1]}
                      onChange={(v) => setAllocation([allocation[0], Number(v.target.value)])}
                    />
                  </label>
                  <button onClick={() => command(e.id, "act", allocation.join(","))}>
                    Zatwierdź podział
                  </button>
                </>
              )}
              {e.puzzle.options.map((o) => (
                <button key={o.id} onClick={() => command(e.id, "act", o.id)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
      {state.player.race === "sage" && (
        <section aria-label="Księga Zrozumienia">
          <h3>Księga Zrozumienia · 12 fragmentów</h3>
          <p>
            Źródło, jego weryfikacja i zapisana decyzja odblokowują fragment. Bez losowego łupu i
            dodatkowej praktyki.
          </p>
          {understandingBook(state.player.development).map((chapter) => (
            <article key={chapter.name}>
              <h4>
                {chapter.name} · {chapter.fragments.filter((f) => f.source).length}/3
              </h4>
              {chapter.fragments.map((fragment, i) =>
                fragment.source ? (
                  <details key={fragment.id}>
                    <summary>{fragment.source.title}</summary>
                    <p>{fragment.source.text}</p>
                    <p>{fragment.source.decision}</p>
                  </details>
                ) : (
                  <p key={fragment.id}>Fragment {i + 1}: nieodkryty.</p>
                ),
              )}
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
