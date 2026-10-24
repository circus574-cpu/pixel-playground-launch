import { describe, expect, it } from "vitest";
import { GameSession, SaveStore, SAVE_KEY, NPCS } from "../game/session";
import { TUTORIAL_MARKET } from "../game/tutorial";
import { isPlaytest, playtestSaveKey, PLAYTEST_ID, PLAYTEST_SAVE_KEY } from "../game/playtest";
import { coversPlayer } from "../game/world/visibility";
import { FOREST_OBJECTS } from "../game/world/forest";

describe("stage 2.1 regressions", () => {
  it("has one Aira and an ordinary walkable route to the shared market", () => {
    const game = new GameSession();
    expect(NPCS.filter((n) => n.id === "guide")).toHaveLength(1);
    expect(game.npcs.filter((n) => n.name === "Aira")).toHaveLength(1);
    const route = game.nav.path(game.player, game.world.market);
    expect(route.length).toBeGreaterThan(0);
    expect(route.every((p) => game.nav.walkable(p))).toBe(true);
    game.command({ type: "interact", npc: "guide" });
    for (let i = 0; i < 200 && !game.dialogue; i++) game.tick(50);
    game.command({ type: "dialogue", action: "accept" });
    expect(game.notice).toContain(TUTORIAL_MARKET.instruction);
    expect(game.notice).not.toContain("latar");
    expect(game.questText("steps")).toBe(TUTORIAL_MARKET.instruction);
    game.command({ type: "dialogue", action: "close" });
    game.command({ type: "move", ...game.world.market });
    for (let i = 0; i < 600 && game.player.quests.steps !== "ready"; i++) game.tick(50);
    expect(game.player.quests.steps).toBe("ready");
    expect(game.player.visited).toBe(true);
  });
  it("detects torso occlusion on a reachable point behind the forge but preserves depth in front", () => {
    const game = new GameSession();
    const forge = FOREST_OBJECTS.find((o) => o.kind === "forge")!;
    const behind = { x: forge.x, y: forge.y - 300 };
    expect(game.nav.walkable(behind)).toBe(true);
    expect(game.nav.path(game.player, behind).length).toBeGreaterThan(0);
    expect(coversPlayer(forge, behind)).toBe(true);
    expect(coversPlayer(forge, { x: forge.x, y: forge.y + 30 })).toBe(false);
    expect(coversPlayer(forge, { x: forge.x + forge.width, y: behind.y })).toBe(false);
    expect(coversPlayer({ ...forge, kind: "bridge" }, behind)).toBe(false);
  });
  it("isolates the visible QA profile and never overwrites the existing player", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
    };
    const original = new GameSession(new SaveStore(storage));
    original.player.gold = 177;
    original.flush();
    const before = data.get(SAVE_KEY);
    const qa = new GameSession(new SaveStore(storage, PLAYTEST_SAVE_KEY));
    expect(qa.player.gold).toBe(20);
    qa.player.gold = 8;
    qa.flush();
    expect(data.get(SAVE_KEY)).toBe(before);
    expect(new GameSession(new SaveStore(storage, PLAYTEST_SAVE_KEY)).player.gold).toBe(8);
    expect(playtestSaveKey("?playtest=" + PLAYTEST_ID)).toBe(PLAYTEST_SAVE_KEY);
    expect(playtestSaveKey("?playtest=other")).toBe(SAVE_KEY);
    expect(isPlaytest("")).toBe(false);
  });
});
