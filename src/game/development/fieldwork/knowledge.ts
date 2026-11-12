import { HERITAGE_QUESTS } from "../heritage/catalog";
import type { DevelopmentState } from "../state";
import type { RaceId } from "../../world/races";

/** Only a verified goal AND the saved chapter decision unlock a source. Never reveal future lore. */
export function earnedSources(race: RaceId, development: DevelopmentState | undefined) {
  return HERITAGE_QUESTS.filter((q) => q.race === race).flatMap((q) => {
    const p = development?.heritage.quests[q.id];
    if (p?.status !== "done" || !q.choices.some((c) => c.id === p.choiceId)) return [];
    return q.goals.flatMap((g, i) => {
      if (p.completedGoals[i]?.outcome !== "done") return [];
      const text = g.documents
        .map((d) => d.text)
        .concat(g.kind === "talk" ? g.lines : [])
        .join("\n");
      return text
        ? [
            {
              id: g.id,
              chapter: q.chapter,
              chapterId: q.id,
              title: g.label,
              text,
              decision: q.choices.find((c) => c.id === p.choiceId)!.chronicle,
            },
          ]
        : [];
    });
  });
}
const BOOK = [
  ["Pieczęcie", ["H-A01:sora", "H-A01:seal", "H-A01:staff"]],
  ["Bariery", ["H-A02:accounts", "H-A02:difference", "H-A03:relative"]],
  ["Skupienie", ["H-A03:tune", "H-A04:locks", "H-A04:integrity"]],
  ["Pamięć", ["H-A05:hearing", "H-A05:temper", "H-A06:chapter"]],
] as const;
export function understandingBook(development: DevelopmentState | undefined) {
  const sources = earnedSources("sage", development);
  return BOOK.map(([name, ids]) => ({
    name,
    fragments: ids.map((id) => ({ id, source: sources.find((s) => s.id === id) ?? null })),
  }));
}
