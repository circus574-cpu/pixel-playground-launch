import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("../game/world/generated/worldVersion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../game/world/generated/worldVersion")>();
  return { ...actual, WORLD_V2: true };
});

import { GameHud } from "../components/game/GameHud";
import { NpcDialogue } from "../components/game/AdventurePanels";
import { BOSS_CATALOG } from "../game/bosses";
import { getItemById } from "../game/items";
import { questsV2 } from "../game/quests/v2Tracker";
import { GameSession, type Command } from "../game/session";
import { WORLDS } from "../game/world/worlds";

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("SWARM audit UI/UX regressions", () => {
  it("localizes buff chips, shows 40% heal in potion tooltip, and hides CombatPanel during dialogue", () => {
    const s = new GameSession();
    s.kit.addBuff({ id: "ki-focus", ms: 60000, dealtPct: 0.15 });
    s.kit.addBuff({ id: "T", ms: 20000, atkPct: 0.25 });
    const view = s.snapshot();
    view.foes = [
      { id: "f1", name: "Dzik", level: 1, hp: 20, maxHp: 30, distance: 80, boss: false },
    ];

    const { rerender } = render(
      <GameHud
        state={view}
        error={null}
        zoom={0.48}
        onZoom={() => {}}
        fullscreen={false}
        onFullscreen={() => {}}
        onCommand={() => {}}
      />,
    );

    expect(screen.getByText(/Skupienie KI/)).toBeInTheDocument();
    expect(screen.getByText(/Tryb KI/)).toBeInTheDocument();
    expect(screen.queryByText(/ki-focus/)).toBeNull();
    expect(screen.getByRole("button", { name: "Mikstura życia" })).toHaveAttribute(
      "title",
      expect.stringContaining("Przywraca 40% maks. HP"),
    );
    expect(screen.getByRole("region", { name: "Walka" })).toBeInTheDocument();

    rerender(
      <GameHud
        state={{ ...view, dialogue: "guide" }}
        error={null}
        zoom={0.48}
        onZoom={() => {}}
        fullscreen={false}
        onFullscreen={() => {}}
        onCommand={() => {}}
      />,
    );
    expect(screen.queryByRole("region", { name: "Walka" })).toBeNull();

    rerender(
      <GameHud
        state={{ ...view, depotOpen: true }}
        error={null}
        zoom={0.48}
        onZoom={() => {}}
        fullscreen={false}
        onFullscreen={() => {}}
        onCommand={() => {}}
      />,
    );
    expect(screen.queryByRole("region", { name: "Walka" })).toBeNull();

    rerender(
      <GameHud
        state={{ ...view, inCity: true }}
        error={null}
        zoom={0.48}
        onZoom={() => {}}
        fullscreen={false}
        onFullscreen={() => {}}
        onCommand={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Plan miasta" }));
    expect(screen.getByRole("region", { name: "Usługi miasta" })).toBeInTheDocument();
  });

  it("renders race-themed NpcDialogue, all regional Warden bosses with bossId, and V2 quest deliveries", () => {
    const s = new GameSession(undefined, "legend");
    s.player.continent = "verdant";
    s.player.bagItems = { "W-V1": 2 };
    s.dialogue = "warden";
    const view = s.snapshot();

    vi.spyOn(questsV2, "deliveries").mockReturnValue([{ itemId: "W-V1", needed: 1 }]);

    const commands: Command[] = [];
    render(
      <NpcDialogue worldOverride={WORLDS.verdant} state={view} send={(c) => commands.push(c)} />,
    );

    const dialog = screen.getByRole("dialog", { name: /Rozmowa:/ });
    expect(dialog).toHaveAttribute("data-race", "legend");

    const v2Def = getItemById("W-V1")!;
    fireEvent.click(screen.getByRole("button", { name: `Przekaż ${v2Def.name} ×1` }));
    expect(commands).toContainEqual({ type: "quest-deliver", item: "W-V1" });

    const verdantBosses = BOSS_CATALOG.filter((b) => b.continent === "verdant");
    expect(verdantBosses.length).toBeGreaterThan(0);
    for (const boss of verdantBosses) {
      fireEvent.click(screen.getByRole("button", { name: `Wejdź do Leża: ${boss.name}` }));
      expect(commands).toContainEqual({
        type: "dialogue",
        action: "boss_enter",
        bossId: boss.id,
      });
    }
  });
});
