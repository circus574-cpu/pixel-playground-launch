import type { BuildingId, Interior } from "./types";

/** Smithy furnace, racks, workbench, anvil, chest, barrels and crates: footprints match the painted props. */
const SMITHY_FURNITURE = [
  { x: 655, y: 150, width: 190, height: 65 },
  { x: 130, y: 165, width: 80, height: 35 },
  { x: 235, y: 165, width: 80, height: 35 },
  { x: 520, y: 170, width: 70, height: 40 },
  { x: 610, y: 365, width: 80, height: 30 },
  { x: 120, y: 390, width: 130, height: 40 },
  { x: 705, y: 490, width: 75, height: 25 },
  { x: 110, y: 570, width: 90, height: 50 },
  { x: 765, y: 560, width: 85, height: 45 },
  { x: 110, y: 285, width: 70, height: 25 },
];
/** Interior coordinates are local to the room, never coordinates on the planet. */
export function cityRoom(building: BuildingId): Interior {
  const furniture =
    building === "arena"
      ? []
      : building === "smithy"
        ? SMITHY_FURNITURE.map((f) => ({ ...f }))
        : [
            { x: 400, y: 175, width: 160, height: 45 },
            { x: 150, y: 155, width: 80, height: 45 },
            { x: 730, y: 155, width: 80, height: 45 },
          ];
  if (building === "depot") furniture.push({ x: 610, y: 365, width: 80, height: 30 });
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
