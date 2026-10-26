/** Presentation preferences are deliberately separate from character saves and migration keys. */
export const UI_PREFERENCES_KEY = "ki-legends:ui-preferences:v1";
/** One movable, resizable touch control: offset in screen px from its default place, size factor. */
export type ControlPlacement = { dx: number; dy: number; scale: number };
export const CONTROL_IDS = ["attack", "potion", "skills", "joystick"] as const;
export type ControlId = (typeof CONTROL_IDS)[number];
export type ControlLayout = Record<ControlId, ControlPlacement>;
export const CONTROL_SCALE = { min: 0.7, max: 1.6 } as const;
export const DEFAULT_CONTROLS: ControlLayout = {
  attack: { dx: 0, dy: 0, scale: 1 },
  potion: { dx: 0, dy: 0, scale: 1 },
  skills: { dx: 0, dy: 0, scale: 1 },
  joystick: { dx: 0, dy: 0, scale: 1 },
};
export type UiPreferences = {
  messages: boolean;
  worldLabels: boolean;
  largeMinimap: boolean;
  /** Background music level 0–1; 30 % by default (owner decision 26.10.2026). */
  musicVolume: number;
  musicMuted: boolean;
  /** Sound effects level 0–1; 60 % by default. */
  sfxVolume: number;
  sfxMuted: boolean;
  controls: ControlLayout;
};
export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  messages: true,
  worldLabels: true,
  largeMinimap: false,
  musicVolume: 0.3,
  musicMuted: false,
  sfxVolume: 0.6,
  sfxMuted: false,
  controls: DEFAULT_CONTROLS,
};
const finite = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
function readControls(raw: unknown): ControlLayout {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_CONTROLS };
  for (const id of CONTROL_IDS) {
    const c = (value[id] && typeof value[id] === "object" ? value[id] : {}) as Record<
      string,
      unknown
    >;
    out[id] = {
      dx: finite(c["dx"], -2000, 2000, 0),
      dy: finite(c["dy"], -2000, 2000, 0),
      scale: finite(c["scale"], CONTROL_SCALE.min, CONTROL_SCALE.max, 1),
    };
  }
  return out;
}
export function readUiPreferences(): UiPreferences {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY) ?? "null");
    if (!raw || typeof raw !== "object")
      return { ...DEFAULT_UI_PREFERENCES, controls: readControls(null) };
    const value = raw as Record<string, unknown>;
    return {
      messages: typeof value["messages"] === "boolean" ? value["messages"] : true,
      worldLabels: typeof value["worldLabels"] === "boolean" ? value["worldLabels"] : true,
      largeMinimap: typeof value["largeMinimap"] === "boolean" ? value["largeMinimap"] : false,
      musicVolume: finite(value["musicVolume"], 0, 1, DEFAULT_UI_PREFERENCES.musicVolume),
      musicMuted: typeof value["musicMuted"] === "boolean" ? value["musicMuted"] : false,
      sfxVolume: finite(value["sfxVolume"], 0, 1, DEFAULT_UI_PREFERENCES.sfxVolume),
      sfxMuted: typeof value["sfxMuted"] === "boolean" ? value["sfxMuted"] : false,
      controls: readControls(value["controls"]),
    };
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}
export function writeUiPreferences(
  value: Omit<UiPreferences, "controls" | "musicVolume" | "musicMuted" | "sfxVolume" | "sfxMuted"> &
    Partial<
      Pick<UiPreferences, "controls" | "musicVolume" | "musicMuted" | "sfxVolume" | "sfxMuted">
    >,
) {
  try {
    window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({ version: 1, ...value }));
  } catch {
    /* A blocked preference store never stops gameplay or overwrites character data. */
  }
}

/** Resting centre of the visible touch joystick (world v2) in screen px, after the player's offset. */
export function joystickRest(width: number, height: number, c: ControlPlacement) {
  return {
    x: Math.min(width - 40, Math.max(40, 84 + c.dx)),
    y: Math.min(height - 40, Math.max(40, height - 104 + c.dy)),
  };
}
