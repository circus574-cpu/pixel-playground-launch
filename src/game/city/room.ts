import type { BuildingId, Interior } from "./types";
import { isPaintedWorld, paintedRoom } from "./paintedRooms";

/** Interior coordinates are local to the room, never coordinates on the planet. */
export function cityRoom(building: BuildingId, worldId?: string): Interior {
  // The session starts in Verdantia; any unknown world id gets that city's rooms.
  return paintedRoom(building, isPaintedWorld(worldId) ? worldId : "verdant");
}
