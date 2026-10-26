import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameMessage } from "../components/game/GameMessage";
import {
  useGameMessage,
  GAME_MESSAGE_DURATION_MS,
  type MessageEvent,
} from "../components/game/useGameMessage";
import { GameHud } from "../components/game/GameHud";
import { GameSession, initialView, SAVE_KEY } from "../game/session";
import {
  readUiPreferences,
  writeUiPreferences,
  UI_PREFERENCES_KEY,
  DEFAULT_CONTROLS,
  CONTROL_SCALE,
} from "../game/uiPreferences";
function MessageHarness({
  event,
  scope = "world",
  enabled = true,
}: {
  event: MessageEvent;
  scope?: string;
  enabled?: boolean;
}) {
  const value = useGameMessage(event, scope, enabled);
  return value.message ? <GameMessage text={value.message.text} onDismiss={value.dismiss} /> : null;
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});
describe("regression: persistent and obstructing guidance", () => {
  it("ignores the startup quest reminder and expires on wall time despite frequent unchanged snapshots", () => {
    const { rerender } = render(<MessageHarness event={{ id: 0, text: "Start" }} />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<MessageHarness event={{ id: 1, text: "Nowy cel" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nowy cel");
    for (let i = 0; i < 49; i++) {
      act(() => vi.advanceTimersByTime(100));
      rerender(<MessageHarness event={{ id: 1, text: "Nowy cel" }} />);
    }
    expect(screen.getByRole("status")).toBeVisible();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("drops an expired message immediately when a suspended browser tab resumes", () => {
    render(<MessageHarness event={{ id: 1, text: "Cel" }} />);
    expect(screen.getByRole("status")).toBeVisible();
    act(() => {
      vi.setSystemTime(Date.now() + 60000);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("does not extend a deadline when the same message is repeated before expiration", () => {
    const { rerender } = render(<MessageHarness event={{ id: 1, text: "Cel poza zasięgiem" }} />);
    act(() => vi.advanceTimersByTime(4000));
    rerender(<MessageHarness event={{ id: 2, text: "Cel poza zasięgiem" }} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("allows dismissal, never resurrects a dismissed snapshot, and accepts a later real event with identical text", () => {
    const { rerender } = render(<MessageHarness event={{ id: 1, text: "Kupiono miksturę" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Zamknij komunikat" }));
    rerender(<MessageHarness event={{ id: 1, text: "Kupiono miksturę" }} />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<MessageHarness event={{ id: 2, text: "Kupiono miksturę" }} />);
    expect(screen.getByRole("status")).toBeVisible();
    act(() => vi.advanceTimersByTime(GAME_MESSAGE_DURATION_MS));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("clears old context, displays new messages inside paused dialogs and never replays them on closing", () => {
    const { rerender } = render(<MessageHarness event={{ id: 1, text: "Podejdź do rynku" }} />);
    rerender(<MessageHarness event={{ id: 1, text: "Podejdź do rynku" }} scope="npc:guide" />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<MessageHarness event={{ id: 2, text: "Zadanie przyjęte" }} scope="npc:guide" />);
    expect(screen.getByRole("status")).toBeVisible();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<MessageHarness event={{ id: 2, text: "Zadanie przyjęte" }} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("never queues hidden messages for replay when guidance is enabled again", () => {
    const { rerender } = render(<MessageHarness event={{ id: 1, text: "A" }} enabled={false} />);
    rerender(<MessageHarness event={{ id: 2, text: "B" }} enabled={false} />);
    rerender(<MessageHarness event={{ id: 2, text: "B" }} enabled />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<MessageHarness event={{ id: 3, text: "C" }} enabled />);
    expect(screen.getByRole("status")).toHaveTextContent("C");
  });
  it("gives every gameplay message an event identity without persisting UI state in the character", () => {
    const game = new GameSession();
    expect(game.snapshot().noticeId).toBe(0);
    game.say("A");
    const first = game.snapshot().noticeId;
    game.say("A");
    expect(game.snapshot().noticeId).toBe(first + 1);
    expect(game.player).not.toHaveProperty("noticeId");
  });
  it("keeps critical save problems visible and recoverable even with normal messages disabled", () => {
    writeUiPreferences({ messages: false, worldLabels: true, largeMinimap: false });
    const state = {
      ...initialView(),
      ready: true,
      noticeId: 1,
      notice: "Nieistotna wskazówka",
      saveWarning: "Brak miejsca. Postęp nie został zapisany.",
    };
    render(
      <GameHud
        state={state}
        error={null}
        zoom={0.62}
        onZoom={() => {}}
        fullscreen={false}
        onFullscreen={() => {}}
        onCommand={() => {}}
      />,
    );
    expect(screen.queryByRole("status", { name: "Komunikat gry" })).toBeNull();
    expect(screen.getByRole("alert", { name: "Problem z zapisem" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Zamknij ostrzeżenie o zapisie" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Problem z zapisem")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Ustawienia" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Postęp nie został zapisany");
  });
});
describe("UI preferences survive refresh without touching character saves", () => {
  it("persists all three settings in an independent key", () => {
    localStorage.setItem(SAVE_KEY, "preserved");
    const value = { messages: false, worldLabels: false, largeMinimap: true };
    writeUiPreferences(value);
    expect(readUiPreferences()).toEqual({
      ...value,
      musicVolume: 0.3,
      musicMuted: false,
      controls: DEFAULT_CONTROLS,
    });
    expect(localStorage.getItem(SAVE_KEY)).toBe("preserved");
  });
  it("keeps the music level, 30 % by default, within 0–100 %", () => {
    const base = { messages: true, worldLabels: true, largeMinimap: false };
    writeUiPreferences({ ...base, musicVolume: 0.65, musicMuted: true });
    expect(readUiPreferences()).toMatchObject({ musicVolume: 0.65, musicMuted: true });
    writeUiPreferences({ ...base, musicVolume: 7 });
    expect(readUiPreferences().musicVolume).toBe(1);
  });
  it("keeps the player's control layout and clamps impossible sizes", () => {
    const controls = {
      ...DEFAULT_CONTROLS,
      attack: { dx: -40, dy: 12, scale: 1.4 },
      joystick: { dx: 30, dy: -20, scale: 9 },
    };
    writeUiPreferences({ messages: true, worldLabels: true, largeMinimap: false, controls });
    const read = readUiPreferences().controls;
    expect(read.attack).toEqual({ dx: -40, dy: 12, scale: 1.4 });
    expect(read.joystick).toEqual({ dx: 30, dy: -20, scale: CONTROL_SCALE.max });
    expect(read.potion).toEqual(DEFAULT_CONTROLS.potion);
  });
  it("handles invalid preferences and blocked storage without crashing gameplay", () => {
    localStorage.setItem(UI_PREFERENCES_KEY, "{broken");
    expect(readUiPreferences().messages).toBe(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readUiPreferences().messages).toBe(true);
    expect(() =>
      writeUiPreferences({ messages: false, worldLabels: false, largeMinimap: false }),
    ).not.toThrow();
  });
});
