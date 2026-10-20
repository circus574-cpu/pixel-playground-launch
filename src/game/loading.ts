export type GameLoadingState =
  | { phase: "preparing" | "building" | "ready"; message: string; progress: null }
  | { phase: "assets"; message: string; progress: number }
  | { phase: "error"; message: string; progress: null; reload?: boolean };
export const preparingWorld = (): GameLoadingState => ({
  phase: "preparing",
  message: "Przygotowywanie świata…",
  progress: null,
});
