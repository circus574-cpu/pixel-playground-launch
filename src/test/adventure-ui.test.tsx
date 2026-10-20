import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useCallback, useState } from "react";
import { GameHud } from "../components/game/GameHud";
import { GameSession, type Command } from "../game/session";

afterEach(cleanup);
function mountSession(session: GameSession) {
  let update = () => {};
  function View() {
    const [state, setState] = useState(() => session.snapshot());
    update = () => setState(session.snapshot());
    const send = useCallback((command: Command) => {
      session.command(command);
      setState(session.snapshot());
    }, []);
    return (
      <GameHud
        state={state}
        error={null}
        zoom={0.48}
        onZoom={() => {}}
        fullscreen={false}
        onFullscreen={() => {}}
        onCommand={send}
      />
    );
  }
  render(<View />);
  return {
    advance(until: () => boolean, limit = 1000) {
      act(() => {
        for (let i = 0; i < limit && !until(); i++) session.tick(50);
        update();
      });
      expect(until()).toBe(true);
    },
    refresh() {
      act(() => update());
    },
  };
}
describe("HUD and actual rules integration", () => {
  it("talks, accepts, navigates from journal and claims a quest through buttons", () => {
    const session = new GameSession(),
      ui = mountSession(session);
    fireEvent.click(screen.getByRole("button", { name: /Rozmowa · Aira/ }));
    ui.advance(() => session.dialogue === "guide");
    expect(screen.getByRole("dialog", { name: "Rozmowa: Aira" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Przyjmij zadanie" }));
    fireEvent.click(screen.getByRole("button", { name: "Zamknij rozmowę" }));
    fireEvent.click(screen.getByRole("button", { name: "Dziennik" }));
    expect(session.paused).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Idź na rynek" }));
    expect(session.paused).toBe(false);
    ui.advance(() => session.player.quests.steps === "ready");
    fireEvent.click(screen.getByRole("button", { name: "Dziennik" }));
    fireEvent.click(screen.getByRole("button", { name: "Idź do Airy" }));
    ui.advance(() => session.dialogue === "guide");
    fireEvent.click(screen.getByRole("button", { name: "Odbierz nagrodę" }));
    expect(session.player.quests.steps).toBe("done");
    expect(session.player.xp).toBe(40);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(session.dialogue).toBeNull();
  });
  it("reaches the market from the direct tutorial action without opening a panel", () => {
    const session = new GameSession(),
      ui = mountSession(session);
    fireEvent.click(screen.getByRole("button", { name: /Rozmowa · Aira/ }));
    ui.advance(() => session.dialogue === "guide");
    fireEvent.click(screen.getByRole("button", { name: "Przyjmij zadanie" }));
    fireEvent.click(screen.getByRole("button", { name: "Zamknij rozmowę" }));
    fireEvent.click(screen.getByRole("button", { name: "Podejdź do rynku" }));
    ui.advance(() => session.player.quests.steps === "ready");
    expect(session.paused).toBe(false);
    expect(screen.queryByRole("button", { name: "Podejdź do rynku" })).toBeNull();
  });
  it("uses a real potion and equipment without permanently pausing movement", () => {
    const session = new GameSession();
    session.player.hp = 20;
    session.player.items.sword = 1;
    const ui = mountSession(session);
    fireEvent.click(screen.getByRole("button", { name: "Mikstura życia" }));
    expect(session.player.hp).toBe(85);
    expect(session.player.items.potion).toBe(2);
    expect(screen.getByRole("button", { name: "Mikstura życia" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Ekwipunek" }));
    fireEvent.click(screen.getByRole("button", { name: "Załóż" }));
    expect(session.player.weapon).toBe("sword");
    expect(screen.getByRole("button", { name: "Założone" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Zamknij okno" }));
    const y = session.player.y;
    session.command({ type: "move", x: session.player.x, y: y - 50 });
    ui.advance(() => session.player.y < y - 30, 50);
    expect(session.paused).toBe(false);
  });
  it("map NPC navigation approaches merchant and purchases through the dialogue", () => {
    const session = new GameSession(),
      ui = mountSession(session);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz mapę świata" }));
    fireEvent.click(screen.getByRole("button", { name: "Idź do Mio · Kupczyni" }));
    ui.advance(() => session.dialogue === "merchant");
    fireEvent.click(screen.getByRole("button", { name: "Kup · 8" }));
    expect(session.player.gold).toBe(12);
    expect(session.player.items.potion).toBe(4);
    expect(screen.getByRole("button", { name: "Kup · 40" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Do zobaczenia" }));
    expect(session.dialogue).toBeNull();
  });
});
