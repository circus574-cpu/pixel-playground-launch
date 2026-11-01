import type Phaser from "phaser";
import type { GameRuntime } from "../mountGame";
import { actorVisual, catalog } from "../assets/catalog";
import type { AssetDefinition } from "../assets/schema";
import { RACES, type RaceId } from "../world/races";
import { TRAINING_NAMES } from "./training";
import { devArtEnabled, trainingObjectUrl } from "./developmentAssets";
import type { ExamAttempt } from "./exams";

const DEV_OBJECT_KINDS = [
  "dummy",
  "target",
  "ki-node",
  "defense",
  "ki-source",
  "checkpoint",
  "obstacle",
  "surrender",
] as const;
type DevObjectKind = (typeof DEV_OBJECT_KINDS)[number];

function devObjectTextureKey(world: string, kind: DevObjectKind): string {
  return `dev-training-${world}-${kind}`;
}

/** The loan room has no city/landscape/NPCs: load only the current hero, UI and relevant effects. */
export function examAssets(race: RaceId): AssetDefinition[] {
  const world = RACES[race].world;
  const ids = new Set<string>(["ui-icons"]);
  for (const clip of Object.values(actorVisual(world, "hero").clips)) ids.add(clip.asset);
  for (const [key, effect] of Object.entries(catalog.effects))
    if (!key.includes(".") || key.startsWith(world + ".")) ids.add(effect.asset);
  const shield = catalog.renderBindings["effect.shield"];
  if (shield) ids.add(shield.asset);
  const base = [...ids].map((id) => {
    const asset = catalog.assets.get(id);
    if (!asset) throw Error("Brak zasobu profilu próby: " + id);
    return asset;
  });
  if (devArtEnabled()) {
    for (const kind of DEV_OBJECT_KINDS) {
      const url = trainingObjectUrl(world, kind);
      if (url)
        base.push({
          id: devObjectTextureKey(world, kind),
          version: "v001",
          kind: "image",
          url,
          width: 512,
          height: 512,
        });
    }
  }
  return base;
}

/** Presentation adapter only. The pure session/attempt never imports the graphics catalog. */
export function examRuntime(attempt: ExamAttempt): GameRuntime {
  return {
    authoritative: attempt.authoritative,
    session: attempt.session,
    assets: examAssets(attempt.race),
    afterTick: () => attempt.update(),
    render: (scene) => {
      const floor = scene.add.graphics().setDepth(-100);
      floor.fillStyle(0x142f34).fillRect(0, 0, 960, 760);
      for (const b of attempt.session.world.obstacles)
        floor.fillStyle(0x536667).fillRect(b.x, b.y, b.width, b.height);
      const marks = scene.add.graphics().setDepth(1);
      const world = RACES[attempt.race].world;
      const keyFor = (kind: DevObjectKind) => devObjectTextureKey(world, kind);
      const props: Phaser.GameObjects.Image[] = [];
      if (
        ["strength", "kiControl"].includes(attempt.spec.discipline) &&
        scene.textures.exists(keyFor("dummy"))
      ) {
        props.push(
          scene.add
            .image(600, 315, keyFor("dummy"))
            .setDisplaySize(112, 112)
            .setOrigin(0.5, 0.88)
            .setDepth(315),
        );
      }
      if (attempt.spec.discipline === "kiCapacity" && scene.textures.exists(keyFor("ki-node"))) {
        for (const pt of attempt.points)
          props.push(
            scene.add
              .image(pt.x, pt.y + 8, keyFor("ki-node"))
              .setDisplaySize(84, 84)
              .setOrigin(0.5, 0.88)
              .setDepth(pt.y),
          );
        if (scene.textures.exists(keyFor("ki-source")))
          props.push(
            scene.add
              .image(480, 382, keyFor("ki-source"))
              .setDisplaySize(104, 104)
              .setOrigin(0.5, 0.88)
              .setDepth(370),
          );
      }
      if (attempt.spec.discipline === "endurance" && scene.textures.exists(keyFor("checkpoint"))) {
        for (const pt of attempt.points)
          props.push(
            scene.add
              .image(pt.x, pt.y + 10, keyFor("checkpoint"))
              .setDisplaySize(88, 88)
              .setOrigin(0.5, 0.88)
              .setDepth(pt.y),
          );
      }
      if (attempt.spec.discipline === "defense" && scene.textures.exists(keyFor("defense"))) {
        props.push(
          scene.add
            .image(480, 175, keyFor("defense"))
            .setDisplaySize(96, 96)
            .setOrigin(0.5, 0.88)
            .setDepth(175),
        );
      }
      if (scene.textures.exists(keyFor("obstacle"))) {
        for (const b of attempt.session.world.obstacles)
          props.push(
            scene.add
              .image(b.x + b.width / 2, b.y + b.height, keyFor("obstacle"))
              .setDisplaySize(Math.max(72, b.width + 16), Math.max(72, b.height + 24))
              .setOrigin(0.5, 0.88)
              .setDepth(b.y + b.height),
          );
      }
      if (scene.textures.exists(keyFor("surrender"))) {
        props.push(
          scene.add
            .image(140, 680, keyFor("surrender"))
            .setDisplaySize(96, 96)
            .setOrigin(0.5, 0.88)
            .setDepth(680),
        );
      }
      const text = scene.add
        .text(480, 80, `${TRAINING_NAMES[attempt.spec.discipline]} · ${attempt.spec.tier}`, {
          fontSize: "23px",
          color: "#f4e0ae",
        })
        .setOrigin(0.5)
        .setDepth(2);
      const draw = () => {
        marks.clear();
        const target = attempt.currentPoint;
        if (target && ["endurance", "kiCapacity"].includes(attempt.spec.discipline)) {
          marks.lineStyle(4, 0x8ae3a4).strokeCircle(target.x, target.y, 48);
          marks.fillStyle(0x8ae3a4).fillCircle(target.x, target.y, 8);
        }
        if (attempt.spec.discipline === "kiCapacity")
          marks.lineStyle(4, 0x70d9ff).strokeCircle(480, 370, 62);
        if (["strength", "kiControl"].includes(attempt.spec.discipline)) {
          if (!props.length)
            marks
              .fillStyle(
                attempt.spec.discipline === "kiControl" || attempt.windowOpen ? 0x89df9e : 0xc98a6c,
              )
              .fillRect(580, 265, 40, 50);
          marks
            .lineStyle(
              3,
              attempt.spec.discipline === "kiControl" || attempt.windowOpen ? 0x89df9e : 0xe9e0bb,
            )
            .strokeCircle(600, 300, 55);
        }
      };
      scene.events.on("update", draw);
      return {
        terrainMode: "development-exam",
        updateVisibility: () => {},
        setVisible: (visible) => {
          floor.setVisible(visible);
          marks.setVisible(visible);
          text.setVisible(visible);
          for (const p of props) p.setVisible(visible);
        },
        dispose: () => {
          scene.events.off("update", draw);
          floor.destroy();
          marks.destroy();
          text.destroy();
          for (const p of props) p.destroy();
        },
      };
    },
  };
}
