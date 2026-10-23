import type Phaser from "phaser";
import { textureBinding } from "../assets/catalog";
import { renderDepth } from "../assets/layers";
import type { WorldDefinition } from "../world/types";
import { cityRoom } from "./room";
import type { BuildingId } from "./types";

export function renderCityStreets(scene: Phaser.Scene, world: WorldDefinition) {
  if (!world.city) return;
  const stone = textureBinding(
    "terrain." + world.id + ".city-road",
    textureBinding("terrain.city-stone", { asset: "city-stone" }),
  );
  for (const r of world.city.roads)
    scene.add
      .tileSprite(r.x, r.y, r.width, r.height, stone.asset, stone.frame)
      .setOrigin(0)
      .setDepth(renderDepth("paths") + 5)
      .setAlpha(0.93);
  for (const b of world.city.buildings) {
    scene.add
      .ellipse(b.door.x, b.door.y, 90, 30, 0xe5ca79, 0.2)
      .setStrokeStyle(2, 0xd7c77d, 0.7)
      .setDepth(renderDepth("below", b.door.y));
    scene.add
      .text(b.door.x, b.door.y + 34, b.name + "  ↗", {
        fontFamily: "Arial",
        fontSize: "23px",
        color: "#fff0c2",
        backgroundColor: "#203c31dd",
        padding: { x: 12, y: 7 },
        stroke: "#19392c",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setResolution(2)
      .setDepth(renderDepth("objects", b.door.y + 90));
  }
}

/** Separate room presentation; the session owns all transitions and collision rules. */
export function renderCityInterior(scene: Phaser.Scene, world: WorldDefinition, id: BuildingId) {
  const room = cityRoom(id),
    b = world.city!.buildings.find((b) => b.id === id)!;
  const objects: (
    | Phaser.GameObjects.TileSprite
    | Phaser.GameObjects.Image
    | Phaser.GameObjects.Text
    | Phaser.GameObjects.Graphics
  )[] = [];
  const floorKind = id === "arena" || id === "smithy" ? "stone" : "floor";
  const floor = textureBinding(
    "terrain." + world.id + ".interior-" + floorKind,
    textureBinding("terrain.city-" + floorKind, { asset: "city-floor" }),
  );
  objects.push(
    scene.add.tileSprite(80, 82, 800, 632, floor.asset, floor.frame).setOrigin(0).setDepth(-90000),
  );
  const walls = scene.add.graphics().setDepth(-80000);
  walls.fillStyle(world.city?.palette?.wall ?? 0x162c27);
  walls.fillRect(60, 40, 840, 72);
  walls.fillStyle(world.city?.palette?.edge ?? 0x375446);
  walls.fillRect(60, 95, 40, 620);
  walls.fillRect(860, 95, 40, 620);
  walls.fillStyle(world.city?.palette?.accent ?? 0x9b8051);
  walls.fillRect(76, 104, 8, 590);
  walls.fillRect(876, 104, 8, 590);
  walls.lineStyle(3, 0xc2b17b, 0.5);
  walls.lineBetween(90, 108, 872, 108);
  walls.fillStyle(0x243d31);
  walls.fillRect(60, 697, 345, 32);
  walls.fillRect(555, 697, 345, 32);
  walls.fillStyle(0xdac184, 0.75);
  walls.fillRect(412, 696, 136, 13);
  objects.push(walls);
  const prop = (key: string, x: number, y: number, size = 150) => {
    const ref = textureBinding(
      "object." + world.id + ".interior." + key,
      textureBinding("object.city." + key, { asset: "city-props", frame: 0 }),
    );
    const image = scene.add
      .image(x, y, ref.asset, ref.frame)
      .setDisplaySize(size, size)
      .setOrigin(0.5, 0.88)
      .setDepth(y);
    objects.push(image);
  };
  if (id !== "arena") {
    prop("desk", 480, 220, 210);
    prop("shelf", 190, 200, 155);
    prop("shelf", 770, 200, 155);
  }
  if (id === "depot") prop("chest", room.chest.x, room.chest.y, 175);
  if (id === "arena") {
    const ring = scene.add.graphics().setDepth(-70000);
    ring.lineStyle(5, 0xa8976a, 0.8);
    ring.strokeCircle(room.dummy.x, room.dummy.y + 35, 145);
    ring.lineStyle(2, 0xdacb97, 0.6);
    ring.strokeCircle(room.dummy.x, room.dummy.y + 35, 120);
    objects.push(ring);
    prop("dummy", room.dummy.x, room.dummy.y, 175);
    objects.push(
      scene.add
        .text(room.dummy.x, room.dummy.y - 160, "MANEKIN · 0 OBRONY", {
          fontFamily: "Arial",
          fontSize: "17px",
          color: "#eadca6",
          stroke: "#203a2b",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(1000),
    );
  }
  if (id === "smithy") {
    prop("anvil", 650, 390, 180);
    prop("chest", 730, 500, 120);
  }
  if (id === "inn") {
    prop("bed", 660, 405, 220);
    prop("desk", 220, 480, 130);
  }
  if (id === "shop") {
    prop("chest", 660, 400, 135);
    prop("shelf", 740, 500, 150);
  }
  objects.push(
    scene.add
      .text(480, 55, b.name, {
        fontFamily: "Arial",
        fontSize: "30px",
        color: "#ecdfb0",
        stroke: "#12281e",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(1000),
  );
  objects.push(
    scene.add
      .text(room.exit.x, room.exit.y - 4, "↓  WYJŚCIE DO MIASTA", {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#f4dfab",
        backgroundColor: "#183a2dcc",
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(1000),
  );
  return { dispose: () => objects.forEach((o) => o.destroy()) };
}
