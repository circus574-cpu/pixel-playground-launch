import type { GameRuntime } from "../mountGame";
import { actorVisual, catalog } from "../assets/catalog";
import { RACES, type RaceId } from "../world/races";
import { TRAINING_NAMES } from "./training";
import type { ExamAttempt } from "./exams";

/** The loan room has no city/landscape/NPCs: load only the current hero, UI and relevant effects. */
export function examAssets(race: RaceId) {
  const world = RACES[race].world;
  const ids = new Set<string>(["ui-icons"]);
  for (const clip of Object.values(actorVisual(world, "hero").clips)) ids.add(clip.asset);
  for (const [key, effect] of Object.entries(catalog.effects))
    if (!key.includes(".") || key.startsWith(world + ".")) ids.add(effect.asset);
  const shield = catalog.renderBindings["effect.shield"];
  if (shield) ids.add(shield.asset);
  return [...ids].map((id) => {
    const asset = catalog.assets.get(id);
    if (!asset) throw Error("Brak zasobu profilu próby: " + id);
    return asset;
  });
}

/** Presentation adapter only. The pure session/attempt never imports the graphics catalog. */
export function examRuntime(attempt: ExamAttempt): GameRuntime {
  return {
    session: attempt.session,
    assets: examAssets(attempt.race),
    afterTick: () => attempt.update(),
    render: (scene) => {
      const floor = scene.add.graphics().setDepth(-100);
      floor.fillStyle(0x142f34).fillRect(0, 0, 960, 760);
      for (const b of attempt.session.world.obstacles)
        floor.fillStyle(0x536667).fillRect(b.x, b.y, b.width, b.height);
      const marks = scene.add.graphics().setDepth(1);
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
          marks
            .fillStyle(
              attempt.spec.discipline === "kiControl" || attempt.windowOpen ? 0x89df9e : 0xc98a6c,
            )
            .fillRect(580, 265, 40, 50);
          marks.lineStyle(2, 0xe9e0bb).strokeCircle(600, 300, 55);
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
        },
        dispose: () => {
          scene.events.off("update", draw);
          floor.destroy();
          marks.destroy();
          text.destroy();
        },
      };
    },
  };
}
