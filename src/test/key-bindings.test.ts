import { beforeEach, describe, expect, it } from "vitest";
import {
  actionFor,
  bindKey,
  DEFAULT_KEYS,
  keyLabel,
  readKeyBindings,
  skillSlot,
  writeKeyBindings,
} from "../game/keyBindings";

describe("key bindings", () => {
  beforeEach(() => localStorage.clear());
  it("defaults to Spacja / Q / E / F / 1–0 with readable labels", () => {
    expect(readKeyBindings()).toEqual(DEFAULT_KEYS);
    expect(keyLabel(DEFAULT_KEYS.attack)).toBe("Spacja");
    expect(keyLabel("q")).toBe("Q");
    expect(skillSlot("0")).toBe(10);
    expect(actionFor(DEFAULT_KEYS, "Q")).toBe("potion");
  });
  it("swaps keys instead of leaving two actions on one key, and refuses movement keys", () => {
    const next = bindKey(DEFAULT_KEYS, "attack", "1");
    expect(next.attack).toBe("1");
    expect(next.skill1).toBe(" ");
    expect(bindKey(DEFAULT_KEYS, "potion", "w")).toEqual(DEFAULT_KEYS);
  });
  it("survives a reload and ignores broken storage", () => {
    writeKeyBindings(bindKey(DEFAULT_KEYS, "loot", "g"));
    expect(readKeyBindings().loot).toBe("g");
    localStorage.setItem("ki-legends:keys:v1", "{broken");
    expect(readKeyBindings()).toEqual(DEFAULT_KEYS);
  });
});
