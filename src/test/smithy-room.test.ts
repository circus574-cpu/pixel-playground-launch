import { describe, expect, it } from "vitest";
import { cityRoom, SMITHY_ROOM } from "../game/city/room";
import { Navigation } from "../game/navigation";

describe("Pyra smithy portrait room", () => {
  const room = cityRoom("smithy", "pyra");
  const nav = new Navigation(room.width, room.height, room.obstacles);
  it("is a portrait room only for the Pyra smithy", () => {
    expect(room).toBe(SMITHY_ROOM);
    expect(room.height).toBeGreaterThan(room.width * 1.8);
    for (const id of ["aether", "nexus", "verdant"]) {
      const other = cityRoom("smithy", id);
      expect(other.width).toBe(960);
      expect(other.height).toBe(760);
    }
    expect(cityRoom("depot", "pyra").width).toBe(960);
  });
  it("keeps entry, exit and the smithy NPC reachable", () => {
    expect(nav.walkable(room.entry)).toBe(true);
    expect(nav.walkable(room.npc)).toBe(true);
    expect(nav.walkable(room.exit)).toBe(true);
    for (const target of [room.npc, room.exit])
      expect(nav.path(room.entry, target).length).toBeGreaterThan(0);
  });
  it("keeps every footprint inside the room", () => {
    for (const o of room.obstacles) {
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.y).toBeGreaterThanOrEqual(0);
      expect(o.x + o.width).toBeLessThanOrEqual(room.width);
      expect(o.y + o.height).toBeLessThanOrEqual(room.height);
    }
  });
});
