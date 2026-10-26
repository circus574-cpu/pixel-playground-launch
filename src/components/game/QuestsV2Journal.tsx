import { useSyncExternalStore } from "react";
import { questsV2 } from "../../game/quests/v2Tracker";
import { WORLD_V2 } from "../../game/world/generated/worldVersion";

const OBJECTIVE_ICON: Record<string, string> = {
  combat: "⚔",
  talk: "💬",
  discover: "🔍",
  visit: "📍",
  deliver: "📦",
};
const STATE_LABEL: Record<string, string> = {
  available: "Do przyjęcia",
  active: "W toku",
  completed: "Ukończone",
};

/** Argon's quests on world v2 (preview switch ?ki-world-v2=1). */
export function QuestsV2Journal({ continent }: { continent: string }) {
  const save = useSyncExternalStore(
    questsV2.subscribe,
    () => questsV2.save,
    () => questsV2.save,
  );
  if (!WORLD_V2) return null;
  const entries = questsV2.journal(continent);
  const order = { active: 0, available: 1, completed: 2 } as Record<string, number>;
  entries.sort((a, b) => (order[a.state] ?? 3) - (order[b.state] ?? 3));
  return (
    <section className="ki-quests-v2" aria-label="Przygody świata v2">
      <h3 className="ki-qv2-title">Przygody kontynentu</h3>
      {entries.map(({ quest, state, stage }) => {
        const current = quest.stages[stage];
        const progress = save.quests[quest.id]?.objectiveProgress ?? {};
        return (
          <article className={"ki-qv2-card is-" + state} key={quest.id}>
            <img
              className="ki-qv2-portrait"
              src={`/game/portraits-v2/${quest.giverNpcId}.webp`}
              alt={quest.giverName}
              width={64}
              height={78}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <h3>
              {state === "completed" ? "✓ " : "◆ "}
              {quest.title}
            </h3>
            <div className="ki-qv2-meta">
              <span className={"ki-qv2-badge is-" + state}>{STATE_LABEL[state] ?? state}</span>
              <span>{quest.giverName}</span>
              <span>poz. {quest.recommendedLevel}</span>
              <span className="ki-qv2-reward">
                +{quest.reward.xp} XP
                {quest.reward.coins ? " · " + quest.reward.coins + " monet" : ""}
              </span>
            </div>
            <p className="ki-qv2-story">
              {state === "active" && current ? current.narrativeText : quest.summary}
            </p>
            {state === "active" && current && <h4 className="ki-qv2-stage">{current.title}</h4>}
            {state === "active" && current && (
              <ul className="ki-qv2-goals">
                {current.objectives.map((o) => {
                  const done = Math.min(progress[o.id] ?? 0, o.targetCount);
                  return (
                    <li key={o.id} className={done >= o.targetCount ? "is-done" : ""}>
                      <span className="ki-qv2-icon" aria-hidden>
                        {OBJECTIVE_ICON[o.type] ?? "◆"}
                      </span>
                      <span className="ki-qv2-text">
                        {o.description.replace(/\s*\([a-z0-9._-]+\)/g, "")}
                      </span>
                      <span className="ki-qv2-bar" aria-label={done + " z " + o.targetCount}>
                        <i style={{ width: (100 * done) / o.targetCount + "%" }} />
                        <b>
                          {done}/{o.targetCount}
                        </b>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {!quest.playableInCurrentRuntime && quest.runtimeLimitationNote && (
              <small>{quest.runtimeLimitationNote}</small>
            )}
            {state === "available" && (
              <button className="ki-qv2-accept" onClick={() => questsV2.start(quest.id)}>
                Przyjmij zadanie
              </button>
            )}
          </article>
        );
      })}
    </section>
  );
}
