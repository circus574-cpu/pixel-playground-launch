import { describe, expect, it } from "vitest";
import { GameSession } from "../game/session";
import { mirrorPresentationState } from "../game/world/generated/superiorRuntime";

// The hero is drawn in the Tryb KI form while buff "T" is in `session.kit.buffs` (mountGame) and runs while
// `session.running`. Online the server owns the kit, so these must be mirrored from its frame.
describe("online presentation mirror", () => {
  it("shows the Tryb KI form while the server reports buff T, and drops it when T ends", () => {
    const session = new GameSession();
    expect(session.kit.buffs.some((b) => b.id === "T")).toBe(false);
    mirrorPresentationState(session, { running: false, view: { buffs: [{ id: "T", ms: 6000 }] } });
    expect(session.kit.buffs.some((b) => b.id === "T")).toBe(true);
    mirrorPresentationState(session, { running: false, view: { buffs: [] } });
    expect(session.kit.buffs.some((b) => b.id === "T")).toBe(false);
  });
  it("mirrors running, and an older server without the field means walking", () => {
    const session = new GameSession();
    mirrorPresentationState(session, { running: true, view: { buffs: [] } });
    expect(session.running).toBe(true);
    mirrorPresentationState(session, { view: { buffs: [] } });
    expect(session.running).toBe(false);
  });
  it("the server frame carries running next to moving", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/server/characters/onlineSession.ts", "utf8"),
    );
    expect(source).toMatch(/moving: s\.moving,\s*\n\s*running: s\.running,/);
  });
});
