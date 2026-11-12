import type { Point } from "../../navigation";
import type { TrialTier } from "./catalog";

export type MirrorBoard = {
  size: number;
  source: Point;
  receiver: Point;
  protected: Point;
  mirrors: readonly Point[];
};
export function mirrorBoard(tier: TrialTier): MirrorBoard {
  return {
    size: 8,
    source: { x: 0, y: 6 },
    receiver: [
      { x: 0, y: 3 },
      { x: 1, y: 7 },
      { x: 7, y: 5 },
    ][tier - 1]!,
    protected: { x: 2, y: 7 },
    mirrors: [
      { x: 2, y: 6 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 5 },
    ].slice(0, tier + 1),
  };
}
/** Shared deterministic ray tracing. The server validates the actual route, not an answer key. */
export function traceMirrors(board: MirrorBoard, answer: string) {
  const orientations = answer.split(","),
    path: Point[] = [{ ...board.source }],
    visited = new Set<string>(),
    touched = new Set<number>();
  const end = (outcome: "receiver" | "protected" | "outside" | "loop" | "invalid") => ({
    outcome,
    path,
    passed: outcome === "receiver" && touched.size === board.mirrors.length,
  });
  if (
    orientations.length !== board.mirrors.length ||
    orientations.some((v) => v !== "/" && v !== "\\")
  )
    return end("invalid");
  let x = board.source.x,
    y = board.source.y,
    dx = 1,
    dy = 0;
  for (let step = 0; step < board.size * board.size * 4; step++) {
    x += dx;
    y += dy;
    if (x < 0 || y < 0 || x >= board.size || y >= board.size) return end("outside");
    path.push({ x, y });
    if (x === board.protected.x && y === board.protected.y) return end("protected");
    if (x === board.receiver.x && y === board.receiver.y) return end("receiver");
    const key = `${x}:${y}:${dx}:${dy}`;
    if (visited.has(key)) return end("loop");
    visited.add(key);
    const index = board.mirrors.findIndex((m) => m.x === x && m.y === y);
    if (index >= 0) {
      touched.add(index);
      [dx, dy] = orientations[index] === "/" ? [-dy, -dx] : [dy, dx];
    }
  }
  return end("loop");
}
