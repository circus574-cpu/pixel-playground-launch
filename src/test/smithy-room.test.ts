import { describe, expect, it } from "vitest";
import { cityRoom } from "../game/city/room";
import { PAINTED_WORLDS, ROOM_HEIGHT, ROOM_WIDTH, roomPicture } from "../game/city/paintedRooms";
import { BUILDING_IDS } from "../game/city/types";
import { Navigation } from "../game/navigation";
import { existsSync } from "node:fs";

describe("painted interiors of the special buildings", () => {
  for (const world of PAINTED_WORLDS)
    for (const id of BUILDING_IDS) {
      const room = cityRoom(id, world);
      const nav = new Navigation(room.width, room.height, room.obstacles);
      it(`${world}/${id}: larger room, everything reachable, picture shipped`, () => {
        // The old rooms were 960x760 (the Pyra smithy 540x1100).
        const portrait = world === "pyra" && id === "smithy";
        expect(room.width).toBe(portrait ? 1280 : ROOM_WIDTH);
        expect(room.height).toBe(portrait ? 1920 : ROOM_HEIGHT);
        expect(room.width * room.height).toBeGreaterThan(960 * 760 * 3);
        for (const p of [room.entry, room.exit, room.npc, room.chest, room.dummy])
          expect(nav.walkable(p), JSON.stringify(p)).toBe(true);
        for (const target of [room.exit, room.npc, room.chest, room.dummy])
          expect(nav.path(room.entry, target).length, JSON.stringify(target)).toBeGreaterThan(0);
        for (const o of room.obstacles) {
          expect(o.x).toBeGreaterThanOrEqual(0);
          expect(o.y).toBeGreaterThanOrEqual(0);
          expect(o.x + o.width).toBeLessThanOrEqual(room.width);
          expect(o.y + o.height).toBeLessThanOrEqual(room.height);
        }
        expect(existsSync("public" + roomPicture(world, id))).toBe(true);
      });
    }
  it("keeps the whole floor around the entrance walkable", () => {
    const room = cityRoom("hall", "verdant");
    const nav = new Navigation(room.width, room.height, room.obstacles);
    for (const dx of [-200, 0, 200])
      expect(nav.walkable({ x: room.entry.x + dx, y: room.entry.y })).toBe(true);
  });
  it("falls back to the Verdantia room for an unknown world id", () => {
    expect(cityRoom("inn", "nowhere")).toEqual(cityRoom("inn", "verdant"));
    expect(cityRoom("inn")).toEqual(cityRoom("inn", "verdant"));
  });
});
