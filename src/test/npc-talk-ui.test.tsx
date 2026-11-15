import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCallback, useState } from "react";
import { GameHud } from "../components/game/GameHud";
import { GameSession, type Command } from "../game/session";
import { talkStore } from "../game/talk/store";

afterEach(cleanup);
beforeEach(() => talkStore.reset());

function mountSession(session: GameSession, sent: Command[] = []) {
  let update = () => {};
  function View() {
    const [state, setState] = useState(() => session.snapshot());
    update = () => setState(session.snapshot());
    const send = useCallback((command: Command) => {
      sent.push(command);
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

describe("rozmowa w świecie: pasek wyborów zamiast okna", () => {
  it("rozmówca nie otwiera okna, nie wstrzymuje gry i nie blokuje mikstur ani umiejętności", () => {
    const session = new GameSession();
    session.dialogue = "keeper";
    session.player.hp = 20;
    mountSession(session);
    expect(screen.getByRole("group", { name: "Rozmowa: " + keeperName(session) })).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(session.paused).toBe(false);
    // dawniej rozmowa wyłączała mikstury i umiejętności; teraz gra toczy się dalej
    expect(screen.getByRole("button", { name: "Mikstura życia" })).toBeEnabled();
  });

  it("każda rola ma swoje wybory: skrzynia, próba bojowa, odpoczynek w gospodzie", () => {
    const sent: Command[] = [];
    const keeper = new GameSession();
    keeper.dialogue = "keeper";
    mountSession(keeper, sent);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz depozyt / skrytkę" }));
    expect(sent).toContainEqual({ type: "chest" });
    cleanup();

    const trainer = new GameSession();
    trainer.dialogue = "trainer";
    mountSession(trainer, sent);
    expect(screen.getByRole("button", { name: "Rozpocznij próbę bojową" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Zresetuj węzły talentów KI" })).toBeDisabled();
    cleanup();

    const inn = new GameSession();
    inn.dialogue = "innkeeper";
    inn.player.hp = 10;
    inn.player.gold = 50;
    mountSession(inn, sent);
    expect(screen.getByRole("button", { name: /Odpocznij · 5 monet/ })).toBeEnabled();
  });

  it("usługi wymagające okna otwiera się na prośbę i wstrzymują grę, a powrót wznawia rozmowę", () => {
    const session = new GameSession();
    session.dialogue = "smith";
    mountSession(session);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Kuźnia i ulepszenia" }));
    expect(screen.getByRole("dialog", { name: /Usługi:/ })).toBeVisible();
    expect(session.paused).toBe(true);
    // w oknie usług nie ma powtórki rozmowy: powitania, zadań, plotek
    expect(screen.queryByRole("button", { name: "Zapytaj o plotki i wieści" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Wróć do rozmowy" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(session.paused).toBe(false);
    expect(session.dialogue).toBe("smith");
  });

  it("Esc zamyka rozmowę i okno usług", () => {
    const session = new GameSession();
    session.dialogue = "merchant";
    mountSession(session);
    fireEvent.click(screen.getByRole("button", { name: "Handel: kupno i sprzedaż" }));
    expect(session.paused).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(session.dialogue).toBeNull();
    expect(session.paused).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("plotkę, którą wybrała sesja, wypowiada rozmówca dymkiem", () => {
    const session = new GameSession();
    session.dialogue = "guide"; // stoi przy graczu na starcie; plotki wymagają bliskości rozmówcy
    const say = vi.fn();
    talkStore.handlers = { say };
    const ui = mountSession(session);
    fireEvent.click(screen.getByRole("button", { name: "Zapytaj o plotki i wieści" }));
    ui.refresh();
    expect(say).toHaveBeenCalled();
    const [npc, lines] = say.mock.calls.at(-1)!;
    expect(npc).toBe("guide");
    expect(lines[0]).toBe(session.notice);
    expect(lines[0].length).toBeGreaterThan(20);
  });
});

describe("przewodniczka i oprowadzanie w HUD", () => {
  it("rozmowa z przewodniczką ma przycisk powtórki oprowadzania, który zamyka rozmowę i prosi o trasę", () => {
    const session = new GameSession();
    session.dialogue = "guide";
    const startTour = vi.fn();
    talkStore.handlers = { startTour };
    mountSession(session);
    fireEvent.click(screen.getByRole("button", { name: "Oprowadź mnie po mieście" }));
    expect(startTour).toHaveBeenCalledTimes(1);
    expect(session.dialogue).toBeNull();
  });

  it("w trakcie trasy jest pigułka z numerem punktu i przyciskiem „Pomiń oprowadzanie”", () => {
    const session = new GameSession();
    const skipTour = vi.fn();
    talkStore.handlers = { skipTour };
    mountSession(session);
    expect(screen.queryByRole("button", { name: "Pomiń oprowadzanie" })).toBeNull();
    act(() =>
      talkStore.publish({
        speech: {},
        tour: { active: true, step: 3, steps: 7, displaced: true },
      }),
    );
    expect(screen.getByRole("status", { name: "Oprowadzanie po mieście" })).toHaveTextContent(
      "Oprowadzanie · 3/7",
    );
    // kwestie przewodniczki (dymki są na płótnie) czytają też czytniki ekranu
    act(() =>
      talkStore.publish({
        speech: { guide: { id: 7, text: "Zacznijmy od najbliższego budynku." } },
        tour: { active: true, step: 3, steps: 7, displaced: true },
      }),
    );
    expect(screen.getByRole("status", { name: "Oprowadzanie po mieście" })).toHaveTextContent(
      "Zacznijmy od najbliższego budynku.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Pomiń oprowadzanie" }));
    expect(skipTour).toHaveBeenCalledTimes(1);
    // przewodniczka poza posterunkiem nie jest rozmówcą z akcji „Rozmawiaj” przy jej dawnym miejscu
    act(() =>
      talkStore.publish({
        speech: {},
        tour: { active: false, step: 0, steps: 0, displaced: false },
      }),
    );
    expect(screen.queryByRole("button", { name: "Pomiń oprowadzanie" })).toBeNull();
  });

  it("napis bieżącej kwestii jest w obszarze aria-live dla czytników ekranu", () => {
    const session = new GameSession();
    session.dialogue = "guide";
    mountSession(session);
    act(() =>
      talkStore.publish({
        speech: { guide: { id: 1, text: "Witaj w mieście, wędrowcze." } },
        tour: { active: false, step: 0, steps: 0, displaced: false },
      }),
    );
    const caption = screen.getByText("Witaj w mieście, wędrowcze.");
    expect(caption).toHaveAttribute("aria-live", "polite");
  });
});

function keeperName(session: GameSession) {
  return session.world.npcs.find((n) => n.id === "keeper")!.name;
}
