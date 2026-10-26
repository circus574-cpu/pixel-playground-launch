/** Presentation preferences are deliberately separate from character saves and migration keys. */
export const UI_PREFERENCES_KEY = "ki-legends:ui-preferences:v1";
export type UiPreferences = {
  messages: boolean;
  worldLabels: boolean;
  largeMinimap: boolean;
  /** Background music level 0–1; 30 % by default (owner decision 26.10.2026). */
  musicVolume: number;
  musicMuted: boolean;
};
export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  messages: true,
  worldLabels: true,
  largeMinimap: false,
  musicVolume: 0.3,
  musicMuted: false,
};
export function readUiPreferences(): UiPreferences {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(UI_PREFERENCES_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return { ...DEFAULT_UI_PREFERENCES };
    const value = raw as Record<string, unknown>;
    return {
      messages: typeof value["messages"] === "boolean" ? value["messages"] : true,
      worldLabels: typeof value["worldLabels"] === "boolean" ? value["worldLabels"] : true,
      largeMinimap: typeof value["largeMinimap"] === "boolean" ? value["largeMinimap"] : false,
      musicVolume:
        typeof value["musicVolume"] === "number" && Number.isFinite(value["musicVolume"])
          ? Math.min(1, Math.max(0, value["musicVolume"]))
          : DEFAULT_UI_PREFERENCES.musicVolume,
      musicMuted: typeof value["musicMuted"] === "boolean" ? value["musicMuted"] : false,
    };
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}
export function writeUiPreferences(
  value: Omit<UiPreferences, "musicVolume" | "musicMuted"> &
    Partial<Pick<UiPreferences, "musicVolume" | "musicMuted">>,
) {
  try {
    window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({ version: 1, ...value }));
  } catch {
    /* A blocked preference store never stops gameplay or overwrites character data. */
  }
}
