import type { BuildingId, Interior } from "./types";

/**
 * The Pyra smithy is a portrait room (about the aspect of a phone screen), so the whole scene fits one screen
 * without cropping. Footprints match the painted props in renderSmithy.ts.
 */
export const SMITHY_ROOM: Interior = {
  width: 540,
  height: 1100,
  entry: { x: 270, y: 900 },
  exit: { x: 270, y: 1014 },
  npc: { x: 150, y: 520 },
  chest: { x: 400, y: 720 },
  dummy: { x: 300, y: 500 },
  obstacles: [
    { x: 0, y: 0, width: 540, height: 150 },
    { x: 0, y: 0, width: 50, height: 1100 },
    { x: 490, y: 0, width: 50, height: 1100 },
    { x: 0, y: 1040, width: 540, height: 60 },
    { x: 295, y: 205, width: 200, height: 60 },
    { x: 55, y: 200, width: 100, height: 30 },
    { x: 165, y: 330, width: 80, height: 30 },
    { x: 425, y: 345, width: 70, height: 40 },
    { x: 320, y: 535, width: 80, height: 30 },
    { x: 55, y: 640, width: 130, height: 40 },
    { x: 55, y: 415, width: 70, height: 25 },
    { x: 395, y: 735, width: 75, height: 25 },
    { x: 410, y: 860, width: 80, height: 45 },
    { x: 55, y: 830, width: 90, height: 50 },
  ],
};
/** Interior coordinates are local to the room, never coordinates on the planet. */
export function cityRoom(building: BuildingId, worldId?: string): Interior {
  if (building === "smithy" && worldId === "pyra") return SMITHY_ROOM;
  const furniture =
    building === "arena"
      ? []
      : [
          { x: 400, y: 175, width: 160, height: 45 },
          { x: 150, y: 155, width: 80, height: 45 },
          { x: 730, y: 155, width: 80, height: 45 },
        ];
  if (building === "depot" || building === "smithy")
    furniture.push({ x: 610, y: 365, width: 80, height: 30 });
  if (building === "inn")
    furniture.push(
      { x: 610, y: 325, width: 125, height: 85 },
      { x: 185, y: 450, width: 70, height: 30 },
    );
  if (building === "shop")
    furniture.push(
      { x: 625, y: 380, width: 70, height: 28 },
      { x: 705, y: 458, width: 70, height: 38 },
    );
  return {
    width: 960,
    height: 760,
    entry: { x: 480, y: 610 },
    exit: { x: 480, y: 684 },
    npc: { x: 300, y: 330 },
    chest: { x: 650, y: 390 },
    dummy: { x: 600, y: 300 },
    obstacles: [
      { x: 0, y: 0, width: 960, height: 100 },
      { x: 0, y: 0, width: 100, height: 760 },
      { x: 860, y: 0, width: 100, height: 760 },
      { x: 0, y: 710, width: 960, height: 50 },
      ...furniture,
    ],
  };
}
