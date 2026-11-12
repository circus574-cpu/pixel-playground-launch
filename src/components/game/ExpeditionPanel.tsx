import type { Command, GameViewState } from "../../game/session";

export function ExpeditionPanel({
  state,
  send,
  close,
}: {
  state: GameViewState;
  send: (c: Command) => void;
  close: () => void;
}) {
  const view = state.expeditions;
  if (!view) return null;
  const command = (id: string, action: "go" | "start" | "leave") =>
    send({ type: "expedition", id, action });
  return (
    <section aria-label="Późne wyprawy" data-start-blocked={view.startBlocked ? "1" : "0"}>
      {view.startBlocked && <p role="status">{view.startBlocked}</p>}
      <p>
        Po rozdziałach IV i V: cztery zalecane poziomy, samotny strażnik, para przeciwników i trzy
        fale obrony. Nie ma wymaganego poziomu wejścia. Wyprawy korzystają z Twojego wyposażenia, KI
        i mikstur.
      </p>
      <p>
        Pokonania dają zwykłe doświadczenie. Cel wyprawy nie daje dodatkowej praktyki ani
        powtarzalnej nagrody. Warianty nie zastępują 40 podstawowych gatunków bestiariusza.
      </p>
      {view.active && (
        <aside role="status">
          <h3>
            Aktywna wyprawa ·{" "}
            {view.active.phase === "running"
              ? "walka"
              : view.active.phase === "passed"
                ? "ukończona"
                : "przerwana"}
          </h3>
          <p>
            Fala {view.active.stage}/{view.active.waves}
            {view.active.protected
              ? ` · Chroniony punkt: ${Math.ceil((100 * view.active.protected.hp) / view.active.protected.maxHp)}% HP (minimum 50%)`
              : ""}
          </p>
          {view.active.reason && <p>{view.active.reason}</p>}
          {view.active.pendingSaves > 0 && (
            <p>
              Oczekujące zapisy pokonań: {view.active.pendingSaves}. Ponów zapis przed opuszczeniem
              wyprawy.
            </p>
          )}
          <button onClick={() => command(view.active!.id, "leave")}>Opuść wyprawę</button>
        </aside>
      )}
      {view.entries.map((e) => (
        <article
          className="ki-development-card"
          key={e.id}
          aria-label={e.name}
          data-expedition-id={e.id}
          data-target-x={e.target?.point.x}
          data-target-y={e.target?.point.y}
        >
          <h3>
            {e.name}
            {e.done ? " · ukończona" : ""}
          </h3>
          {e.locked && <p>{e.locked}</p>}
          <button
            disabled={!e.target}
            onClick={() => {
              close();
              command(e.id, "go");
            }}
          >
            Podejdź do punktu wyprawy
          </button>
          <button
            disabled={
              !!e.locked || !!view.startBlocked || !e.near || view.active?.phase === "running"
            }
            onClick={() => {
              close();
              command(e.id, "start");
            }}
          >
            Rozpocznij wyprawę
          </button>
        </article>
      ))}
      <h3>Odkryte warianty · {view.knowledge.length}/32</h3>
      {view.knowledge.map((k) => (
        <p key={k.id}>
          {k.name} · {k.stage === "defeated" ? "pokonany" : "zaobserwowany"}
        </p>
      ))}
    </section>
  );
}
