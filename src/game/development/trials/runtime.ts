import type { GameRuntime } from "../../mountGame";
import { examAssets } from "../examRuntime";
import type { TrialAttempt } from "./attempt";

/** Uses the existing Phaser mount, actors, controls and combat; only room markers are added. */
export function trialRuntime(attempt: TrialAttempt): GameRuntime {
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
      const marks = scene.add.graphics().setDepth(2);
      const title = scene.add
        .text(480, 80, attempt.definition.name, { fontSize: "21px", color: "#f4e0ae" })
        .setOrigin(0.5)
        .setDepth(2);
      const label = scene.add
        .text(0, 0, "", { fontSize: "14px", color: "#f1e6c4", backgroundColor: "#10242be8" })
        .setOrigin(0.5, 1)
        .setDepth(3);
      let next = 0;
      const draw = (now: number) => {
        if (now < next) return;
        next = now + 100;
        const result = attempt.snapshot();
        marks.clear();
        label.setVisible(!!result.point);
        if (result.point) {
          marks
            .lineStyle(3, 0x8ae3a4)
            .strokeCircle(result.point.x, result.point.y, 48)
            .fillStyle(0x8ae3a4)
            .fillCircle(result.point.x, result.point.y, 7);
          label
            .setPosition(result.point.x, result.point.y - 60)
            .setText(result.phase === "read" ? "Stanowisko · zbadaj materiały" : "Punkt próby");
        }
      };
      scene.events.on("update", draw);
      return {
        terrainMode: "racial-trial",
        updateVisibility: () => {},
        setVisible: (visible: boolean) => {
          floor.setVisible(visible);
          marks.setVisible(visible);
          title.setVisible(visible);
          label.setVisible(visible);
        },
        dispose: () => {
          scene.events.off("update", draw);
          floor.destroy();
          marks.destroy();
          title.destroy();
          label.destroy();
        },
      };
    },
  };
}
