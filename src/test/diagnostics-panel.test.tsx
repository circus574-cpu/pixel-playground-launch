import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DiagnosticsPanel } from "../components/game/DiagnosticsPanel";
import type { GameViewState } from "../game/session";

function staffState(staff: "admin" | null = "admin"): GameViewState {
  return {
    staff,
    ready: true,
    x: 100,
    y: 100,
    god: false,
    unlimited: false,
    foes: [],
    targetId: null,
    player: { dead: false, continent: "verdant", race: "planetary", level: 10 },
  } as unknown as GameViewState;
}

describe("DiagnosticsPanel (UI)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    URL.createObjectURL = vi.fn(() => "blob:ki-diag");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("nie renderuje się dla zwykłego gracza", () => {
    const { container } = render(<DiagnosticsPanel state={staffState(null)} send={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("pokazuje przycisk, po kliknięciu nakładkę pomiaru, a po 45 s raport i pobiera plik", () => {
    const send = vi.fn();
    render(<DiagnosticsPanel state={staffState()} send={send} />);
    const trigger = screen.getByRole("button", { name: /Diagnostyka 45 s/i });
    expect(trigger).toBeDefined();

    fireEvent.click(trigger);
    expect(screen.getByRole("status", { name: /Diagnostyka urządzenia w toku/i })).toBeDefined();
    // Autonomiczne polecenia ruszają bez udziału gracza (nieśmiertelność staff).
    expect(send).toHaveBeenCalledWith({ type: "staff", action: "god" });

    act(() => {
      vi.advanceTimersByTime(46000);
    });
    expect(screen.getByText("Raport gotowy")).toBeDefined();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it("przycisk Przerwij zatrzymuje pomiar bez raportu", () => {
    render(<DiagnosticsPanel state={staffState()} send={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Diagnostyka 45 s/i }));
    fireEvent.click(screen.getByRole("button", { name: /Przerwij/i }));
    act(() => {
      vi.advanceTimersByTime(46000);
    });
    expect(screen.queryByText("Raport gotowy")).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
