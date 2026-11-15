import { describe, expect, it } from "vitest";
import { GameSession } from "../game/session";
import { npcNameCase } from "../game/npcNames";

describe("NPC names in quest sentences", () => {
  it("uses the instrumental case after 'z' and the genitive after 'do'", () => {
    const g = new GameSession();
    // a fresh character has not met the guide yet: "talk to Aira"
    expect(g.questText("steps")).toBe("Porozmawiaj z Airą przy miejscu startowym");
    g.player.quests.steps = "ready";
    expect(g.questText("steps")).toBe("Wróć do Airy po nagrodę");
    g.player.quests.boars = "ready";
    expect(g.questText("boars")).toBe("Wróć do Rena po nagrodę");
  });
  it("declines the names of every world and leaves designations alone", () => {
    expect(npcNameCase("Sora", "ins")).toBe("Sorą");
    expect(npcNameCase("Kaena", "gen")).toBe("Kaeny");
    expect(npcNameCase("Rokan", "ins")).toBe("Rokanem");
    expect(npcNameCase("Nela", "gen")).toBe("Neli");
    expect(npcNameCase("Oren", "gen")).toBe("Orena");
    expect(npcNameCase("LYRA-7", "gen")).toBe("LYRA-7");
    expect(npcNameCase("Taro", "ins")).toBe("Taro");
  });
});
