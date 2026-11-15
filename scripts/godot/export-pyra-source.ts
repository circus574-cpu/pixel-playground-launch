/** Read-only bridge: production definitions -> the isolated Godot city prototype. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { actorVisual, catalog, textureBinding } from "../../src/game/assets/catalog";
import { cityRoom } from "../../src/game/city/room";
import { roomPicture } from "../../src/game/city/paintedRooms";
import { getNpcDialogue } from "../../src/game/dialogue";
import { boundTownNpc } from "../../src/game/world/generated/simulationWorld";
import { v2Places } from "../../src/game/worlds/v2Places";
import type { WorldDefinition } from "../../src/game/world/types";
import type { TextureRef, ActorVisual } from "../../src/game/assets/schema";
import { RACE_BASE } from "../../src/game/kit/nodes.generated";

const file = "public/game/worlds/superior-v2/pyra/world.json";
const source = JSON.parse(readFileSync(file, "utf8")) as {
  acceptedSource: WorldDefinition;
  sourceOffset: { x: number; y: number };
};
const city = source.acceptedSource;
if (!city.city || !city.terrain) throw Error("Missing production Pyra city");
const bounds = city.city.bounds;
const crop = {
  x: bounds.x - 256,
  y: bounds.y - 384,
  width: bounds.width + 512,
  height: bounds.height + 640,
};
const used = new Set<string>();
const ref = (key: string, fallback: TextureRef) => {
  const result = textureBinding(key, fallback);
  used.add(result.asset);
  return result;
};
const actor = (visual: ActorVisual, hero: boolean) => {
  const clips = Object.fromEntries(
    Object.entries(visual.clips).filter(([s]) => s === "idle" || (hero && s === "walk")),
  );
  for (const clip of Object.values(clips)) used.add(clip.asset);
  return {
    ...visual,
    interiorScale: hero ? 1.5 : visual.size[1] >= 192 ? 1.4 : 1.6,
    clips,
  };
};
const actors: Record<string, ReturnType<typeof actor>> = {
  hero: actor(actorVisual("pyra", "hero"), true),
};
const npcs = city.npcs.map((n) => {
  actors[n.id] = actor(actorVisual("pyra", "npc", n.id), false);
  const named = boundTownNpc("pyra", "pyra-capital", v2Places("pyra"), n.id);
  const dialogue = named && getNpcDialogue(named.id);
  return {
    ...n,
    dialogue: dialogue?.greetings[0] ?? n.dialogue ?? "",
    dialogueId: named?.id ?? null,
  };
});
const objects = city.objects
  .filter(
    (o) =>
      o.x + o.width >= crop.x &&
      o.x - o.width <= crop.x + crop.width &&
      o.y + o.height >= crop.y &&
      o.y - o.height <= crop.y + crop.height,
  )
  .map((o) => ({
    ...o,
    binding: ref(
      "object.pyra." + o.id,
      textureBinding("object." + o.asset, { asset: o.asset ?? o.kind }),
    ),
  }));
const terrain = {
  ...city.terrain,
  bindings: Object.fromEntries([
    ["ground", ref("terrain." + city.terrain.ground, { asset: city.terrain.ground })],
    ["path", ref("terrain." + city.terrain.path, { asset: city.terrain.path })],
    ["plaza", ref("terrain." + city.terrain.plaza, { asset: city.terrain.plaza })],
    ...(city.terrain.zones ?? []).map((z) => [
      z.texture,
      ref("terrain." + z.texture, { asset: z.texture }),
    ]),
  ]),
};
const data = {
  format: "ki-godot-pyra-source-1",
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceWorld: {
    path: file,
    sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
    superiorOffset: source.sourceOffset,
  },
  city: {
    id: "pyra-capital",
    name: city.city.name,
    bounds,
    crop,
    spawn: city.spawn,
    movementSpeed: RACE_BASE.legend.base.speed,
    buildings: city.city.buildings,
    npcs,
    obstacles: city.obstacles,
    objects,
    terrain,
  },
  rooms: Object.fromEntries(
    city.city.buildings.map((b) => [
      b.id,
      { ...cityRoom(b.id, "pyra"), picture: roomPicture("pyra", b.id) },
    ]),
  ),
  actors,
  assets: Object.fromEntries(
    [...used].map((id) => {
      const asset = catalog.assets.get(id);
      if (!asset) throw Error("Missing source asset: " + id);
      return [id, asset];
    }),
  ),
  limits: {
    scope: "One safe capital city, no outdoor monsters",
    online: false,
    webSavesImported: false,
    prototypeOnly: true,
  },
};
mkdirSync("ports/godot-pyra/data", { recursive: true });
writeFileSync("ports/godot-pyra/data/source.generated.json", JSON.stringify(data, null, 2) + "\n");
console.log(
  JSON.stringify({
    city: data.city.name,
    buildings: data.city.buildings.length,
    npcs: npcs.length,
    objects: objects.length,
    assets: used.size,
  }),
);
