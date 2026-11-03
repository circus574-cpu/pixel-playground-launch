import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ChroniclePanel } from "../components/game/ChroniclePanel";
import { heritageChronicle, HISTORY } from "../game/development/heritage/chronicle";
import { HERITAGE_QUESTS } from "../game/development/heritage/catalog";
import { emptyDevelopment } from "../game/development/state";
import { emptyHeritageProgress } from "../game/development/heritage/types";
import { RACE_IDS } from "../game/world/races";
import { newPlayer } from "../game/session";
afterEach(cleanup);
const words = (text: string) => text.trim().split(/\s+/u).length;
describe.each(RACE_IDS)("private earned chronicle: %s", (race) => {
  it("does not reveal chapters or background to a new character", () => {
    const p = newPlayer(race);
    expect(heritageChronicle(p)).toEqual([]);
    render(<ChroniclePanel player={p} />);
    expect(screen.getByText(/0\/6/)).toBeVisible();
    for (const q of HERITAGE_QUESTS.filter((q) => q.race === race))
      expect(screen.queryByText(q.introduction)).toBeNull();
  });
  it("reveals only completed own chapters and the actual saved choice, with no mutation", () => {
    const p = newPlayer(race);
    p.development = emptyDevelopment();
    const defs = HERITAGE_QUESTS.filter((q) => q.race === race);
    // Presentation fixtures, not assertions of earning a quest through gameplay.
    p.development.heritage.quests[defs[0]!.id] = {
      ...emptyHeritageProgress(),
      status: "ready",
      choiceId: null,
    };
    expect(heritageChronicle(p)).toEqual([]);
    p.development.heritage.quests[defs[0]!.id]!.status = "done";
    p.development.heritage.quests[defs[0]!.id]!.choiceId = defs[0]!.choices.at(-1)!.id;
    const before = structuredClone(p);
    const result = heritageChronicle(p);
    expect(result).toHaveLength(1);
    expect(result[0]!.decision).toBe(defs[0]!.choices.at(-1)!.chronicle);
    expect(result[0]!.background).toBeUndefined();
    expect(p).toEqual(before);
    render(<ChroniclePanel player={p} />);
    expect(screen.getByText(result[0]!.decision)).toBeVisible();
    expect(screen.queryByText(HISTORY[race][0]!)).toBeNull();
    expect(screen.queryByText(defs[5]!.introduction)).toBeNull();
  });
  it("keeps the full narrative within 500–800 words for every choice combination and preserves owner provenance", () => {
    const defs = HERITAGE_QUESTS.filter((q) => q.race === race);
    const common = [
      ...HISTORY[race],
      ...defs.flatMap((q) => [
        q.introduction,
        ...q.goals.flatMap((g) => (g.kind === "talk" ? g.lines : [])),
      ]),
    ].join(" ");
    const minimum =
      words(common) +
      defs.reduce((n, q) => n + Math.min(...q.choices.map((c) => words(c.chronicle))), 0);
    const maximum =
      words(common) +
      defs.reduce((n, q) => n + Math.max(...q.choices.map((c) => words(c.chronicle))), 0);
    expect(minimum).toBeGreaterThanOrEqual(500);
    expect(maximum).toBeLessThanOrEqual(800);
    const owner = readFileSync("docs/design/racial-development-owner-2026-10-28.txt", "utf8");
    for (const paragraph of HISTORY[race]) expect(owner).toContain(paragraph);
  });
});
