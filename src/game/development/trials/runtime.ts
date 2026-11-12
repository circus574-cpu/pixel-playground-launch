import { actorVisual, catalog, monsterVisual } from "../../assets/catalog";
import { registerActorAnimations } from "../../assets/phaserAssets";
import { ActorAnimation } from "../../assets/actorAnimation";
import type { GameRuntime } from "../../mountGame";
import { examAssets } from "../examRuntime";
import type { TrialAttempt } from "./attempt";

/** Uses the existing Phaser mount, actors, controls and combat; only room markers are added. */
export function trialRuntime(attempt: TrialAttempt): GameRuntime {
  const npc = ["messenger", "rescue-escort", "rescue-return"].includes(attempt.definition.kind)
    ? actorVisual(attempt.session.world.id, "npc", "hunter")
    : null;
  const assets = examAssets(attempt.race);
  if (npc)
    for (const clip of Object.values(npc.clips)) {
      const asset = catalog.assets.get(clip.asset);
      if (asset && !assets.some((a) => a.id === asset.id)) assets.push(asset);
    }
  const encounter = attempt.snapshot().combat;
  if (encounter) {
    const visual = monsterVisual(encounter.enemyKind);
    for (const clip of Object.values(visual.clips)) {
      const asset = catalog.assets.get(clip.asset);
      if (!asset) throw Error("Brak grafiki przeciwnika próby: " + encounter.enemyKind);
      if (!assets.some((a) => a.id === asset.id)) assets.push(asset);
    }
  }
  return {
    centerSmallWorld: true,
    enemyVisual: monsterVisual,
    authoritative: attempt.authoritative,
    session: attempt.session,
    assets,
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
      let companion: ReturnType<typeof scene.add.sprite> | undefined;
      let animation: ActorAnimation | undefined;
      const health = scene.add
        .text(0, 0, "", { fontSize: "13px", color: "#c4f8c5", backgroundColor: "#10242be8" })
        .setOrigin(0.5, 1);
      if (npc) {
        registerActorAnimations(scene, npc);
        const idle = npc.clips.idle!;
        companion = scene.add
          .sprite(0, 0, idle.asset, Object.values(idle.directions)[0]![0]!)
          .setDisplaySize(...npc.size)
          .setOrigin(...npc.origin);
        animation = new ActorAnimation(companion, npc);
      }
      health.setVisible(!!companion);
      let next = 0;
      const draw = (now: number) => {
        if (now < next) return;
        next = now + 100;
        const result = attempt.snapshot();
        marks.clear();
        health.setVisible(!!result.escort || !!result.waves || !!result.combat?.object);
        if (result.focus) {
          for (const danger of result.focus.dangers)
            marks
              .fillStyle(0xa42c36, 0.3)
              .fillCircle(danger.x, danger.y, danger.radius)
              .lineStyle(3, 0xff7272)
              .strokeCircle(danger.x, danger.y, danger.radius);
          for (const node of result.focus.nodes)
            marks
              .lineStyle(3, node.current ? 0xffd885 : 0x75d9e6)
              .strokeCircle(node.x, node.y, 25)
              .lineStyle(5, node.remainingMs < 5000 ? 0xff7272 : 0x75d9e6)
              .lineBetween(
                node.x - 20,
                node.y - 35,
                node.x -
                  20 +
                  40 * Math.min(1, node.remainingMs / (result.focus.target * 8000 + 2000)),
                node.y - 35,
              );
        }
        if (result.calibration) {
          for (const t of result.calibration.targets)
            marks
              .lineStyle(
                3,
                t.protected ? 0xff7272 : t.completed ? 0x597f73 : t.current ? 0xffdc8d : 0x75d9e6,
              )
              .strokeCircle(t.x, t.y, t.protected ? 30 : 25);
        }
        if (result.body?.kind === "break-windows")
          marks
            .lineStyle(4, result.body.phase === "window" ? 0x8ae3a4 : 0xedb56b)
            .strokeCircle(600, 300, result.body.shielded ? 38 : 25);
        const barrier = result.waves ?? result.cover;
        if (barrier) {
          marks
            .lineStyle(2, barrier.phase === "warning" ? 0xff817e : 0xbc8878)
            .lineBetween(
              barrier.origin.x,
              barrier.origin.y,
              result.waves?.object.x ?? barrier.point.x,
              result.waves?.object.y ?? barrier.point.y,
            )
            .strokeCircle(barrier.origin.x, barrier.origin.y, 12);
          if (result.waves) {
            const object = result.waves.object;
            marks
              .fillStyle(0x64dcf5)
              .fillTriangle(
                object.x,
                object.y - 24,
                object.x + 18,
                object.y,
                object.x,
                object.y + 24,
              )
              .fillTriangle(
                object.x,
                object.y - 24,
                object.x - 18,
                object.y,
                object.x,
                object.y + 24,
              )
              .lineStyle(3, 0xe5d28b)
              .strokeCircle(object.x, object.y, 28);
            health
              .setVisible(true)
              .setPosition(object.x, object.y - 35)
              .setDepth(object.y + 1)
              .setText(`Rdzeń · ${Math.ceil(object.hp)}% HP`);
          }
        }
        if (result.camp) {
          for (const p of result.camp.points) {
            marks
              .lineStyle(2, p.current ? 0xffdc8d : 0x78c9bc)
              .strokeRect(p.x - 16, p.y - 16, 32, 32);
          }
          marks
            .lineStyle(2, 0xd47f74, 0.7)
            .strokeCircle(result.camp.origin.x, result.camp.origin.y, 12);
        }
        for (const h of result.routeHazards)
          marks
            .lineStyle(3, 0xeb6666)
            .fillStyle(0xa42c36, 0.25)
            .fillCircle(h.x, h.y, h.radius)
            .strokeCircle(h.x, h.y, h.radius);
        if (result.combat?.object) {
          const object = result.combat.object;
          marks
            .fillStyle(0x64dcf5)
            .fillCircle(object.x, object.y, 24)
            .lineStyle(3, 0xe5d28b)
            .strokeCircle(object.x, object.y, 30);
          health
            .setVisible(true)
            .setPosition(object.x, object.y - 40)
            .setText(`${object.name} · ${Math.ceil((object.hp / object.maxHp) * 100)}% HP`);
        }
        if (result.combat?.cover && result.combat.phase === "return")
          marks
            .lineStyle(4, 0x8ae3a4)
            .strokeRect(result.combat.cover.x - 40, result.combat.cover.y - 40, 80, 80);
        companion?.setVisible(!!result.escort);
        if (result.escort && companion) {
          companion.setPosition(result.escort.x, result.escort.y).setDepth(result.escort.y);
          animation?.update(
            now,
            result.escort.moving,
            false,
            result.escort.facing,
            attempt.session.paused,
          );
          health
            .setPosition(result.escort.x, result.escort.y - 100)
            .setDepth(result.escort.y + 1)
            .setText(
              `${result.combat ? "Podopieczny" : "Posłaniec"} · ${Math.round((result.escort.hp / result.escort.maxHp) * 100)}% HP`,
            );
        }
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
          companion?.setVisible(visible);
          health.setVisible(
            visible &&
              (!!companion || !!attempt.snapshot().waves || !!attempt.snapshot().combat?.object),
          );
        },
        dispose: () => {
          scene.events.off("update", draw);
          companion?.destroy();
          health.destroy();
          floor.destroy();
          marks.destroy();
          title.destroy();
          label.destroy();
        },
      };
    },
  };
}
