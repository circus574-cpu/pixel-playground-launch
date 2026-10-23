import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CharacterSelection } from "../components/game/CharacterSelection";
import { CharacterStore, slotTitle } from "../game/characters";
import { SAVE_KEY } from "../game/session";
import { NICK_MAX, isValidNick, nickError, normalizeNick } from "../game/nickname";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("nickname rules", () => {
  it("accepts Polish letters, digits and the allowed separators", () => {
    for (const ok of ["Żółć", "Kai_99", "Mistrz Ki", "O'Brien", "Ala-Ma", "A1b"])
      expect(nickError(ok), ok).toBe("");
  });
  it("treats empty as the default and rejects bad input with a message", () => {
    expect(nickError("")).toBe("");
    expect(nickError("   ")).toBe("");
    expect(nickError("ab")).toContain("co najmniej");
    expect(nickError("x".repeat(NICK_MAX + 1))).toContain("najwyżej");
    for (const bad of ["_ab", "a<b>", "a😀b", "a\tb\u0000c"])
      expect(nickError(bad), bad).not.toBe("");
  });
  it("normalizes whitespace and only stores canonical nicknames", () => {
    expect(normalizeNick("  Kai   Ki ")).toBe("Kai Ki");
    expect(isValidNick("Kai Ki")).toBe(true);
    expect(isValidNick(" Kai")).toBe(false);
    expect(isValidNick("")).toBe(false);
  });
});

describe("creating a character with a nickname", () => {
  it("saves the nickname, round-trips it and shows it in the slot title", () => {
    const store = new CharacterStore(localStorage, SAVE_KEY);
    const slot = store.create("sage", "  Mistrz   Ki ")!;
    expect(slot.player?.name).toBe("Mistrz Ki");
    const loaded = store.list().find((s) => s.id === slot.id)!;
    expect(loaded.player?.name).toBe("Mistrz Ki");
    expect(slotTitle(loaded)).toBe("Mistrz Ki · Mędrcy · poziom 1");
  });
  it("keeps the default (no name field) when no nickname is given", () => {
    const store = new CharacterStore(localStorage, SAVE_KEY);
    const slot = store.create("android")!;
    expect(slot.player?.name).toBeUndefined();
    expect(slotTitle(slot)).toBe("Androidy · poziom 1");
  });
  it("refuses an invalid nickname without writing a save", () => {
    const store = new CharacterStore(localStorage, SAVE_KEY);
    const before = localStorage.length;
    expect(store.create("legend", "a")).toBeUndefined();
    expect(localStorage.length).toBe(before);
  });
  it("rejects a hand-edited save with an invalid nickname and keeps the original", () => {
    const store = new CharacterStore(localStorage, SAVE_KEY);
    const slot = store.create("sage", "Dobry")!;
    const raw = JSON.parse(localStorage.getItem(slot.key)!);
    raw.player.name = "<script>";
    localStorage.setItem(slot.key, JSON.stringify(raw));
    const bad = store.list().find((s) => s.id === slot.id)!;
    expect(bad.player).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(slot.key)!).player.name).toBe("<script>");
  });
});

describe("nickname field on the creation screen", () => {
  it("passes a typed nickname to onCreate and blocks an invalid one", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const create = vi.fn();
    render(<CharacterSelection slots={[]} warning="" onCreate={create} onContinue={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Podgląd kontynentu: Mędrcy" }));
    const input = screen.getByLabelText("Nick postaci");
    const start = screen.getByRole("button", { name: "Rozpocznij przygodę" });
    fireEvent.change(input, { target: { value: "a" } });
    expect(start).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("co najmniej");
    fireEvent.change(input, { target: { value: " Kai  Ki " } });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(create).toHaveBeenCalledWith("sage", "Kai Ki");
  });
});
