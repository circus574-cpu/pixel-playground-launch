import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useCallback, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameHud } from "../components/game/GameHud";
import { LootHud } from "../components/game/LootHud";
import { lootHudDuration } from "../components/game/lootHudTiming";
import { GameSession, type Command, type LootReceipt } from "../game/session";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const receipt = (over: Partial<LootReceipt> = {}): LootReceipt => ({
  id: 1,
  x: 0,
  y: 0,
  gold: 12,
  lines: [
    { item: "tusk", name: "Kieł dzika", quantity: 2, kept: true },
    { item: "mithril-blade", name: "Ostrze mithrilowe", quantity: 1, rarity: "epic", kept: true },
    { item: "zloty-pyl", name: "Złoty pył", quantity: 3, kept: false },
  ],
  ...over,
});

describe("panel zawartości łupu", () => {
  it("pokazuje, co wypadło: nazwy, ilości, monety i pozycje bez miejsca", () => {
    const { rerender } = render(<LootHud receipt={null} />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<LootHud receipt={receipt()} />);
    const panel = screen.getByRole("status");
    expect(panel).toHaveAccessibleName(
      "Łup: Kieł dzika ×2, Ostrze mithrilowe ×1, Złoty pył ×3 (brak miejsca), 12 monet",
    );
    expect(panel).toHaveTextContent("Kieł dzika×2");
    expect(panel).toHaveTextContent("Ostrze mithrilowe×1");
    expect(panel).toHaveTextContent("Monety+12");
    expect(panel).toHaveTextContent("brak miejsca");
    // rzadkość zmienia kolor pozycji, a pozycja bez miejsca jest oznaczona jako zostawiona
    expect(panel.querySelector('[data-rarity="epic"]')).toHaveTextContent("Ostrze mithrilowe");
    expect(panel.querySelector(".is-left")).toHaveTextContent("Złoty pył");
  });

  it("gaśnie sam po kilku sekundach, a ten sam łup w kolejnych migawkach nie wydłuża odliczania", () => {
    const first = receipt();
    const { rerender } = render(<LootHud receipt={null} />);
    rerender(<LootHud receipt={first} />);
    const ms = lootHudDuration(first.lines.length, true);
    act(() => void vi.advanceTimersByTime(ms - 500));
    // tryb online zwraca nowy obiekt w każdej klatce, ale z tym samym numerem
    rerender(<LootHud receipt={{ ...first }} />);
    expect(screen.getByRole("status")).toBeVisible();
    act(() => void vi.advanceTimersByTime(600));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("nowe otwarcie zastępuje poprzednie i liczy czas od nowa", () => {
    const { rerender } = render(<LootHud receipt={null} />);
    rerender(<LootHud receipt={receipt({ id: 1 })} />);
    act(() => void vi.advanceTimersByTime(3000));
    rerender(
      <LootHud
        receipt={receipt({
          id: 2,
          gold: 0,
          lines: [{ item: "tusk", name: "Kieł dzika", quantity: 1, kept: true }],
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveAccessibleName("Łup: Kieł dzika ×1");
    act(() => void vi.advanceTimersByTime(lootHudDuration(1, false) - 100));
    expect(screen.getByRole("status")).toBeVisible();
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("łup otwarty przed zamontowaniem panelu nie wyskakuje ponownie", () => {
    render(<LootHud receipt={receipt({ id: 5 })} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("otwieranie łupu w interfejsie gry", () => {
  it("przycisk „Otwórz łup” otwiera cały łup i pokazuje jego zawartość w panelu", () => {
    const session = new GameSession();
    session.loot.push(
      {
        id: "l-1",
        x: session.player.x,
        y: session.player.y,
        item: "tusk",
        quantity: 2,
        gold: 9,
        drop: "d",
      },
      {
        id: "l-2",
        x: session.player.x,
        y: session.player.y,
        item: "",
        quantity: 0,
        gold: 4,
        drop: "d",
      },
    );
    function View() {
      const [state, setState] = useState(() => session.snapshot());
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
    expect(screen.queryByRole("button", { name: /Podnieś łup/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Otwórz łup/ }));
    expect(session.loot).toHaveLength(0);
    expect(session.player.items.tusk).toBe(2);
    expect(screen.getByRole("status", { name: "Łup: Kieł dzika ×2, 13 monet" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Otwórz łup/ })).toBeNull();
  });
});
