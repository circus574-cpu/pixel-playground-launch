/**
 * Player-chosen keyboard shortcuts (Ustawienia → Klawisze). Stored beside the UI preferences, never
 * in a character save; the game and the HUD read the same table, so a button always shows the key
 * that really triggers it.
 */
export const KEY_ACTIONS = [
  "attack",
  "potion",
  "interact",
  "loot",
  "skill1",
  "skill2",
  "skill3",
  "skill4",
  "skill5",
  "skill6",
  "skill7",
  "skill8",
  "skill9",
  "skill10",
] as const;
export type KeyAction = (typeof KEY_ACTIONS)[number];
export type KeyBindings = Record<KeyAction, string>;

export const KEY_ACTION_LABEL: Record<KeyAction, string> = {
  attack: "Atak",
  potion: "Mikstura",
  interact: "Rozmowa / wejście",
  loot: "Podnieś łup",
  skill1: "Umiejętność 1",
  skill2: "Umiejętność 2",
  skill3: "Umiejętność 3",
  skill4: "Umiejętność 4",
  skill5: "Umiejętność 5",
  skill6: "Umiejętność 6",
  skill7: "Umiejętność 7",
  skill8: "Umiejętność 8",
  skill9: "Umiejętność 9",
  skill10: "Umiejętność 10",
};

export const DEFAULT_KEYS: KeyBindings = {
  attack: " ",
  potion: "q",
  interact: "e",
  loot: "f",
  skill1: "1",
  skill2: "2",
  skill3: "3",
  skill4: "4",
  skill5: "5",
  skill6: "6",
  skill7: "7",
  skill8: "8",
  skill9: "9",
  skill10: "0",
};

/** Movement and menus keep their keys: they cannot be taken by an action. */
export const RESERVED_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "escape",
  "tab",
  "enter",
]);

const STORAGE_KEY = "ki-legends:keys:v1";

export function normalizeKey(key: string) {
  return key.toLowerCase();
}

export function readKeyBindings(): KeyBindings {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const out = { ...DEFAULT_KEYS };
    for (const action of KEY_ACTIONS) {
      const k = value[action];
      if (typeof k === "string" && k && !RESERVED_KEYS.has(normalizeKey(k)))
        out[action] = normalizeKey(k);
    }
    return out;
  } catch {
    return { ...DEFAULT_KEYS };
  }
}

/** Binds a key to an action; an action that held that key before swaps to the old key. */
export function bindKey(bindings: KeyBindings, action: KeyAction, key: string): KeyBindings {
  const k = normalizeKey(key);
  if (RESERVED_KEYS.has(k)) return bindings;
  const next = { ...bindings };
  const holder = KEY_ACTIONS.find((a) => a !== action && next[a] === k);
  if (holder) next[holder] = next[action];
  next[action] = k;
  return next;
}

export function writeKeyBindings(bindings: KeyBindings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    /* A blocked store only loses the custom keys. */
  }
}

/** The action a pressed key triggers, if any. */
export function actionFor(bindings: KeyBindings, key: string): KeyAction | undefined {
  const k = normalizeKey(key);
  return KEY_ACTIONS.find((a) => bindings[a] === k);
}

/** Readable name of a key for buttons and settings. */
export function keyLabel(key: string) {
  const names: Record<string, string> = {
    " ": "Spacja",
    shift: "Shift",
    control: "Ctrl",
    alt: "Alt",
    backspace: "Backspace",
    delete: "Delete",
  };
  return names[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

/** Slot number (1–10) of a tree ability from the kit's digit, or 0 for none. */
export function skillSlot(kitKey: string) {
  return kitKey === "0" ? 10 : Number(kitKey) || 0;
}
