import type { Point } from "../navigation";
export const EIGHT_DIRECTIONS = [
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
] as const;
export type Direction = (typeof EIGHT_DIRECTIONS)[number];
export type CharacterVisual = {
  key: string;
  url: string;
  kind: "sheet" | "atlas";
  atlasUrl?: string;
  framePrefix?: string;
  columns: number;
  directions: readonly Direction[];
  frames: number;
  frameRate: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
};
/** Quantize real movement independently of the current four-direction artwork. */
export function facingDirection(facing: Point, directions: readonly Direction[]): Direction {
  const radians = Math.atan2(facing.y, facing.x);
  const index = (Math.round(radians / (Math.PI / 4)) + 8) % 8;
  const exact = EIGHT_DIRECTIONS[index]!;
  if (directions.includes(exact)) return exact;
  // Existing human sheet supports cardinal directions; future atlases support all eight.
  return Math.abs(facing.x) > Math.abs(facing.y)
    ? facing.x < 0
      ? "left"
      : "right"
    : facing.y < 0
      ? "up"
      : "down";
}
export function walkFrame(
  visual: CharacterVisual,
  direction: Direction,
  frame: number,
): string | number {
  return visual.kind === "atlas"
    ? `${visual.framePrefix ?? "hero"}/walk/${direction}/${String(frame).padStart(2, "0")}`
    : visual.directions.indexOf(direction) * visual.columns + frame;
}
