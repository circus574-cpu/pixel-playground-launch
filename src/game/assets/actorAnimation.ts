import type Phaser from "phaser";
import { facingDirection } from "../world/characterVisual";
import { animationKey } from "./phaserAssets";
import type { AnimationState, ActorVisual, Direction } from "./schema";
import type { Point } from "../navigation";
const PRIORITY: Record<AnimationState, number> = {
  idle: 0,
  walk: 1,
  kiwalk: 1,
  kiidle: 0,
  kiattack: 3,
  kiskill: 4,
  attack2: 3,
  finisher: 3,
  skillb: 4,
  dodge: 4,
  guard: 4,
  hitheavy: 5,
  victory: 2,
  kiattack2: 3,
  kifinisher: 3,
  kiskillb: 4,
  kidodge: 4,
  kiguard: 4,
  kihit: 5,
  kihitheavy: 5,
  kideath: 7,
  kirespawn: 6,
  kivictory: 2,
  channel: 4,
  skillc: 4,
  interact: 2,
  run: 1,
  attack: 3,
  skill: 4,
  hit: 5,
  respawn: 6,
  death: 7,
};
type Action = "attack" | "skill" | "skillb" | "skillc";
/** Tryb KI clip of a one-shot state, when the race has one. */
const KI_CLIP = {
  dodge: "kidodge",
  guard: "kiguard",
  hit: "kihit",
  hitheavy: "kihitheavy",
  death: "kideath",
  respawn: "kirespawn",
  victory: "kivictory",
} as const;
const ACTIONS = new Set<AnimationState>(["attack", "skill", "skillb", "skillc"]);
/** Presentation only: no damage, movement, cooldown, AI or save mutations. */
export class ActorAnimation {
  state: AnimationState = "idle";
  private until = 0;
  private startedAt = 0;
  private pending: { state: Action; facing: Point; expires: number } | undefined;
  /** Chain of basic strikes: a hit within 1.4 s of the previous one continues attack → attack2 → finisher. */
  private attackClip: AnimationState = "attack";
  private attackStep = 0;
  private lastAttackAt = -1e9;
  private lastKey = "";
  /** Looping clip stepped by this class (see update): its state and the time it started, kept across facing changes. */
  private loopState: AnimationState | undefined;
  private loopStart = 0;
  private loopFrame = "";
  /** Tryb KI was active at the last update: idle and basic attacks use the powered-up clips when the race has them. */
  private kiForm = false;
  /** Tryb KI when the current one-shot state was triggered: the clip stays in that form even if the buff ends meanwhile
   * (a hero that dies in Tryb KI falls and rises in it). */
  private stateKi = false;
  private direction: Point = { x: 0, y: 1 };
  private directions = new Map<AnimationState, Direction[]>();
  constructor(
    readonly sprite: Phaser.GameObjects.Sprite,
    readonly visual: ActorVisual,
  ) {
    for (const [state, clip] of Object.entries(visual.clips))
      this.directions.set(state as AnimationState, Object.keys(clip.directions) as Direction[]);
  }
  /**
   * Clip that presents a state. Tryb KI swaps idle, the basic attack and skills for kiidle, kiattack and kiskill when
   * present; the base form chains its basic strikes (attack, attack2, finisher) and plays the area skill (skillb) and
   * the tree-C technique (skillc). Races without a movement clip fall back to walk, skill or idle.
   */
  private clipState(state: AnimationState): AnimationState {
    const clips = this.visual.clips;
    if (this.kiForm && state === "idle" && clips.kiidle) return "kiidle";
    if (this.stateKi) {
      // The form's own clips; a state the race has no KI clip for keeps the base clip (never invented).
      const ki = KI_CLIP[state as keyof typeof KI_CLIP];
      if (state === "attack") {
        if (clips[this.attackClip] && this.attackClip.startsWith("ki")) return this.attackClip;
        if (clips.kiattack) return "kiattack";
      } else if (state === "skillb") {
        if (clips.kiskillb) return "kiskillb";
        if (clips.kiskill) return "kiskill";
      } else if (state === "skill" || state === "skillc") {
        if (clips.kiskill) return "kiskill";
      } else if (ki && clips[ki]) return ki;
    }
    if (state === "attack")
      return clips[this.attackClip] && !this.attackClip.startsWith("ki")
        ? this.attackClip
        : "attack";
    if (state === "skillb") return clips.skillb ? "skillb" : "skill";
    if (state === "skillc") return clips.skillc ? "skillc" : "skill";
    if (state === "run") return clips.run ? "run" : "walk";
    if (state === "channel") return clips.channel ? "channel" : "skill";
    return state;
  }
  private advanceAttack(now: number) {
    const chain = (
      this.kiForm
        ? (["kiattack2", "kifinisher", "kiattack"] as const)
        : (["attack", "attack2", "finisher"] as const)
    ).filter((c) => this.visual.clips[c]);
    this.attackStep = now - this.lastAttackAt <= 1400 ? (this.attackStep + 1) % chain.length : 0;
    this.attackClip = chain[this.attackStep] ?? (this.kiForm ? "kiattack" : "attack");
    this.lastAttackAt = now;
  }
  /** holdMs keeps a looping state (channel) on screen for that long instead of one pass of its clip. */
  trigger(state: AnimationState, now: number, facing?: Point, holdMs?: number) {
    if (state === "death" || state === "respawn") this.pending = undefined;
    if (
      state === "attack" &&
      (this.state === "hit" || this.state === "hitheavy") &&
      (this.pending?.state === "skill" ||
        this.pending?.state === "skillb" ||
        this.pending?.state === "skillc") &&
      now <= this.pending.expires
    )
      return;
    // A shield granted as a side effect of a technique (e.g. Planetary B7 on B4) keeps that technique's pose.
    if (state === "guard" && now < this.until && PRIORITY[this.state] >= PRIORITY.guard) return;
    if (state !== "respawn" && now < this.until && PRIORITY[state] < PRIORITY[this.state]) {
      if (
        (this.state === "hit" || this.state === "hitheavy") &&
        ACTIONS.has(state) &&
        (!this.pending || PRIORITY[state] >= PRIORITY[this.pending.state])
      )
        this.pending = {
          state: state as Action,
          facing: { ...(facing ?? this.direction) },
          expires: now + 500,
        };
      return;
    }
    if (ACTIONS.has(state)) this.pending = undefined;
    if (state === "attack") this.advanceAttack(now);
    // Getting up keeps the form the hero fell in; every other state takes the current one.
    if (state !== "respawn") this.stateKi = this.kiForm;
    this.state = state;
    this.startedAt = now;
    if (facing) this.direction = facing;
    const clip = this.visual.clips[this.clipState(state)];
    const frames = clip && Object.values(clip.directions)[0];
    this.until =
      state === "death"
        ? Infinity
        : holdMs !== undefined
          ? now + holdMs
          : now +
            (clip && frames ? (frames.length / clip.fps) * 1000 : state === "hit" ? 130 : 240);
    this.lastKey = "";
  }
  update(
    now: number,
    moving: boolean,
    dead: boolean,
    facing: Point,
    paused = false,
    /** Tryb KI is active: a moving hero walks in the powered-up form when the race has that clip. */
    kiForm = false,
    /** The hero moves fast enough to be drawn running (base form, races with a run clip). */
    running = false,
  ) {
    if (paused) {
      this.sprite.anims.pause();
      return;
    }
    this.sprite.anims.resume();
    const kiChanged = this.kiForm !== kiForm;
    this.kiForm = kiForm;
    if (kiChanged) this.lastKey = "";
    if (dead && this.state !== "death") this.trigger("death", now);
    if (!dead && this.state === "death") this.trigger("respawn", now);
    // Basic contact is resolved by simulation at command acceptance. Only its recovery
    // presentation yields to movement; this never changes the paid cooldown or applies a hit.
    if (!dead && moving && this.state === "attack" && now - this.startedAt >= 160) this.until = now;
    // Moving breaks a channel (the simulation interrupts it too) and ends the pick-up gesture.
    if (!dead && moving && (this.state === "channel" || this.state === "interact"))
      this.until = now;
    if (!dead && now >= this.until) {
      const pending = this.pending;
      this.pending = undefined;
      if (pending && now <= pending.expires) this.trigger(pending.state, now, pending.facing);
      else {
        this.state = moving
          ? kiForm && this.visual.clips.kiwalk
            ? "kiwalk"
            : running && this.visual.clips.run
              ? "run"
              : "walk"
          : "idle";
        this.direction = facing;
      }
    }
    const wanted = this.clipState(this.state);
    const selected = this.visual.clips[wanted] ? wanted : "idle";
    const clip = this.visual.clips[selected]!;
    const available = this.directions.get(selected)!;
    const desired = facingDirection(this.direction, available);
    const dir = available.includes(desired) ? desired : available[0]!;
    const frames = clip.directions[dir]!;
    // Side-view clips store one strip; the other side is the same frames drawn mirrored.
    const flip = !!clip.mirrored?.includes(dir);
    if (this.sprite.flipX !== flip) {
      this.sprite.setFlipX(flip);
      this.lastKey = "";
      this.loopFrame = "";
    }
    if (clip.loop && frames.length > 1) {
      // A looping clip (walk, kiwalk, idle, kiidle) is stepped from one clock that survives facing changes: restarting
      // a Phaser animation on every new direction (joystick or path following flipping between neighbouring
      // directions) kept the stride on its first frame and froze the legs.
      if (this.loopState !== selected) {
        this.loopState = selected;
        this.loopStart = now;
      }
      const frame = frames[Math.floor(((now - this.loopStart) / 1000) * clip.fps) % frames.length]!;
      const id = clip.asset + "/" + frame;
      this.lastKey = "";
      if (id !== this.loopFrame) {
        this.loopFrame = id;
        this.sprite.stop();
        this.sprite.setTexture(clip.asset, frame);
      }
      return;
    }
    this.loopState = undefined;
    this.loopFrame = "";
    const key = animationKey(this.visual, selected, dir);
    if (key === this.lastKey) return;
    this.lastKey = key;
    if (frames.length === 1) {
      this.sprite.stop();
      this.sprite.setTexture(clip.asset, frames[0]);
    } else this.sprite.play(key);
  }
}
