import Phaser from "phaser";
import { CHARACTER_VISUALS, SHARED_ASSETS, regionAssets } from "./world/assets";
import { facingDirection, walkFrame } from "./world/characterVisual";
import { RACES, type RaceId } from "./world/races";
import { playtestSaveKey } from "./playtest";
import { renderWorld } from "./world/renderWorld";
import { clampZoom, DEFAULT_ZOOM } from "./view";
import {
  GameSession,
  SaveStore,
  type Command,
  type GameEvent,
  type GameViewState,
  type NpcId,
} from "./session";
import { distance, type Point } from "./navigation";
export type { GameViewState } from "./session";
type Actor = {
  body: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  bar: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  track: Phaser.GameObjects.Rectangle;
};

/** Phaser is the rendering/input adapter; game rules live in GameSession. */
export function mountKileGends(
  parent: HTMLElement,
  onState?: (state: GameViewState) => void,
  options?: { saveKey: string; race: RaceId },
): () => void {
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    /* SaveStore reports unavailable storage. */
  }
  const session = new GameSession(
    new SaveStore(storage, options?.saveKey ?? playtestSaveKey(window.location.search)),
    options?.race,
  );
  const world = session.world;
  const visual = CHARACTER_VISUALS[RACES[session.player.race].visual];
  class ForestScene extends Phaser.Scene {
    private actors: Actor[] = [];
    private updateVisibility?: (player: Point) => void;
    private hero!: Actor;
    private enemies = new Map<string, Actor>();
    private selection!: Phaser.GameObjects.Ellipse;
    private shield!: Phaser.GameObjects.Ellipse;
    private loot = new Map<string, Phaser.GameObjects.Container>();
    private keys: Record<string, Phaser.Input.Keyboard.Key> | undefined;
    private joystickId: number | null = null;
    private pendingTouch: Point | null = null;
    private joystickDragging = false;
    private joystickStart = new Phaser.Math.Vector2();
    private joystick = new Phaser.Math.Vector2();
    private stickBase!: Phaser.GameObjects.Arc;
    private stickKnob!: Phaser.GameObjects.Arc;
    private lastReport = 0;
    private attackUntil = 0;
    private loadFailed = false;
    constructor() {
      super("Forest");
    }
    preload() {
      this.load.on("loaderror", () => {
        this.loadFailed = true;
      });
      this.load.image(SHARED_ASSETS.creatures.key, SHARED_ASSETS.creatures.url);
      if (visual.kind === "atlas" && visual.atlasUrl)
        this.load.atlas(visual.key, visual.url, visual.atlasUrl);
      else this.load.image(visual.key, visual.url);
      if (world.id === "verdant") {
        this.load.image(SHARED_ASSETS.forestTerrain.key, SHARED_ASSETS.forestTerrain.url);
        this.load.atlas(
          SHARED_ASSETS.forestObjects.key,
          SHARED_ASSETS.forestObjects.url,
          SHARED_ASSETS.forestObjects.atlas,
        );
      } else for (const asset of regionAssets(world)) this.load.svg(asset.key, asset.url);
      this.load.spritesheet(SHARED_ASSETS.ui.key, SHARED_ASSETS.ui.url, {
        frameWidth: SHARED_ASSETS.ui.frameWidth,
        frameHeight: SHARED_ASSETS.ui.frameHeight,
      });
    }
    create() {
      if (this.loadFailed) {
        parent.dispatchEvent(
          new CustomEvent("ki:error", {
            detail: "Nie udało się wczytać zasobów świata. Odśwież stronę.",
          }),
        );
        this.scene.pause();
        return;
      }
      const atlas = this.textures.get("world-atlas");
      const source = atlas.getSourceImage() as HTMLImageElement;
      atlas.add(
        "boar",
        0,
        source.width * 0.515625,
        source.height * 0.546875,
        source.width * 0.484375,
        source.height * 0.453125,
      );
      const sheet = this.textures.get(visual.key);
      const image = sheet.getSourceImage() as HTMLImageElement;
      const w = Math.floor(image.width / visual.columns),
        h = Math.floor(image.height / visual.directions.length);
      visual.directions.forEach((direction, row) => {
        if (visual.kind === "sheet")
          for (let col = 0; col < visual.frames; col++)
            sheet.add(row * visual.columns + col, 0, col * w, row * h, w, h);
        this.anims.create({
          key: "walk-" + direction,
          frames: Array.from({ length: visual.frames }, (_, i) => ({
            key: visual.key,
            frame: walkFrame(visual, direction, i),
          })),
          frameRate: visual.frameRate,
          repeat: -1,
        });
      });
      this.cameras.main
        .setBackgroundColor(world.background)
        .setBounds(0, 0, world.width, world.height);
      this.updateVisibility = renderWorld(this, world).updateVisibility;
      this.hero = this.actor(session.player, "Ty · " + RACES[session.player.race].name);
      for (const e of session.enemies) this.enemies.set(e.id, this.actor(e, world.enemyName, true));
      for (const n of session.npcs) this.actor(n, n.name + " · " + n.role).sprite.setTint(n.tint);
      this.selection = this.add.ellipse(0, 0, 85, 32).setStrokeStyle(3, 0xffdf86).setVisible(false);
      this.shield = this.add
        .ellipse(0, 0, 100, 112, 0x85dfe8, 0.13)
        .setStrokeStyle(3, 0xaffff4)
        .setVisible(false);
      const beacon = this.add
        .ellipse(world.market.x, world.market.y, 66, 28)
        .setStrokeStyle(3, 0xfff0a1)
        .setDepth(9002);
      const beaconLabel = this.add
        .text(world.market.x, world.market.y - 50, "◆ " + world.market.label, {
          fontSize: "17px",
          color: "#fff1b1",
          stroke: "#193e48",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(9003);
      this.tweens.add({ targets: beacon, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
      this.events.on("postupdate", () => {
        const active = session.player.quests.steps === "active";
        beacon.setVisible(active);
        beaconLabel.setVisible(active).setScale(1 / this.cameras.main.zoom);
      });
      this.cameras.main.startFollow(this.hero.body, true, 0.12, 0.12);
      const zoom = () =>
        this.cameras.main.setZoom(clampZoom(Number(parent.dataset["zoom"] ?? DEFAULT_ZOOM)));
      zoom();
      parent.addEventListener("ki:zoom", zoom);
      const command = (event: Event) => {
        session.command((event as CustomEvent<Command>).detail);
        this.resetStick();
        this.report();
      };
      parent.addEventListener("ki:command", command);
      const save = () => {
        session.flush();
        this.resetStick();
      };
      parent.addEventListener("ki:flush", save);
      window.addEventListener("pagehide", save);
      document.addEventListener("visibilitychange", save);
      this.events.once("shutdown", () => {
        parent.removeEventListener("ki:zoom", zoom);
        parent.removeEventListener("ki:command", command);
        parent.removeEventListener("ki:flush", save);
        window.removeEventListener("pagehide", save);
        document.removeEventListener("visibilitychange", save);
        session.flush();
      });
      this.keys = this.input.keyboard?.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as
        Record<string, Phaser.Input.Keyboard.Key> | undefined;
      this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
        const el = document.activeElement;
        if (el instanceof HTMLElement && el.closest("input,textarea,button,[role=dialog]")) return;
        const map: Record<string, Command> = {
          "1": { type: "ability", ability: "flame" },
          "2": { type: "ability", ability: "pulse" },
          "3": { type: "ability", ability: "shield" },
          "4": { type: "ability", ability: "attack" },
          " ": { type: "ability", ability: "attack" },
          q: { type: "ability", ability: "potion" },
          e: { type: "interact", npc: session.snapshot().nearestNpc },
          Escape: { type: "cancel" },
          f: { type: "loot", id: session.snapshot().nearbyLoot[0]?.id ?? "" },
        };
        const action = map[event.key] ?? map[event.key.toLowerCase()];
        if (action && !event.repeat) {
          event.preventDefault();
          session.command(action);
          this.report();
        }
      });
      this.input.addPointer(2);
      this.stickBase = this.add
        .circle(0, 0, 48, 0x183c48, 0.5)
        .setStrokeStyle(2, 0xb8f2df)
        .setScrollFactor(0)
        .setDepth(10001)
        .setVisible(false);
      this.stickKnob = this.add
        .circle(0, 0, 20, 0xcee6b6, 0.7)
        .setScrollFactor(0)
        .setDepth(10002)
        .setVisible(false);
      this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        if (pointer.id !== this.joystickId) return;
        const dx = pointer.x - this.joystickStart.x,
          dy = pointer.y - this.joystickStart.y;
        if (!this.joystickDragging && Math.hypot(dx, dy) < 10) return;
        if (!this.joystickDragging) {
          this.joystickDragging = true;
          this.pendingTouch = null;
          session.command({ type: "cancel" });
          this.stickBase.setPosition(this.joystickStart.x, this.joystickStart.y).setVisible(true);
          this.stickKnob.setVisible(true);
        }
        this.joystick.set(dx, dy).limit(48);
        this.stickKnob.setPosition(
          this.joystickStart.x + this.joystick.x,
          this.joystickStart.y + this.joystick.y,
        );
      });
      this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.id === this.joystickId) {
          const tap = this.pendingTouch;
          this.resetStick();
          if (tap) this.interactAt(tap);
        }
      });
      this.input.on("gameout", () => this.resetStick());
      const blur = () => {
        this.resetStick();
        session.flush();
      };
      this.game.events.on("blur", blur);
      this.events.once("shutdown", () => this.game.events.off("blur", blur));
      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (session.dialogue || session.paused || session.player.dead) return;
        const pos = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
        if (
          pointer.wasTouch &&
          pointer.x < this.scale.width * 0.32 &&
          pointer.y > this.scale.height * 0.55
        ) {
          if (this.joystickId !== null) return;
          this.joystickId = pointer.id;
          this.joystickStart.set(pointer.x, pointer.y);
          this.pendingTouch = { x: pos.x, y: pos.y };
          this.joystickDragging = false;
        } else this.interactAt(pos);
        this.report();
      });
      this.report();
    }
    private interactAt(pos: Point) {
      if (session.dialogue || session.paused || session.player.dead) return;
      const hit = (p: Point, width: number, height: number) =>
        Math.abs(pos.x - p.x) <= width / 2 && pos.y >= p.y - height && pos.y <= p.y + 20;
      const npc = session.npcs.find((n) => hit(n, 84, 125));
      const enemy = session.enemies
        .filter((e) => e.hp > 0 && hit(e, 100, 125))
        .sort((a, b) => distance(pos, a) - distance(pos, b))[0];
      const loot = session.loot.find((l) => hit(l, 74, 60));
      if (npc) session.command({ type: "interact", npc: npc.id });
      else if (enemy) session.command({ type: "target", id: enemy.id });
      else if (loot) session.command({ type: "loot", id: loot.id });
      else session.command({ type: "move", x: pos.x, y: pos.y });
      this.report();
    }
    private resetStick() {
      this.joystickId = null;
      this.pendingTouch = null;
      this.joystickDragging = false;
      this.joystick.set(0, 0);
      this.stickBase?.setVisible(false);
      this.stickKnob?.setVisible(false);
    }
    private actor(p: Point, label: string, boar = false): Actor {
      const shadow = this.add.ellipse(0, 3, boar ? 50 : 31, 11, 0x102c3a, 0.3);
      const sprite = boar
        ? this.add.sprite(0, 0, "world-atlas", "boar").setDisplaySize(84, 84).setOrigin(0.5, 0.8)
        : this.add
            .sprite(0, 0, visual.key, 0)
            .setDisplaySize(visual.width, visual.height)
            .setOrigin(visual.originX, visual.originY);
      const name = this.add
        .text(p.x, p.y - 94, label, {
          fontSize: "12px",
          fontFamily: "Arial",
          color: boar ? "#fff0d1" : "#e4fff0",
          stroke: "#183c48",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(9001);
      if (label.startsWith("Ty ·")) name.setColor("#fff1a8");
      const track = this.add.rectangle(p.x, p.y - 76, 64, 6, 0x16313e).setDepth(9000);
      const bar = this.add
        .rectangle(p.x - 32, p.y - 76, 64, 6, boar ? 0xe4818e : 0x8de0c6)
        .setOrigin(0, 0.5)
        .setDepth(9001);
      if (!boar) {
        track.setVisible(false);
        bar.setVisible(false);
      }
      const actor = {
        body: this.add.container(p.x, p.y, [shadow, sprite]).setDepth(p.y),
        sprite,
        bar,
        name,
        track,
      };
      this.actors.push(actor);
      return actor;
    }
    private float(p: Point, text: string, color: string) {
      const label = this.add
        .text(p.x, p.y - 105, text, {
          fontSize: "24px",
          color,
          stroke: "#193443",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(10004);
      this.tweens.add({
        targets: label,
        y: label.y - 45,
        alpha: 0,
        duration: 1000,
        onComplete: () => label.destroy(),
      });
    }
    private effect(event: GameEvent) {
      const actor =
        event.target === "player"
          ? this.hero
          : event.target
            ? this.enemies.get(event.target)
            : undefined;
      if (event.text)
        this.float(
          event,
          event.text,
          event.target === "player" ? "#ffa1a1" : event.type === "heal" ? "#a4ffd6" : "#fff0a1",
        );
      if (event.type === "hit" && actor) {
        actor.sprite
          .setTint(event.target === "player" ? 0xff7777 : 0xffefd0)
          .setTintMode(Phaser.TintModes.FILL);
        this.time.delayedCall(130, () => actor.sprite.clearTint());
        if (event.target === "player") this.cameras.main.shake(100, 0.002);
      }
      if (event.type === "death" && actor) {
        this.tweens.killTweensOf(actor.body);
        this.tweens.add({
          targets: actor.body,
          alpha: 0,
          angle: 75,
          duration: 550,
          onComplete: () => actor.body.setVisible(false),
        });
      }
      if (event.type === "respawn") {
        const body = actor?.body ?? this.hero.body;
        this.tweens.killTweensOf(body);
        body.setAlpha(1).setAngle(0).setVisible(true);
      }
      if (event.type === "attack") {
        this.attackUntil = this.time.now + 240;
        const dir = session.facing,
          sprite = this.hero.sprite;
        this.tweens.killTweensOf(sprite);
        sprite.setPosition(0, 0).setAngle(0);
        this.tweens.add({
          targets: sprite,
          x: dir.x * 13,
          y: dir.y * 13,
          angle: dir.x >= 0 ? 12 : -12,
          duration: 110,
          yoyo: true,
        });
        if (event.ability === "pulse" && event.to) {
          const orb = this.add
            .circle(event.x, event.y - 35, 13, 0xb2ffff, 0.9)
            .setStrokeStyle(5, 0x5dd2f1, 0.5)
            .setDepth(10002);
          this.tweens.add({
            targets: orb,
            x: event.to.x,
            y: event.to.y - 30,
            duration: 200,
            onComplete: () => orb.destroy(),
          });
        } else {
          const slash = this.add.graphics().setDepth(10002),
            angle = Math.atan2(dir.y, dir.x);
          slash.lineStyle(
            event.ability === "flame" ? 10 : 5,
            event.ability === "flame" ? 0xffa45e : 0xf1ffe0,
            0.9,
          );
          slash.beginPath();
          slash.arc(event.x, event.y - 25, 70, angle - 0.8, angle + 0.8);
          slash.strokePath();
          this.tweens.add({
            targets: slash,
            alpha: 0,
            duration: 320,
            onComplete: () => slash.destroy(),
          });
        }
      }
      if (event.type === "level" || event.type === "heal" || event.type === "loot") {
        const ring = this.add
          .ellipse(event.x, event.y, 40, 20)
          .setStrokeStyle(4, event.type === "level" ? 0xffea9a : 0x9cffe0)
          .setDepth(event.y + 1);
        this.tweens.add({
          targets: ring,
          scaleX: 4,
          scaleY: 4,
          alpha: 0,
          duration: 800,
          onComplete: () => ring.destroy(),
        });
      }
    }
    private report() {
      parent.dataset["world"] = world.id;
      parent.dataset["playerX"] = String(session.player.x);
      parent.dataset["playerY"] = String(session.player.y);
      onState?.(session.snapshot());
    }
    override update(time: number, delta: number) {
      if (!this.hero || this.loadFailed || document.hidden) return;
      const dt = Math.min(delta, 100);
      session.tick(dt);
      this.updateVisibility?.(session.player);
      const focused = document.activeElement;
      const typing =
        focused instanceof HTMLElement &&
        Boolean(focused.closest("input,textarea,button,[role=dialog]"));
      const k = typing ? undefined : this.keys;
      const dx =
        Number(Boolean(k?.["D"]?.isDown || k?.["RIGHT"]?.isDown)) -
        Number(Boolean(k?.["A"]?.isDown || k?.["LEFT"]?.isDown)) +
        this.joystick.x / 48;
      const dy =
        Number(Boolean(k?.["S"]?.isDown || k?.["DOWN"]?.isDown)) -
        Number(Boolean(k?.["W"]?.isDown || k?.["UP"]?.isDown)) +
        this.joystick.y / 48;
      if (Math.hypot(dx, dy) > 0.12) session.manual(dx, dy, dt);
      this.hero.body.setPosition(session.player.x, session.player.y).setDepth(session.player.y);
      const direction = facingDirection(session.facing, visual.directions);
      if (session.moving && !session.player.dead && time > this.attackUntil)
        this.hero.sprite.play("walk-" + direction, true);
      else {
        this.hero.sprite.stop();
        this.hero.sprite.setFrame(walkFrame(visual, direction, 0));
      }
      for (const e of session.enemies) {
        const a = this.enemies.get(e.id)!;
        a.body.setPosition(e.x, e.y).setDepth(e.y);
        a.bar.width = (64 * e.hp) / e.maxHp;
        a.name.setVisible(e.hp > 0);
        a.track.setVisible(e.hp > 0);
        a.bar.setVisible(e.hp > 0);
        if (e.hp > 0)
          a.sprite.y =
            Math.sin(time / (e.mode === "chase" ? 75 : 180) + e.home.x) *
            (e.mode === "chase" ? 2 : 0.7);
      }
      for (const a of this.actors) {
        a.name
          .setPosition(
            a.body.x,
            a.body.y - 94 - (a === this.hero ? 24 / this.cameras.main.zoom : 0),
          )
          .setScale(1 / this.cameras.main.zoom);
        a.track.setPosition(a.body.x, a.body.y - 76);
        a.bar.setPosition(a.body.x - 32, a.body.y - 76);
      }
      this.selection.setVisible(Boolean(session.target));
      if (session.target)
        this.selection
          .setPosition(session.target.x, session.target.y + 7)
          .setDepth(session.target.y - 1);
      this.shield
        .setVisible(session.player.shield > 0)
        .setPosition(session.player.x, session.player.y - 40)
        .setDepth(session.player.y + 1);
      for (const l of session.loot)
        if (!this.loot.has(l.id)) {
          const icon = this.add.image(0, -17, "ui-icons", 5).setDisplaySize(34, 34);
          const label = this.add
            .text(0, 8, "◆ Łup · kliknij", {
              fontSize: "16px",
              color: "#ffe6a0",
              stroke: "#183c48",
              strokeThickness: 4,
            })
            .setOrigin(0.5);
          this.loot.set(l.id, this.add.container(l.x, l.y, [icon, label]).setDepth(9002));
        }
      for (const [id, body] of this.loot)
        if (!session.loot.some((l) => l.id === id)) {
          body.destroy();
          this.loot.delete(id);
        }
      for (const event of session.events.splice(0)) this.effect(event);
      if (time - this.lastReport > 100) {
        this.lastReport = time;
        this.report();
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    pixelArt: false,
    antialias: true,
    parent,
    width: parent.clientWidth || 960,
    height: parent.clientHeight || 540,
    backgroundColor: "#17251c",
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [ForestScene],
  });
  return () => {
    session.flush();
    game.destroy(true);
  };
}
