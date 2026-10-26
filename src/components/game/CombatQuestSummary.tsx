import { useSyncExternalStore } from "react";
import { questsV2 } from "../../game/quests/v2Tracker";

/** Read-only compact view of the already integrated quest tracker. */
export function CombatQuestSummary({ continent }: { continent: string }) {
  useSyncExternalStore(
    questsV2.subscribe,
    () => questsV2.save,
    () => questsV2.save,
  );
  const entry = questsV2.journal(continent).find((q) => q.state === "active");
  const stage = entry?.quest.stages[entry.stage];
  return (
    <div>
      <strong>{entry?.quest.title ?? "Przygody kontynentu"}</strong>
      <span>{stage?.title ?? "Otwórz dziennik, aby wybrać zadanie"}</span>
    </div>
  );
}
