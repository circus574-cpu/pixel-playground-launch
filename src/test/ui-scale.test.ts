import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UI_PREFERENCES_KEY,
  UI_SCALE,
  defaultUiScale,
  readUiPreferences,
} from "../game/uiPreferences";

function phone(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches }));
}
afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("skala interfejsu", () => {
  it("telefon w poziomie ma domyślnie mniejszy interfejs, reszta 100 %", () => {
    phone(true);
    expect(defaultUiScale()).toBeLessThan(1);
    expect(readUiPreferences().uiScale).toBe(defaultUiScale());
    phone(false);
    expect(defaultUiScale()).toBe(1);
  });
  it("zapisany rozmiar jest zachowany i ograniczony do zakresu", () => {
    phone(true);
    window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({ version: 1, uiScale: 0.9 }));
    expect(readUiPreferences().uiScale).toBe(0.9);
    window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({ version: 1, uiScale: 7 }));
    expect(readUiPreferences().uiScale).toBe(UI_SCALE.max);
    window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({ version: 1, uiScale: 0 }));
    expect(readUiPreferences().uiScale).toBe(UI_SCALE.min);
  });
  it("stare zapisy bez rozmiaru dostają wartość domyślną urządzenia", () => {
    phone(true);
    window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({ version: 1, messages: true }));
    expect(readUiPreferences().uiScale).toBe(defaultUiScale());
  });
});
