import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import city from "../../ports/godot-pyra/data/city.generated.json";
import source from "../../ports/godot-pyra/data/source.generated.json";
import provenance from "../../ports/godot-pyra/data/provenance.json";
import { actorVisual } from "../game/assets/catalog";
import { cityRoom } from "../game/city/room";
import { RACE_BASE } from "../game/kit/nodes.generated";
import type { BuildingId } from "../game/city/types";
import type { Direction } from "../game/assets/schema";

const base = "ports/godot-pyra/";
const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const local = (p: { x: number; y: number }) => ({
  x: p.x - city.nativeOrigin.x,
  y: p.y - city.nativeOrigin.y,
});
describe("Read-only Godot Pyra bridge uses existing accepted city data", () => {
  it("pins actual source bytes, one city, six services and no outdoor enemies", () => {
    expect(source.sourceWorld.sha256).toBe(hash(source.sourceWorld.path));
    expect(city.sourceWorld).toEqual(source.sourceWorld);
    expect(city.name).toBe(source.city.name);
    expect(city.buildings).toHaveLength(6);
    expect(city.npcs).toHaveLength(8);
    expect(city.speed).toBe(RACE_BASE.legend.base.speed);
    expect(city.spawn).toEqual(local(source.city.spawn));
    expect(city.limits.online).toBe(false);
    expect(city.limits.webSavesImported).toBe(false);
    expect(city).not.toHaveProperty("enemies");
    expect(city).not.toHaveProperty("spawns");
  });
  it("keeps native doors, residents and all collision rectangles after one translation", () => {
    for (const building of source.city.buildings)
      expect(city.buildings.find((b) => b.id === building.id)?.door).toEqual(local(building.door));
    for (const npc of source.city.npcs) {
      const result = city.npcs.find((n) => n.id === npc.id)!;
      expect({ x: result.x, y: result.y }).toEqual(local(npc));
      expect(result.name).toBe(npc.name);
      expect(result.dialogue).toBe(npc.dialogue);
    }
    expect(city.obstacles).toEqual(source.city.obstacles.map((r) => ({ ...r, ...local(r) })));
  });
  it("uses the production interior collision/entry/exit contracts for every service", () => {
    for (const building of city.buildings) {
      const actual = city.rooms[building.id as BuildingId];
      const expected = cityRoom(building.id as BuildingId, "pyra");
      for (const key of [
        "entry",
        "exit",
        "npc",
        "obstacles",
        "width",
        "height",
        "chest",
        "dummy",
      ] as const)
        expect(actual[key], building.id + ":" + key).toEqual(expected[key]);
      expect(existsSync(base + actual.picture.slice("res://".length))).toBe(true);
    }
  });
  it("preserves the current Legend clip directions, rates, origins and mirroring", () => {
    const actual = city.actors.hero;
    const canonical = actorVisual("pyra", "hero");
    expect(actual.id).toBe(canonical.id);
    expect(actual.size).toEqual(canonical.size);
    expect(actual.origin).toEqual(canonical.origin);
    for (const state of ["idle", "walk"] as const) {
      expect(actual.clips[state].fps).toBe(canonical.clips[state]!.fps);
      expect(actual.clips[state].mirrored).toEqual(canonical.clips[state]!.mirrored ?? []);
      expect(Object.keys(actual.clips[state].directions)).toEqual(
        Object.keys(canonical.clips[state]!.directions),
      );
      for (const [direction, frames] of Object.entries(actual.clips[state].directions))
        expect(frames.length).toBe(
          canonical.clips[state]!.directions[direction as Direction]!.length,
        );
    }
  });
  it("verifies all copied source and exported texture SHA-256 hashes", () => {
    for (const [path, digest] of Object.entries(provenance.sourceFiles))
      expect(hash(path), path).toBe(digest);
    for (const [path, digest] of Object.entries(provenance.exportedTextures))
      expect(hash(base + path), path).toBe(digest);
  });
  it("uses valid bounded atlas rectangles and shares identical object textures", () => {
    for (const actor of Object.values(city.actors))
      for (const clip of Object.values(actor.clips))
        for (const frames of Object.values(clip.directions))
          for (const frame of frames) {
            expect(frame.rect).toHaveLength(4);
            const bytes = readFileSync(base + frame.sheet.slice("res://".length));
            expect(bytes.subarray(1, 4).toString()).toBe("PNG");
            expect(bytes.readUInt32BE(16)).toBeLessThanOrEqual(2048);
            expect(bytes.readUInt32BE(20)).toBeLessThanOrEqual(2048);
            expect(frame.rect[0]! + frame.rect[2]!).toBeLessThanOrEqual(bytes.readUInt32BE(16));
            expect(frame.rect[1]! + frame.rect[3]!).toBeLessThanOrEqual(bytes.readUInt32BE(20));
          }
    expect(new Set(city.objects.map((o) => o.texture)).size).toBeLessThan(city.objects.length);
    expect(city.floor.every((c) => c.width <= 512 / 0.75 && c.height <= 512 / 0.75)).toBe(true);
  });
});
