import { useSyncExternalStore } from "react";
import { questsV2 } from "../../game/quests/v2Tracker";
import { WORLD_V2 } from "../../game/world/generated/worldVersion";

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
      <h3 className="ki-panel-caption">Przygody kontynentu · {entries.length}</h3>
      {entries.map(({ quest, state, stage }) => {
        const current = quest.stages[stage];
        const progress = save.quests[quest.id]?.objectiveProgress ?? {};
        return (
          <article className="ki-quest-entry" key={quest.id}>
            <h3>
              {state === "completed" ? "✓ " : "◆ "}
              {quest.title}
            </h3>
            <small>
              {STATE_LABEL[state] ?? state} · {quest.giverName} · poziom {quest.recommendedLevel}
            </small>
            <p>{state === "active" && current ? current.narrativeText : quest.summary}</p>
            {state === "active" && current && (
              <ul>
                {current.objectives.map((o) => (
                  <li key={o.id}>
                    {o.description} — {Math.min(progress[o.id] ?? 0, o.targetCount)}/{o.targetCount}
                  </li>
                ))}
              </ul>
            )}
            {!quest.playableInCurrentRuntime && quest.runtimeLimitationNote && (
              <small>{quest.runtimeLimitationNote}</small>
            )}
            {state === "available" && (
              <button onClick={() => questsV2.start(quest.id)}>Przyjmij zadanie</button>
            )}
          </article>
        );
      })}
    </section>
  );
}
