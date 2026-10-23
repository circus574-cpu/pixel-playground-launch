import { INTERACTION_BOUNDS } from "./geometry";
import Phaser from "phaser";
import { readUiPreferences } from "./uiPreferences";
import type { GameLoadingState } from "./loading";
import { runBench } from "./debugBench";
import { actorVisual, catalog, worldAssets, worldRenderRefs } from "./assets/catalog";
import { queueAssets, prepareTextures, registerActorAnimations } from "./assets/phaserAssets";
import { ActorAnimation } from "./assets/actorAnimation";
import type { ActorVisual } from "./assets/schema";
import { renderDepth } from "./assets/layers";
import { installRenderTelemetry } from "./assets/telemetry";
import { RACES, type RaceId } from "./world/races";
import { playtestSaveKey } from "./playtest";
import { renderWorld } from "./world/renderWorld";
import { renderCityStreets, renderCityInterior } from "./city/renderCity";
import { cityRoom } from "./city/room";
import type { BuildingId } from "./city/types";
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
  npcId?: NpcId;
  kind: "hero" | "npc" | "enemy";
  body: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  bar: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  track: Phaser.GameObjects.Rectangle;
  visual: ActorVisual;
  animation: ActorAnimation;
  facing: Point;
};

/** Phaser is the rendering/input adapter; game rules live in GameSession. */
export function mountKileGends(
  parent: HTMLElement,
  onState?: (state: GameViewState) => void,
  options?: { saveKey: string; race: RaceId; onLoading?: (state: GameLoadingState) => void },
): () => void {
  let disposed = false;
  const releaseScene: (() => void)[] = [];
  const loading = (state: GameLoadingState) => {
    if (!disposed) options?.onLoading?.(state);
  };
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
  let worldLabels = readUiPreferences().worldLabels;
  parent.dataset["worldLabels"] = String(worldLabels);
  // Diagnostic art is available only on the isolated local playtest document.
  const preview =
    location.pathname === "/scripts/playtest.html" &&
    new URLSearchParams(location.search).get("ki-art") === "technical";
  const visual = actorVisual(world.id, "hero", undefined, preview);
  const assets = worldAssets(world.id, preview);
  const loadStarted = performance.now();
  class ForestScene extends Phaser.Scene {
    private actors: Actor[] = [];
    private updateVisibility?: (player: Point) => void;
    private outsideObjects: (Phaser.GameObjects.GameObject &
      Phaser.GameObjects.Components.Visible)[] = [];
    private interiorView: { dispose: () => void } | undefined;
    private lastInterior: BuildingId | null | undefined;
    private hero!: Actor;
    private enemies = new Map<string, Actor>();
    private selection!: Phaser.GameObjects.Ellipse;
    private shield!: Phaser.GameObjects.Ellipse | Phaser.GameObjects.Sprite;
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
    private animationTime = 0;
    private suspended = false;
    private loadFailed = false;
    constructor() {
      super("Forest");
    }
    preload() {
      loading({
        phase: "assets",
        message: "Ładowanie kontynentu: " + world.name + "…",
        progress: 0,
      });
      this.load.on("progress", (progress: number) => {
        if (!this.loadFailed)
          loading({
            phase: "assets",
            message: "Ładowanie kontynentu: " + world.name + "…",
            progress,
          });
      });
      this.load.on("loaderror", (file: Phaser.Loader.File) => {
        this.loadFailed = true;
        loading({
          phase: "error",
          progress: null,
          message:
            "Nie udało się pobrać zasobu: " +
            file.key +
            ". Sprawdź połączenie i ponów próbę. Twój zapis pozostaje bezpieczny.",
        });
      });
      queueAssets(this, assets);
    }
    create() {
      if (this.loadFailed) {
        this.scene.pause();
        return;
      }
      loading({ phase: "building", message: "Przywoływanie bohatera…", progress: null });
      try {
        this.initializeWorld();
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          if (!this.loadFailed)
            loading({ phase: "ready", message: "Świat gotowy", progress: null });
          parent.dataset["loadMs"] = String(Math.round(performance.now() - loadStarted));
        });
      } catch (error) {
        this.loadFailed = true;
        loading({
          phase: "error",
          progress: null,
          message:
            "Nie udało się przygotować świata. " +
            (error instanceof Error ? error.message : "Błąd zasobów.") +
            " Ponów próbę. Zapis postaci został zachowany.",
        });
        this.scene.pause();
      }
    }
    private initializeWorld() {
      prepareTextures(this, assets);
      for (const ref of worldRenderRefs(world.id))
        if (ref.frame !== undefined && !this.textures.get(ref.asset).has(String(ref.frame)))
          throw new Error("Brak klatki świata: " + ref.asset + "/" + ref.frame);
      for (const [id, effect] of Object.entries(catalog.effects).filter(
        ([key]) => !key.includes(".") || key.startsWith(world.id + "."),
      ))
        for (const frame of effect.frames)
          if (!this.textures.get(effect.asset).has(String(frame)))
            throw new Error("Brak klatki efektu: " + id + "/" + frame);
      releaseScene.push(installRenderTelemetry(this, parent));
      parent.dataset["textureIds"] = JSON.stringify(assets.map((a) => a.id));
      this.cameras.main
        .setBackgroundColor(world.background)
        .setBounds(0, 0, world.width, world.height);
      const beforeWorld = new Set(this.children.list);
      const rendering = renderWorld(this, world);
      renderCityStreets(this, world);
      this.outsideObjects = this.children.list.filter(
        (o): o is Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible =>
          !beforeWorld.has(o) && "setVisible" in o,
      );
      this.updateVisibility = rendering.updateVisibility;
      parent.dataset["terrainMode"] = rendering.terrainMode;
      releaseScene.push(rendering.dispose);
      releaseScene.push(() => this.interiorView?.dispose());
      this.hero = this.actor(
        session.player,
        "Ty · " + RACES[session.player.race].name,
        "hero",
        visual,
      );
      this.syncEnemies();
      for (const n of world.npcs) {
        const actor = this.actor(n, n.name, "npc", actorVisual(world.id, "npc", n.id));
        actor.npcId = n.id;
        if (actor.visual.tintable) actor.sprite.setTint(n.tint);
      }
      this.selection = this.add.ellipse(0, 0, 85, 32).setStrokeStyle(3, 0xffdf86).setVisible(false);
      const shieldArt = catalog.renderBindings["effect.shield"];
      this.shield = shieldArt
        ? this.add.sprite(0, 0, shieldArt.asset, shieldArt.frame).setDisplaySize(100, 112)
        : this.add.ellipse(0, 0, 100, 112, 0x85dfe8, 0.13).setStrokeStyle(3, 0xaffff4);
      this.shield.setVisible(false);
      const beacon = this.add
        .ellipse(world.market.x, world.market.y, 66, 28)
        .setStrokeStyle(3, 0xfff0a1)
        .setDepth(renderDepth("below", world.market.y));
      this.tweens.add({ targets: beacon, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
      this.events.on("postupdate", () => {
        const active =
          session.player.quests.steps === "active" && !session.paused && !session.dialogue;
        beacon.setVisible(active);
      });
      this.cameras.main.startFollow(this.hero.body, true, 0.12, 0.12);
      const zoom = () => {
        this.cameras.main.setZoom(clampZoom(Number(parent.dataset["zoom"] ?? DEFAULT_ZOOM)));
        if (session.player.interior) {
          const room = cityRoom(session.player.interior, world.id);
          const cam = this.cameras.main;
          if (room.height > room.width) {
            // Portrait room: composed for a tall screen, shown whole. Wide screens fit its height; the
            // walls beyond the room are drawn, never stretched.
            const portraitScreen = this.scale.height >= this.scale.width;
            if (portraitScreen) {
              cam.setZoom(Math.max(this.scale.width / room.width, this.scale.height / room.height));
              cam.setBounds(0, 0, room.width, room.height);
              if (this.hero) cam.startFollow(this.hero.body, true, 0.12, 0.12);
            } else {
              cam.setZoom(this.scale.height / room.height);
              cam.stopFollow().removeBounds();
              cam.centerOn(room.width / 2, room.height / 2);
            }
          } else cam.centerOn(room.width / 2, room.height / 2);
        }
      };
      zoom();
      this.scale.on(Phaser.Scale.Events.RESIZE, zoom);
      releaseScene.push(() => this.scale.off(Phaser.Scale.Events.RESIZE, zoom));
      parent.addEventListener("ki:zoom", zoom);
      const labels = (event: Event) => {
        worldLabels = Boolean((event as CustomEvent<boolean>).detail);
        parent.dataset["worldLabels"] = String(worldLabels);
      };
      parent.addEventListener("ki:labels", labels);
      const command = (event: Event) => {
        session.command((event as CustomEvent<Command>).detail);
        this.resetStick();
        this.report();
      };
      parent.addEventListener("ki:command", command);
      const save = () => {
        session.flush();
        this.resetStick();
        this.input.keyboard?.resetKeys();
      };
      parent.addEventListener("ki:flush", save);
      window.addEventListener("pagehide", save);
      document.addEventListener("visibilitychange", save);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        parent.removeEventListener("ki:zoom", zoom);
        parent.removeEventListener("ki:labels", labels);
        parent.removeEventListener("ki:command", command);
        parent.removeEventListener("ki:flush", save);
        window.removeEventListener("pagehide", save);
        document.removeEventListener("visibilitychange", save);
        session.flush();
      };
      releaseScene.push(release);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, release);
      this.events.once(Phaser.Scenes.Events.DESTROY, release);
      this.keys = this.input.keyboard?.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as
        Record<string, Phaser.Input.Keyboard.Key> | undefined;
      this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
        const el = document.activeElement;
        if (el instanceof HTMLElement && el.closest("input,textarea,button,[role=dialog]")) return;
        const slot = session.kit.abilities().find((a) => a.key !== "" && a.key === event.key);
        const map: Record<string, Command> = {
          ...(slot ? { [event.key]: { type: "ability", ability: slot.id } as Command } : {}),
          " ": { type: "ability", ability: "R" },
          q: { type: "ability", ability: "potion" },
          e:
            session.player.interior === "depot" &&
            distance(session.player, cityRoom("depot").chest) < 145
              ? { type: "chest" }
              : session.snapshot().nearbyBuilding &&
                  !session.npcs.some((n) => distance(n, session.player) < 140)
                ? { type: "enter", building: session.snapshot().nearbyBuilding!.id }
                : { type: "interact", npc: session.snapshot().nearestNpc },
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
        .setDepth(renderDepth("controls"))
        .setVisible(false);
      this.stickKnob = this.add
        .circle(0, 0, 20, 0xcee6b6, 0.7)
        .setScrollFactor(0)
        .setDepth(renderDepth("combat"))
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
        this.suspended = true;
        this.resetStick();
        this.input.keyboard?.resetKeys();
        parent.dataset["focused"] = "false";
        session.flush();
        this.report();
      };
      const focus = () => {
        this.suspended = false;
        this.resetStick();
        this.input.keyboard?.resetKeys();
        parent.dataset["focused"] = "true";
        this.report();
      };
      const gameEvents = this.game.events;
      gameEvents.on("blur", blur);
      gameEvents.on("focus", focus);
      const releaseBlur = () => {
        gameEvents.off("blur", blur);
        gameEvents.off("focus", focus);
      };
      releaseScene.push(releaseBlur);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, releaseBlur);
      this.events.once(Phaser.Scenes.Events.DESTROY, releaseBlur);
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
      if (session.dialogue || session.depotOpen || session.paused || session.player.dead) return;
      const hit = (
        p: Point,
        { width, height, belowFoot }: { width: number; height: number; belowFoot: number },
      ) => Math.abs(pos.x - p.x) <= width / 2 && pos.y >= p.y - height && pos.y <= p.y + belowFoot;
      const npc = session.npcs.find((n) => hit(n, INTERACTION_BOUNDS.npc));
      const enemy = session.enemies
        .filter((e) => e.hp > 0 && hit(e, INTERACTION_BOUNDS.enemy))
        .sort((a, b) => distance(pos, a) - distance(pos, b))[0];
      const loot = session.loot.find((l) => hit(l, INTERACTION_BOUNDS.loot));
      const door =
        !session.player.interior &&
        world.city?.buildings.find(
          (b) =>
            Math.abs(pos.x - b.door.x) < 190 && pos.y > b.door.y - 155 && pos.y < b.door.y + 90,
        );
      if (session.player.interior) {
        const room = cityRoom(session.player.interior, world.id);
        if (
          session.player.interior === "depot" &&
          Math.abs(pos.x - room.chest.x) < 85 &&
          pos.y > room.chest.y - 150 &&
          pos.y < room.chest.y + 25
        ) {
          session.command({ type: "chest" });
          this.report();
          return;
        }
        if (
          session.player.interior === "arena" &&
          Math.abs(pos.x - room.dummy.x) < 85 &&
          pos.y > room.dummy.y - 160 &&
          pos.y < room.dummy.y + 25
        ) {
          session.command({ type: "training", action: "start" });
          this.report();
          return;
        }
        if (distance(pos, room.exit) < 80) {
          session.command({ type: "exit" });
          this.report();
          return;
        }
      }
      if (npc) session.command({ type: "interact", npc: npc.id });
      else if (door) session.command({ type: "enter", building: door.id });
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
    /** One actor per live enemy; spawned (summons, packs) and removed (despawned) enemies follow the session. */
    private syncEnemies() {
      for (const e of session.enemies) {
        if (this.enemies.has(e.id)) continue;
        const role = e.kind === "boar" ? undefined : e.kind.replace(world.id + "-", "");
        this.enemies.set(
          e.id,
          this.actor(e, e.m.def.name, "enemy", actorVisual(world.id, "enemy", role)),
        );
      }
      for (const [id, actor] of this.enemies)
        if (!session.enemies.some((e) => e.id === id)) {
          actor.body.destroy();
          actor.name.destroy();
          actor.bar.destroy();
          actor.track.destroy();
          this.actors = this.actors.filter((a) => a !== actor);
          this.enemies.delete(id);
        }
    }
    private ring(p: Point, radius: number, color: number, ms: number, fill = 0.12) {
      const disc = this.add
        .ellipse(p.x, p.y, radius * 2, radius * 1.1, color, fill)
        .setStrokeStyle(3, color, 0.8)
        .setDepth(renderDepth("combat", p.y - 1));
      this.tweens.add({
        targets: disc,
        alpha: 0.2,
        duration: Math.max(60, ms),
        onComplete: () => disc.destroy(),
      });
    }
    private actor(p: Point, label: string, kind: Actor["kind"], config: ActorVisual): Actor {
      const boar = kind === "enemy";
      // A textured image batches with the sprites; a Shape ellipse would break the batch per actor.
      if (!this.textures.exists("actor-shadow")) {
        const tex = this.textures.createCanvas("actor-shadow", 64, 24)!;
        const ctx = tex.getContext();
        ctx.translate(32, 12);
        ctx.scale(1, 12 / 32);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 32);
        // Dark contact core with a soft rim: a character must stand on the ground, never float above it.
        g.addColorStop(0, "rgba(8,12,22,1)");
        g.addColorStop(0.55, "rgba(8,12,22,0.85)");
        g.addColorStop(1, "rgba(8,12,22,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.fill();
        tex.refresh();
      }
      const shadow = this.add
        .image(0, 3, "actor-shadow")
        .setDisplaySize(boar ? 74 : 50, boar ? 24 : 18)
        .setAlpha(0.62);
      // The hero is the centre of the game: a warm light pool under the feet separates it from the ground.
      let halo: Phaser.GameObjects.Image | undefined;
      if (kind === "hero") {
        if (!this.textures.exists("hero-halo")) {
          const tex = this.textures.createCanvas("hero-halo", 128, 64)!;
          const ctx = tex.getContext();
          ctx.translate(64, 32);
          ctx.scale(1, 0.5);
          const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 64);
          g.addColorStop(0, "rgba(255,236,170,0.9)");
          g.addColorStop(0.55, "rgba(255,214,130,0.45)");
          g.addColorStop(1, "rgba(255,200,110,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, 64, 0, Math.PI * 2);
          ctx.fill();
          tex.refresh();
        }
        halo = this.add
          .image(0, 2, "hero-halo")
          .setDisplaySize(170, 70)
          .setAlpha(0.7)
          .setBlendMode(Phaser.BlendModes.ADD);
      }
      registerActorAnimations(this, config);
      const clip = config.clips.idle!,
        first = Object.values(clip.directions)[0]![0]!;
      const sprite = this.add
        .sprite(0, 0, clip.asset, first)
        .setDisplaySize(...config.size)
        .setOrigin(...config.origin);
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
        .setDepth(renderDepth("labels"))
        .setVisible(false);
      if (label.startsWith("Ty ·")) name.setColor("#fff1a8");
      const track = this.add
        .rectangle(p.x, p.y - 76, 64, 6, 0x16313e)
        .setDepth(renderDepth("labels") - 1);
      const bar = this.add
        .rectangle(p.x - 32, p.y - 76, 64, 6, boar ? 0xe4818e : 0x8de0c6)
        .setOrigin(0, 0.5)
        .setDepth(renderDepth("labels"));
      if (!boar) {
        track.setVisible(false);
        bar.setVisible(false);
      }
      const actor = {
        kind,
        visual: config,
        animation: new ActorAnimation(sprite, config),
        facing: { x: 0, y: 1 },
        body: this.add
          .container(p.x, p.y, halo ? [halo, shadow, sprite] : [shadow, sprite])
          .setDepth(p.y),
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
        .setDepth(renderDepth("labels") + 2);
      this.tweens.add({
        targets: label,
        y: label.y - 45,
        alpha: 0,
        duration: 1000,
        onComplete: () => label.destroy(),
      });
    }
    private texturedEffect(id: string, p: Point, to?: Point) {
      const spec = catalog.effects[world.id + "." + id] ?? catalog.effects[id];
      if (!spec) return false;
      const key = "effect/" + world.id + "/" + id;
      if (!this.anims.exists(key))
        this.anims.create({
          key,
          frames: spec.frames.map((frame) => ({ key: spec.asset, frame })),
          frameRate: spec.fps,
          repeat: 0,
        });
      const sprite = this.add
        .sprite(p.x, p.y - 30, spec.asset, spec.frames[0])
        .setDisplaySize(...spec.size)
        .setDepth(renderDepth("combat", p.y));
      if (spec.frames.length > 1) sprite.play(key);
      if (to)
        this.tweens.add({ targets: sprite, x: to.x, y: to.y - 30, duration: spec.durationMs });
      this.time.delayedCall(spec.durationMs, () => sprite.destroy());
      return true;
    }
    private effect(event: GameEvent) {
      if (event.type === "telegraph") {
        if (event.radius) this.ring(event, event.radius, 0xff5a4a, event.ms ?? 300, 0.18);
        return;
      }
      if (event.type === "zone") {
        const color =
          {
            fire: 0xff7a2a,
            lava: 0xff4a1a,
            poison: 0x8bd14a,
            web: 0xe8e8e8,
            metal: 0xffb347,
            sand: 0xd8b86a,
            ash: 0x9a9a9a,
          }[event.kind ?? "fire"] ?? 0xff7a2a;
        this.ring(event, event.radius ?? 60, color, event.ms ?? 1000, 0.22);
        return;
      }
      if (event.type === "circle") {
        this.ring(event, event.radius ?? 100, 0xfff0a0, event.ms ?? 3000, 0.16);
        return;
      }
      if (event.type === "burst") {
        this.ring(event, event.radius ?? 100, 0xb2f4ff, event.ms ?? 450, 0.2);
        return;
      }
      if (event.type === "status" || event.type === "buff" || event.type === "channel") {
        if (event.text)
          this.float(event, event.text, event.target === "player" ? "#ffa1a1" : "#c9f0ff");
        return;
      }
      if (event.type === "attack" && event.source) {
        const source = this.enemies.get(event.source);
        if (source) {
          if (event.to) source.facing = { x: event.to.x - event.x, y: event.to.y - event.y };
          source.animation.trigger("attack", this.animationTime, source.facing);
        }
        this.texturedEffect("enemy-attack", event);
        return;
      }
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
        actor.animation.trigger("hit", this.animationTime);
        this.texturedEffect("hit", event);
        actor.sprite
          .setTint(event.target === "player" ? 0xff7777 : 0xffefd0)
          .setTintMode(Phaser.TintModes.FILL);
        this.time.delayedCall(130, () => actor.sprite.clearTint());
        if (event.target === "player") this.cameras.main.shake(100, 0.002);
      }
      if (event.type === "death" && actor) {
        this.texturedEffect("death", event);
        actor.animation.trigger("death", this.animationTime);
        this.tweens.killTweensOf(actor.body);
        if (!actor.visual.clips.death)
          this.tweens.add({
            targets: actor.body,
            alpha: 0,
            angle: 75,
            duration: 550,
            onComplete: () => actor.body.setVisible(false),
          });
      }
      if (event.type === "respawn") {
        this.texturedEffect("respawn", event);
        const revived = actor ?? this.hero;
        revived.animation.trigger("respawn", this.animationTime);
        const body = revived.body;
        this.tweens.killTweensOf(body);
        body.setAlpha(1).setAngle(0).setVisible(true);
      }
      if (event.type === "attack") {
        this.hero.animation.trigger(
          event.ability === "R" ? "attack" : "skill",
          this.animationTime,
          session.facing,
        );
        const dir = session.facing,
          sprite = this.hero.sprite;
        this.tweens.killTweensOf(sprite);
        sprite.setPosition(0, 0).setAngle(0);
        if (!this.hero.visual.clips[event.ability === "R" ? "attack" : "skill"])
          this.tweens.add({
            targets: sprite,
            x: dir.x * 13,
            y: dir.y * 13,
            angle: dir.x >= 0 ? 12 : -12,
            duration: 110,
            yoyo: true,
          });
        if (
          this.texturedEffect(
            event.ability === "R" || !event.ability ? "attack" : event.ability,
            event,
            event.to && distance(event, event.to) > 110 ? event.to : undefined,
          )
        )
          return;
        if (event.to && distance(event, event.to) > 110) {
          const orb = this.add
            .circle(event.x, event.y - 35, 13, 0xb2ffff, 0.9)
            .setStrokeStyle(5, 0x5dd2f1, 0.5)
            .setDepth(renderDepth("combat"));
          this.tweens.add({
            targets: orb,
            x: event.to.x,
            y: event.to.y - 30,
            duration: 200,
            onComplete: () => orb.destroy(),
          });
        } else {
          const slash = this.add.graphics().setDepth(renderDepth("combat")),
            angle = Math.atan2(dir.y, dir.x);
          slash.lineStyle(
            event.ability && event.ability !== "R" ? 10 : 5,
            event.ability && event.ability !== "R" ? 0xffa45e : 0xf1ffe0,
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
        if (event.type === "heal") this.hero.animation.trigger("skill", this.animationTime);
        if (this.texturedEffect(event.type, event)) return;
        const ring = this.add
          .ellipse(event.x, event.y, 40, 20)
          .setStrokeStyle(4, event.type === "level" ? 0xffea9a : 0x9cffe0)
          .setDepth(renderDepth("combat", event.y + 1));
        this.tweens.add({
          targets: ring,
          scaleX: 4,
          scaleY: 4,
          alpha: 0,
          duration: 800,
          onComplete: () => ring.destroy(),
        });
      }
      if (event.type === "shield") {
        this.hero.animation.trigger("skill", this.animationTime);
        this.texturedEffect("shield", event);
      }
    }
    private report() {
      let npcLabels = 0,
        enemyLabels = 0;
      for (const actor of this.actors)
        if (actor.name.visible) {
          if (actor.kind === "npc") npcLabels++;
          if (actor.kind === "enemy") enemyLabels++;
        }
      parent.dataset["npcLabels"] = String(npcLabels);
      parent.dataset["enemyLabels"] = String(enemyLabels);
      parent.dataset["world"] = world.id;
      parent.dataset["interior"] = session.player.interior ?? "outside";
      parent.dataset["actorVisual"] = this.hero.visual.id;
      parent.dataset["animationState"] = this.hero.animation.state;
      parent.dataset["animationFrame"] = String(this.hero.sprite.frame.name);
      parent.dataset["enemies"] = JSON.stringify(
        session.enemies.map((e) => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, mode: e.mode })),
      );
      // Read-only camera telemetry lets QA click moving sprites at their actual screen position.
      parent.dataset["cameraX"] = String(this.cameras.main.scrollX);
      parent.dataset["cameraY"] = String(this.cameras.main.scrollY);
      parent.dataset["cameraZoom"] = String(this.cameras.main.zoom);
      parent.dataset["playerX"] = String(session.player.x);
      parent.dataset["playerY"] = String(session.player.y);
      onState?.(session.snapshot());
    }
    override update(time: number, delta: number) {
      if (disposed || !this.hero || this.loadFailed || document.hidden || this.suspended) return;
      const dt = Math.min(delta, 100);
      if (!session.paused && !session.dialogue) this.animationTime += dt;
      session.tick(dt);
      if (this.lastInterior !== session.player.interior) {
        this.interiorView?.dispose();
        this.interiorView = undefined;
        this.lastInterior = session.player.interior;
        this.resetStick();
        this.input.keyboard?.resetKeys();
        if (session.player.interior) {
          this.outsideObjects.forEach((o) => o.setVisible(false));
          this.interiorView = renderCityInterior(this, world, session.player.interior);
          const room = cityRoom(session.player.interior, world.id);
          this.cameras.main
            .stopFollow()
            .removeBounds()
            .setBackgroundColor(world.city?.palette?.background ?? "#101e1b");
          this.cameras.main.centerOn(room.width / 2, room.height / 2);
          parent.dispatchEvent(new Event("ki:zoom"));
        } else {
          this.outsideObjects.forEach((o) => o.setVisible(true));
          this.cameras.main
            .setBounds(0, 0, world.width, world.height)
            .setBackgroundColor(world.background);
          this.cameras.main.startFollow(this.hero.body, true, 0.12, 0.12);
          this.cameras.main.centerOn(session.player.x, session.player.y);
          parent.dispatchEvent(new Event("ki:zoom"));
        }
      }
      if (!session.player.interior) this.updateVisibility?.(session.player);
      const activeNpcs = new Map(session.npcs.map((n) => [n.id, n]));
      for (const actor of this.actors)
        if (actor.npcId) {
          const npc = activeNpcs.get(actor.npcId);
          if (npc) actor.body.setPosition(npc.x, npc.y).setDepth(npc.y);
        }
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
      // In the painted smithy the hero is drawn larger, as in the mockup (about a fifth of the screen height).
      this.hero.body
        .setPosition(session.player.x, session.player.y)
        .setDepth(session.player.y)
        .setScale(world.id === "pyra" && session.player.interior === "smithy" ? 1.45 : 1);
      this.hero.animation.update(
        this.animationTime,
        session.moving,
        session.player.dead,
        session.facing,
        session.paused || !!session.dialogue,
      );
      this.syncEnemies();
      for (const e of session.enemies) {
        const a = this.enemies.get(e.id)!;
        a.body.setVisible(!e.m.hidden && !session.player.interior);
        const vx = e.x - a.body.x,
          vy = e.y - a.body.y;
        if (Math.hypot(vx, vy) > 0.01) {
          a.facing.x = vx;
          a.facing.y = vy;
        }
        a.animation.update(
          this.animationTime,
          Math.hypot(vx, vy) > 0.01,
          e.hp <= 0,
          a.facing,
          session.paused || !!session.dialogue,
        );
        a.body.setPosition(e.x, e.y).setDepth(e.y);
        a.bar.width = (64 * e.hp) / e.maxHp;
        const engaged =
          e.hp > 0 &&
          !e.m.hidden &&
          !session.player.interior &&
          (e.mode === "chase" || session.targetId === e.id);
        a.track.setVisible(engaged);
        a.bar.setVisible(engaged);
        if (e.hp > 0 && !a.visual.clips.attack)
          a.sprite.y =
            Math.sin(time / (e.mode === "chase" ? 75 : 180) + e.home.x) *
            (e.mode === "chase" ? 2 : 0.7);
      }
      // Containers are never culled by the camera, and every visible one costs a separate GPU batch.
      // Drawing only actors near the view cuts the draw calls from dozens to a handful.
      const view = this.cameras.main.worldView,
        pad = 220;
      for (const a of this.actors) {
        if (a.kind === "hero") continue;
        const near =
          a.body.x > view.left - pad &&
          a.body.x < view.right + pad &&
          a.body.y > view.top - pad &&
          a.body.y < view.bottom + pad + 120;
        if (a.kind === "npc")
          a.body.setVisible(
            near &&
              Boolean(a.npcId && activeNpcs.has(a.npcId)) &&
              !(
                world.id === "pyra" &&
                a.npcId === "smith" &&
                catalog.renderBindings["object.pyra.smithy.goro"]
              ),
          );
        else if (!near) a.body.setVisible(false);
      }
      for (const actor of this.actors)
        if (actor.kind === "npc")
          actor.animation.update(
            this.animationTime,
            false,
            false,
            actor.facing,
            session.paused || !!session.dialogue,
          );
      let nearestNpc: Actor | undefined,
        nearestDistance = 190;
      for (const actor of this.actors)
        if (actor.kind === "npc" && actor.body.visible) {
          const d = distance(session.player, actor.body);
          if (d < nearestDistance) {
            nearestNpc = actor;
            nearestDistance = d;
          }
        }
      let labelledEnemy = session.targetId ? this.enemies.get(session.targetId) : undefined;
      if (!labelledEnemy) {
        let nearest = 200;
        for (const enemy of session.enemies)
          if (enemy.hp > 0 && !enemy.m.hidden && enemy.mode === "chase") {
            const d = distance(session.player, enemy);
            if (d < nearest) {
              nearest = d;
              labelledEnemy = this.enemies.get(enemy.id);
            }
          }
      }
      const quiet =
        !worldLabels || Boolean(session.dialogue) || session.paused || session.player.dead;
      for (const a of this.actors) {
        a.name.setPosition(a.body.x, a.body.y - 104).setScale(1 / this.cameras.main.zoom);
        // A name is less important than the hero's silhouette. Never paint it over the body.
        const left = a.name.x - a.name.displayWidth / 2,
          right = a.name.x + a.name.displayWidth / 2;
        const top = a.name.y - a.name.displayHeight / 2,
          bottom = a.name.y + a.name.displayHeight / 2;
        const clear =
          right < session.player.x - visual.size[0] * visual.origin[0] ||
          left > session.player.x + visual.size[0] * (1 - visual.origin[0]) ||
          bottom < session.player.y - visual.size[1] * visual.origin[1] ||
          top > session.player.y + visual.size[1] * (1 - visual.origin[1]);
        a.name.setVisible(
          !quiet &&
            a.body.visible &&
            clear &&
            ((a.kind === "npc" && a === nearestNpc && !labelledEnemy) ||
              (a.kind === "enemy" && a === labelledEnemy)),
        );
        a.track.setPosition(a.body.x, a.body.y - 76);
        a.bar.setPosition(a.body.x - 32, a.body.y - 76);
      }
      this.selection.setVisible(Boolean(session.target));
      if (session.target)
        this.selection
          .setPosition(session.target.x, session.target.y + 7)
          .setDepth(session.target.y - 1);
      this.shield
        .setVisible(session.kit.shieldPoints > 0)
        .setPosition(session.player.x, session.player.y - 40)
        .setDepth(renderDepth("combat", session.player.y + 1));
      for (const l of session.loot)
        if (!this.loot.has(l.id)) {
          const icon = this.add.image(0, -17, "ui-icons", 5).setDisplaySize(34, 34);
          // The pickup action is labelled in the HUD; loot on the ground needs only its icon.
          this.loot.set(
            l.id,
            this.add.container(l.x, l.y, [icon]).setDepth(renderDepth("actors", l.y + 1)),
          );
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
    // Sprites are textured quads, so MSAA on the whole canvas only costs fill rate on mobile GPUs.
    render: {
      antialiasGL: false,
      powerPreference: "high-performance",
    },
    loader: { timeout: 20000, maxRetries: 1 },
    parent,
    width: parent.clientWidth || 960,
    height: parent.clientHeight || 540,
    backgroundColor: "#17251c",
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [ForestScene],
  });
  // `?ki-debug=1` shows renderer, FPS and scene size so slowdowns can be diagnosed from a phone.
  let debugTimer = 0;
  const debugMode = new URLSearchParams(window.location.search).get("ki-debug");
  let stopBench: (() => void) | undefined;
  let benchStart = 0;
  if (debugMode === "1" || debugMode === "bench") {
    (window as unknown as { __kiGame?: Phaser.Game }).__kiGame = game;
    const badge = document.createElement("div");
    badge.setAttribute("data-testid", "ki-debug");
    badge.style.cssText =
      "position:absolute;left:6px;bottom:96px;z-index:40;padding:4px 8px;border-radius:4px;" +
      "font:11px/1.4 monospace;color:#cfe;background:#000a;pointer-events:none;white-space:pre";
    parent.appendChild(badge);
    if (debugMode === "bench") {
      const panel = document.createElement("div");
      panel.setAttribute("data-testid", "ki-bench");
      panel.style.cssText =
        "position:absolute;left:6px;top:140px;z-index:41;padding:6px 10px;border-radius:4px;" +
        "font:12px/1.5 monospace;color:#ffe9a8;background:#000c;pointer-events:none;white-space:pre";
      panel.textContent = "Test wydajności za 8 s - nie ruszaj się";
      parent.appendChild(panel);
      benchStart = window.setTimeout(() => {
        stopBench = runBench(game, parent, (lines) => {
          panel.textContent = lines.join("\n");
        });
      }, 8000);
    }
    // CPU time per frame (update + render commands) tells CPU-bound from GPU-bound devices.
    let stepAt = 0;
    const jsTimes: number[] = [];
    game.events.on("step", () => {
      stepAt = performance.now();
    });
    game.events.on("postrender", () => {
      if (!stepAt) return;
      jsTimes.push(performance.now() - stepAt);
      if (jsTimes.length > 120) jsTimes.shift();
    });
    const gpuName = () => {
      try {
        const gl = (game.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
        const info = gl?.getExtension("WEBGL_debug_renderer_info");
        return String(
          info
            ? gl?.getParameter(info.UNMASKED_RENDERER_WEBGL)
            : (gl?.getParameter(gl.RENDERER) ?? "-"),
        ).slice(0, 40);
      } catch {
        return "?";
      }
    };
    debugTimer = window.setInterval(() => {
      try {
        const m = JSON.parse(parent.dataset["metrics"] ?? "{}");
        if (!m.renderer) {
          badge.textContent = "pomiar…";
          return;
        }
        badge.textContent =
          `${m.renderer} ${m.fps} fps (p95 ${Math.round(m.frameP95Ms)} ms)\n` +
          `obiekty ${m.visibleObjects}/${m.objects} tekstury ${m.textures} ` +
          `${Math.round(m.estimatedTextureBytes / 1048576)} MB\n` +
          `JS ${(jsTimes.reduce((a, b) => a + b, 0) / Math.max(1, jsTimes.length)).toFixed(1)} ms/klatkę` +
          ` · DPR ${window.devicePixelRatio} · ${game.scale.width}x${game.scale.height}\n` +
          `GPU: ${gpuName()}`;
      } catch {
        badge.textContent = "brak danych";
      }
    }, 500);
  }
  return () => {
    disposed = true;
    window.clearInterval(debugTimer);
    window.clearTimeout(benchStart);
    stopBench?.();
    for (const release of releaseScene.splice(0)) release();
    session.flush();
    game.destroy(true);
  };
}
