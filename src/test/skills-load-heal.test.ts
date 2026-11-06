import { describe, expect, it } from "vitest";
import { GameSession } from "../game/session";
import { Navigation } from "../game/navigation";
import { KIT_NODES } from "../game/kit/nodes.generated";
import { validLearned } from "../game/kit/progression";
import { WORLDS } from "../game/world/worlds";
import { SuperiorSaveStore } from "../game/world/generated/superiorSave";

function memoryPort() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("wczytanie postaci z niedozwolonymi umiejętnościami", () => {
  it("przycina umiejętności zamiast odrzucić postać", () => {
    const world = structuredClone(WORLDS.aether);
    Object.assign(world, {
      width: 8192,
      height: 6144,
      city: undefined,
      enemies: [],
      monsters: [],
      obstacles: [],
      spawn: { x: 3000, y: 2000 },
    });
    const g = new GameSession(undefined, "sage", {
      world,
      navigation: new Navigation(8192, 6144, []),
    });
    const p = g.player;
    p.level = 4;
    p.xp = 0;
    p.skills = ["R", ...KIT_NODES.sage.map((n) => n.id).filter((id) => id !== "R")];
    expect(validLearned(p.race, p.level, p.skills)).toBe(false);

    const index = {
      format: "superior-runtime-1",
      revision: "test",
      features: [{ id: "aether", affinity: p.continent, width: 8192, height: 6144 }],
    };
    const port = memoryPort();
    const writer = new SuperiorSaveStore(port, "slot", index as never, "aether");
    expect(writer.save(p)).toBe(true);

    const reader = new SuperiorSaveStore(port, "slot", index as never, "aether");
    const loaded = reader.load();
    expect(loaded, reader.warning).toBeDefined();
    expect(validLearned(loaded!.race, loaded!.level, loaded!.skills)).toBe(true);
    expect(loaded!.skills.length).toBeLessThanOrEqual(4);
    expect(loaded!.skills).toContain("R");
  });
});
