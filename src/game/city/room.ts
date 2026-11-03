import type { RoomAtmosphere } from "./atmosphere";
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
/**
 * Painted rooms (owner-generated 4:3 backgrounds, 1920 × 1440 units): the picture is the whole room, so the
 * walls, counter and corner props are collision rectangles laid over it, and the free floor is the middle.
 */
const PAINTED_ROOMS: Readonly<
  Record<string, { art: string; room: Interior; atmosphere?: RoomAtmosphere }>
> = {
  "verdant:shop": {
    art: "interior.verdant.shop",
    // Light positions are read off the painting (lanterns, windows) in room units.
    atmosphere: {
      ambient: { color: 0x241a46, alpha: 0.1 },
      lights: [
        { x: 493, y: 130, radius: 420, color: 0xffb35a, alpha: 0.7, flicker: true },
        { x: 798, y: 140, radius: 420, color: 0xffb35a, alpha: 0.65, flicker: true },
        { x: 1162, y: 140, radius: 420, color: 0xffb35a, alpha: 0.65, flicker: true },
        { x: 1440, y: 130, radius: 420, color: 0xffb35a, alpha: 0.7, flicker: true },
        { x: 75, y: 590, radius: 380, color: 0xffa24a, alpha: 0.65, flicker: true },
        { x: 1850, y: 575, radius: 380, color: 0xffa24a, alpha: 0.65, flicker: true },
        { x: 968, y: 180, radius: 380, color: 0xcfe9a0, alpha: 0.3 },
      ],
      shafts: [
        { x: 968, y: 190, length: 760, width: 420, lean: 0, alpha: 0.4 },
        { x: 150, y: 360, length: 700, width: 300, lean: -24, alpha: 0.38 },
        { x: 1775, y: 365, length: 700, width: 300, lean: 24, alpha: 0.38 },
      ],
      motes: { x: 300, y: 300, width: 1320, height: 700, count: 36 },
    },
    room: {
      width: 1920,
      height: 1440,
      entry: { x: 955, y: 1110 },
      exit: { x: 955, y: 1300 },
      npc: { x: 955, y: 395 },
      chest: { x: 1500, y: 900 },
      dummy: { x: 700, y: 900 },
      obstacles: [
        // Left and right walls follow the slanted floor edge of the painting.
        { x: 0, y: 0, width: 225, height: 433 },
        { x: 0, y: 433, width: 165, height: 230 },
        { x: 0, y: 663, width: 110, height: 265 },
        { x: 0, y: 928, width: 70, height: 242 },
        { x: 1725, y: 0, width: 195, height: 433 },
        { x: 1772, y: 433, width: 148, height: 230 },
        { x: 1820, y: 663, width: 100, height: 265 },
        { x: 1855, y: 928, width: 65, height: 242 },
        // Back wall with the shelves and the counter, and the crates in the back corners.
        { x: 225, y: 0, width: 1500, height: 445 },
        { x: 226, y: 445, width: 170, height: 55 },
        { x: 1537, y: 445, width: 170, height: 85 },
        // Front wall with the doorway (x 830 – 1080) in the middle.
        { x: 0, y: 1170, width: 830, height: 270 },
        { x: 1080, y: 1170, width: 840, height: 270 },
      ],
    },
  },
};
/** Render bindings of every painted room of a world (their images are loaded with the world). */
export function paintedRoomArts(worldId: string): string[] {
  return Object.entries(PAINTED_ROOMS)
    .filter(([key]) => key.startsWith(worldId + ":"))
    .map(([, v]) => v.art);
}
/** Rooms wider than a screen scroll with the hero instead of being shown whole. */
export const isLargeRoom = (room: Interior) => room.width >= 1500;
/** The HD-2D mood of a painted room, if it has one. */
export function paintedRoomAtmosphere(building: BuildingId, worldId?: string) {
  return PAINTED_ROOMS[`${worldId}:${building}`]?.atmosphere;
}
/** Render binding of the painted room of a building, if it has one. */
export function paintedRoomArt(building: BuildingId, worldId?: string): string | undefined {
  return PAINTED_ROOMS[`${worldId}:${building}`]?.art;
}
/** Interior coordinates are local to the room, never coordinates on the planet. */
export function cityRoom(building: BuildingId, worldId?: string): Interior {
  const painted = PAINTED_ROOMS[`${worldId}:${building}`];
  if (painted) return painted.room;
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
