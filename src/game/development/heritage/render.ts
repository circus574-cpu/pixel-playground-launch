import { actorVisual } from "../../assets/catalog";
import { registerActorAnimations } from "../../assets/phaserAssets";
import { ActorAnimation } from "../../assets/actorAnimation";
import type { ProjectView } from "./projects";
import type Phaser from "phaser";
import type { GameSession } from "../../session";
import { distance } from "../../navigation";

/** Small world contacts, culled and reused; no permanent overlay over the play area. */
export class HeritageMarkers {
  private readonly markers = new Map<string, Phaser.GameObjects.Container>();
  private nextUpdate = 0;
  private readonly practiceObjects = new Map<string, Phaser.GameObjects.Container>();
  private readonly animations = new Map<string, ActorAnimation>();
  private readonly projectObjects = new Map<
    string,
    { key: string; object: Phaser.GameObjects.Container }
  >();
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
  ) {}
  update(now: number, labels: boolean) {
    if (now < this.nextUpdate) return;
    this.nextUpdate = now + 250;
    const live = new Set<string>(),
      s = this.session;
    const points = s.heritage
      .markers()
      .filter((t) => distance(t.point, s.player) < 750)
      .slice(0, 20);
    for (const target of points) {
      live.add(target.id);
      let object = this.markers.get(target.id);
      if (!object) {
        const ring = this.scene.add
          .ellipse(0, 0, 28, 14, 0xdcc786, 0.22)
          .setStrokeStyle(2, 0xe9ce85, 0.8);
        const label = this.scene.add
          .text(0, -22, target.label, {
            fontSize: "13px",
            color: "#ffe3a0",
            backgroundColor: "#10242bd9",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5, 1);
        object = this.scene.add
          .container(target.point.x, target.point.y, [ring, label])
          .setDepth(target.point.y - 1);
        if (target.witness) {
          const config = actorVisual(s.world.id, "npc", "hunter"),
            clip = config.clips.idle!;
          if (this.scene.textures.exists(clip.asset)) {
            registerActorAnimations(this.scene, config);
            const sprite = this.scene.add
              .sprite(0, 0, clip.asset, Object.values(clip.directions)[0]![0]!)
              .setDisplaySize(...config.size)
              .setOrigin(...config.origin);
            object.add(sprite);
            label.setY(-95);
            this.animations.set(target.id, new ActorAnimation(sprite, config));
          }
        }
        this.markers.set(target.id, object);
      }
      this.animations
        .get(target.id)
        ?.update(now, false, false, { x: 0, y: 1 }, s.paused || !!s.dialogue);
      const label = object.list[1] as Phaser.GameObjects.Text;
      label.setVisible(
        labels &&
          !s.paused &&
          !s.dialogue &&
          distance(target.point, s.player) > 90 &&
          distance(target.point, s.player) < 350,
      );
      label.setScale(1 / this.scene.cameras.main.zoom);
    }
    for (const [id, object] of this.markers)
      if (!live.has(id)) {
        object.destroy();
        this.markers.delete(id);
        this.animations.delete(id);
      }
    const targets = s.practiceTargets
      .list(s.player.interior)
      .filter((t) => distance(t, s.player) < 900);
    for (const t of targets) {
      let object = this.practiceObjects.get(t.id);
      if (!object) {
        const graphic = this.scene.add
          .graphics()
          .lineStyle(4, 0xb8d3c1)
          .strokeCircle(0, -35, 24)
          .lineBetween(0, -10, 0, 10)
          .lineBetween(-24, -10, 24, -10);
        const label = this.scene.add
          .text(0, -68, t.name, {
            fontSize: "12px",
            color: "#f4e0b5",
            backgroundColor: "#15262bcc",
          })
          .setOrigin(0.5, 1);
        object = this.scene.add.container(t.x, t.y, [graphic, label]).setDepth(t.y);
        this.practiceObjects.set(t.id, object);
      }
      object.setPosition(t.x, t.y).setDepth(t.y);
    }
    const targetIds = new Set(targets.map((t) => t.id));
    for (const [id, object] of this.practiceObjects)
      if (!targetIds.has(id)) {
        object.destroy();
        this.practiceObjects.delete(id);
      }
    const projects = s.heritage.projects.visible(s.player);
    const projectIds = new Set(projects.map((p) => p.id));
    for (const project of projects) {
      const key = JSON.stringify([project.done, project.obstacles, project.testimony]);
      const previous = this.projectObjects.get(project.id);
      if (previous?.key === key) continue;
      previous?.object.destroy();
      this.projectObjects.set(project.id, { key, object: this.projectObject(project) });
    }
    for (const [id, entry] of this.projectObjects)
      if (!projectIds.has(id as ProjectView["id"])) {
        entry.object.destroy();
        this.projectObjects.delete(id);
      }
  }
  private projectObject(view: ProjectView) {
    const g = this.scene.add.graphics();
    const { x, y } = view.target.point,
      kind = view.effect.kind;
    const object = this.scene.add.container(x, y, [g]).setDepth(y - 1);
    if (!view.done) {
      g.lineStyle(2, 0xba9b65, 0.8).strokeRect(-62, -44, 124, 70);
      for (const obstacle of view.obstacles)
        g.fillStyle(0x615b56).fillRoundedRect(
          obstacle.x - x,
          obstacle.y - y,
          obstacle.width,
          obstacle.height,
          5,
        );
    } else if (kind === "bridge" || kind === "route") {
      g.fillStyle(0x8e6b49);
      for (let i = 0; i < 7; i++) g.fillRect(-70, -70 + i * 18, 140, 14);
      g.lineStyle(4, 0xc7a66c).lineBetween(-76, -75, -76, 65).lineBetween(76, -75, 76, 65);
    } else if (kind === "garden") {
      g.fillStyle(0x365343).fillRoundedRect(-80, -48, 160, 80, 12);
      for (let i = 0; i < 8; i++) {
        const px = -60 + (i % 4) * 40,
          py = -34 + Math.floor(i / 4) * 40;
        g.fillStyle(0x74a86a)
          .fillEllipse(px, py, 30, 16)
          .fillEllipse(px, py - 7, 13, 25);
        g.fillStyle(0xd7c990).fillCircle(px, py - 10, 4);
      }
    } else if (kind === "flow" || kind === "power" || kind === "regeneration") {
      g.lineStyle(8, 0x51b2c9, 0.65);
      for (let i = 0; i < 3; i++) g.lineBetween(-65 + i * 60, -65, -65 + i * 60, 30);
      g.fillStyle(0x365c65).fillRoundedRect(-80, -20, 160, 40, 8);
      g.lineStyle(3, 0xa1e6dd).strokeEllipse(0, 0, 115, 35);
    } else if (kind === "shelter" || kind === "school") {
      g.fillStyle(0x806349).fillRect(-80, -10, 160, 30);
      g.fillStyle(0x42635a).fillTriangle(-90, -20, 0, -120, 90, -20);
      g.fillStyle(0xc5a774).fillRect(-75, -20, 8, 40).fillRect(67, -20, 8, 40);
    } else if (kind === "barrier") {
      g.fillStyle(0x497b80, 0.3).fillRect(-80, -85, 160, 95);
      g.lineStyle(3, 0x9cdacd, 0.8).strokeRoundedRect(-80, -85, 160, 95, 8);
    } else if (kind === "metrics" || kind === "training") {
      for (let i = 0; i < 3; i++) {
        const px = -65 + i * 65;
        g.fillStyle(0xc5a774).fillRect(px - 5, -75, 10, 80);
        g.lineStyle(4, 0xcda770).strokeCircle(px, -56, 22);
      }
    } else {
      g.fillStyle(0x705d48).fillRoundedRect(-75, -65, 150, 70, 5);
      g.lineStyle(3, 0xba9b65).strokeRoundedRect(-75, -65, 150, 70, 5);
      const records = view.testimony.length ? view.testimony.map((t) => t.name) : [view.name];
      object.add(
        this.scene.add
          .text(0, -58, records.join("\n"), {
            fontSize: "10px",
            color: "#f7e1b2",
            align: "center",
            wordWrap: { width: 135 },
          })
          .setOrigin(0.5, 0),
      );
    }
    object.add(
      this.scene.add
        .text(0, 25, view.name + (view.done ? " · odbudowano" : " · prace"), {
          fontSize: "12px",
          color: "#ecd3a3",
          backgroundColor: "#13242cc9",
          padding: { x: 3, y: 2 },
        })
        .setOrigin(0.5, 0),
    );
    return object;
  }
  dispose() {
    for (const object of this.markers.values()) object.destroy();
    this.markers.clear();
    this.animations.clear();
    for (const object of this.practiceObjects.values()) object.destroy();
    this.practiceObjects.clear();
    for (const p of this.projectObjects.values()) p.object.destroy();
    this.projectObjects.clear();
  }
}
