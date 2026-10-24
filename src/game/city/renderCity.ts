import type Phaser from "phaser";
import { catalog, textureBinding } from "../assets/catalog";
import { renderDepth } from "../assets/layers";
import type { WorldDefinition } from "../world/types";
import { cityRoom } from "./room";
import type { TextureRef } from "../assets/schema";
import type { BuildingId } from "./types";
import { renderSmithy } from "./renderSmithy";

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
  const labels: Phaser.GameObjects.Text[] = [];
  for (const b of world.city.buildings) {
    scene.add
      .ellipse(b.door.x, b.door.y, 90, 30, 0xe5ca79, 0.2)
      .setStrokeStyle(2, 0xd7c77d, 0.7)
      .setDepth(renderDepth("below", b.door.y));
    const label = scene.add
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
    labels.push(label);
  }
  // This camera event runs after its follow/zoom matrix is updated, before drawing.
  // Hide a complete nameplate at the boundary rather than rendering half its text.
  // Alpha preserves the outside/interior visibility managed by mountGame.
  const camera = scene.cameras.main;
  type ScreenRect = Pick<DOMRect, "left" | "top" | "right" | "bottom">;
  let blocked: ScreenRect[] = [];
  let canvasRect = scene.game.canvas.getBoundingClientRect();
  let lastLayout = -Infinity;
  const fitLabels = () => {
    // DOM layout is sampled at the HUD refresh cadence, never once per label/frame.
    if (scene.time.now - lastLayout >= 100) {
      lastLayout = scene.time.now;
      canvasRect = scene.game.canvas.getBoundingClientRect();
      const stage = scene.game.canvas.closest(".ki-stage");
      blocked = Array.from(
        stage?.querySelectorAll(
          ".ki-player, .ki-map, .ki-menu, .ki-actionbar, .ki-tools-toggle, .ki-context-actions, " +
            ".ki-city-state, .ki-status-stack, .ki-location, .ki-modal, .ki-tools.is-open, .ki-chat-open",
        ) ?? [],
      )
        .map((el) => el.getBoundingClientRect())
        .filter((b) => b.width > 0 && b.height > 0);
    }
    const view = camera.worldView;
    const margin = 8 / camera.zoom;
    for (const label of labels) {
      const bounds = label.getBounds();
      const sx = canvasRect.width / scene.scale.width;
      const sy = canvasRect.height / scene.scale.height;
      const box = {
        left: canvasRect.left + (bounds.left - view.left) * camera.zoom * sx,
        right: canvasRect.left + (bounds.right - view.left) * camera.zoom * sx,
        top: canvasRect.top + (bounds.top - view.top) * camera.zoom * sy,
        bottom: canvasRect.top + (bounds.bottom - view.top) * camera.zoom * sy,
      };
      const clear = !blocked.some(
        (b) =>
          box.left < b.right + 4 &&
          box.right > b.left - 4 &&
          box.top < b.bottom + 4 &&
          box.bottom > b.top - 4,
      );
      label.setAlpha(
        bounds.left >= view.left + margin &&
          bounds.right <= view.right - margin &&
          bounds.top >= view.top + margin &&
          bounds.bottom <= view.bottom - margin &&
          clear
          ? 1
          : 0,
      );
    }
  };
  camera.on("followupdate", fitLabels);
  const release = () => camera.off("followupdate", fitLabels);
  scene.events.once("shutdown", release);
  scene.events.once("destroy", release);
}

/** Separate room presentation; the session owns all transitions and collision rules. */
export function renderCityInterior(
  scene: Phaser.Scene,
  world: WorldDefinition,
  id: BuildingId,
  bindings: Readonly<Record<string, TextureRef>> = {},
) {
  const room = cityRoom(id, world.id),
    b = world.city!.buildings.find((b) => b.id === id)!;
  if (id === "smithy" && world.id === "pyra") return renderSmithy(scene, world, room);
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
    const ref =
      bindings[key] ??
      textureBinding(
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
