import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CharacterSelection } from "../components/game/CharacterSelection";
import { CharacterStore } from "../game/characters";
import { SAVE_KEY } from "../game/session";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("deleting characters", () => {
  it("removes only the chosen slot and clears the active selection", () => {
    const store = new CharacterStore(localStorage, SAVE_KEY);
    const a = store.create("sage")!,
      b = store.create("android")!;
    store.select(a);
    expect(store.remove(store.list().find((s) => s.id === a.id)!)).toBe(true);
    const left = store.list();
    expect(left.map((s) => s.id)).toEqual([b.id]);
    expect(localStorage.getItem(SAVE_KEY + ":active-character")).toBe("");
    expect(localStorage.getItem(a.key)).toBeNull();
  });
  it("never removes a slot that failed validation", () => {
    const store = new CharacterStore(localStorage, SAVE_KEY);
    localStorage.setItem(SAVE_KEY + ":character:broken", '{"version":99}');
    const slot = store.list().find((s) => s.id === "broken")!;
    expect(slot.player).toBeUndefined();
    expect(store.remove(slot)).toBe(false);
    expect(localStorage.getItem(slot.key)).toBe('{"version":99}');
  });
  it("keeps the Stage 2 original and does not bring the removed copy back", () => {
    const raw = JSON.stringify({
      version: 1,
      revision: "x",
      player: {
        level: 1,
        xp: 0,
        hp: 120,
        ki: 50,
        gold: 20,
        x: 1500,
        y: 1200,
        items: { potion: 3, tusk: 0, sword: 0, vest: 0 },
        weapon: null,
        armor: null,
        upgrade: 0,
        quests: { steps: "locked", boars: "locked", gear: "locked" },
        visited: false,
        kills: 0,
        cooldowns: { flame: 0, pulse: 0, shield: 0, attack: 0, potion: 0 },
        shield: 0,
        dead: false,
      },
    });
    localStorage.setItem(SAVE_KEY, raw);
    const store = new CharacterStore(localStorage, SAVE_KEY);
    const legacy = store.list().find((s) => s.id === "legacy")!;
    expect(store.remove(legacy)).toBe(true);
    expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
    expect(new CharacterStore(localStorage, SAVE_KEY).list()).toHaveLength(0);
  });
  it("asks for confirmation in the character list before deleting", () => {
    const store = new CharacterStore(localStorage, SAVE_KEY);
    store.create("legend");
    const slots = store.list();
    const onDelete = vi.fn();
    render(
      <CharacterSelection
        slots={slots}
        warning=""
        onCreate={() => undefined}
        onContinue={() => undefined}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Usuń postać/ }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Usuń postać/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tak, usuń" }));
    expect(onDelete).toHaveBeenCalledWith(slots[0]);
  });
  it("offers no delete button for an unreadable slot", () => {
    render(
      <CharacterSelection
        slots={[{ id: "broken", key: "k", warning: "Nieprawidłowy zapis" }]}
        warning=""
        onCreate={() => undefined}
        onContinue={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Usuń postać/ })).toBeNull();
  });
});
