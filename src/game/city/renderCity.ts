import type Phaser from "phaser";
import { catalog, textureBinding } from "../assets/catalog";
import { renderDepth } from "../assets/layers";
import type { WorldDefinition } from "../world/types";
import { cityRoom } from "./room";
import { BUILDING_IDS, type BuildingId } from "./types";
import { isPaintedWorld, roomPicture } from "./paintedRooms";

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

const roomKey = (worldId: string, id: BuildingId) => `room-${worldId}-${id}`;

/**
 * Downloads the picture of one room on entry (never with the world, so it does not count against the world's
 * texture budget) and resolves once the texture exists, or false when it could not be loaded.
 */
function loadRoomTexture(scene: Phaser.Scene, worldId: string, id: BuildingId): Promise<boolean> {
  const key = roomKey(worldId, id);
  if (scene.textures.exists(key)) return Promise.resolve(true);
  if (!isPaintedWorld(worldId)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const done = () => resolve(scene.textures.exists(key));
    scene.load.once("filecomplete-image-" + key, done);
    scene.load.on("loaderror", function onError(file: { key: string }) {
      if (file.key !== key) return;
      scene.load.off("loaderror", onError);
      resolve(false);
    });
    scene.load.image(key, roomPicture(worldId, id));
    scene.load.start();
  });
}

/** Warms the browser cache with the six room pictures of the world, so entering a building does not wait. */
export function prefetchRooms(worldId: string) {
  if (!isPaintedWorld(worldId) || typeof fetch !== "function") return;
  const idle = (run: () => void) =>
    typeof window !== "undefined" && "requestIdleCallback" in window
      ? (window as unknown as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(
          run,
        )
      : setTimeout(run, 4000);
  idle(() => {
    for (const id of BUILDING_IDS)
      void fetch(roomPicture(worldId, id), { priority: "low" } as RequestInit).catch(
        () => undefined,
      );
  });
}

/** Separate room presentation; the session owns all transitions and collision rules. */
export function renderCityInterior(scene: Phaser.Scene, world: WorldDefinition, id: BuildingId) {
  const room = cityRoom(id, world.id),
    b = world.city!.buildings.find((b) => b.id === id)!;
  const objects: (
    | Phaser.GameObjects.TileSprite
    | Phaser.GameObjects.Image
    | Phaser.GameObjects.Text
    | Phaser.GameObjects.Graphics
  )[] = [];
  let disposed = false;
  const build = (painted: boolean) => {
    if (disposed) return;
    if (painted) {
      objects.push(
        scene.add
          .image(0, 0, roomKey(world.id, id))
          .setOrigin(0)
          .setDisplaySize(room.width, room.height)
          .setDepth(-90000),
      );
    } else {
      // The picture could not be loaded: a plain floor and wall keep the room usable.
      const floor = textureBinding(
        "terrain." + world.id + ".interior-floor",
        textureBinding("terrain.city-floor", { asset: "city-floor" }),
      );
      objects.push(
        scene.add
          .tileSprite(0, 0, room.width, room.height, floor.asset, floor.frame)
          .setOrigin(0)
          .setDepth(-90000),
      );
      const wall = scene.add.graphics().setDepth(-80000);
      wall.fillStyle(world.city?.palette?.wall ?? 0x162c27);
      wall.fillRect(0, 0, room.width, room.obstacles[0]?.height ?? 400);
      objects.push(wall);
    }
    objects.push(
      scene.add
        .text(room.width / 2, 60, b.name, {
          fontFamily: "Arial",
          fontSize: "44px",
          color: "#ecdfb0",
          stroke: "#12281e",
          strokeThickness: 7,
        })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(1000),
    );
    objects.push(
      scene.add
        .text(room.exit.x, room.exit.y + 18, "↓  WYJŚCIE DO MIASTA", {
          fontFamily: "Arial",
          fontSize: "22px",
          color: "#f4dfab",
          backgroundColor: "#183a2dcc",
          padding: { x: 12, y: 8 },
        })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(1000),
    );
  };
  void loadRoomTexture(scene, world.id, id).then(build);
  return {
    dispose: () => {
      disposed = true;
      objects.forEach((o) => o.destroy());
      const key = roomKey(world.id, id);
      if (scene.textures.exists(key)) scene.textures.remove(key);
    },
  };
}
