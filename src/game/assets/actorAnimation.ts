import type Phaser from "phaser";
import { facingDirection } from "../world/characterVisual";
import { animationKey } from "./phaserAssets";
import type { AnimationState, ActorVisual, Direction } from "./schema";
import type { Point } from "../navigation";
const PRIORITY: Record<AnimationState, number> = {
  idle: 0,
  walk: 1,
  run: 2,
  attack: 3,
  skill: 4,
  hit: 5,
  respawn: 6,
  death: 7,
};
/** Presentation only: no damage, movement, cooldown, AI or save mutations. */
export class ActorAnimation {
  state: AnimationState = "idle";
  private until = 0;
  private pending: { state: "attack" | "skill"; facing: Point; expires: number } | undefined;
  private lastKey = "";
  private direction: Point = { x: 0, y: 1 };
  private directions = new Map<AnimationState, Direction[]>();
  constructor(
    readonly sprite: Phaser.GameObjects.Sprite,
    readonly visual: ActorVisual,
  ) {
    for (const [state, clip] of Object.entries(visual.clips))
      this.directions.set(state as AnimationState, Object.keys(clip.directions) as Direction[]);
  }
  trigger(state: AnimationState, now: number, facing?: Point) {
    if (state === "death" || state === "respawn") this.pending = undefined;
    if (
      state === "attack" &&
      this.state === "hit" &&
      this.pending?.state === "skill" &&
      now <= this.pending.expires
    )
      return;
    if (state !== "respawn" && now < this.until && PRIORITY[state] < PRIORITY[this.state]) {
      if (
        this.state === "hit" &&
        (state === "attack" || state === "skill") &&
        (!this.pending || PRIORITY[state] >= PRIORITY[this.pending.state])
      )
        this.pending = { state, facing: { ...(facing ?? this.direction) }, expires: now + 500 };
      return;
    }
    if (state === "attack" || state === "skill") this.pending = undefined;
    this.state = state;
    if (facing) this.direction = facing;
    const clip = this.visual.clips[state];
    const frames = clip && Object.values(clip.directions)[0];
    this.until =
      state === "death"
        ? Infinity
        : now + (clip && frames ? (frames.length / clip.fps) * 1000 : state === "hit" ? 130 : 240);
    this.lastKey = "";
  }
  update(now: number, moving: boolean, dead: boolean, facing: Point, paused = false) {
    if (paused) {
      this.sprite.anims.pause();
      return;
    }
    this.sprite.anims.resume();
    if (dead && this.state !== "death") this.trigger("death", now);
    if (!dead && this.state === "death") this.trigger("respawn", now);
    if (!dead && now >= this.until) {
      const pending = this.pending;
      this.pending = undefined;
      if (pending && now <= pending.expires) this.trigger(pending.state, now, pending.facing);
      else {
        this.state = moving ? "walk" : "idle";
        this.direction = facing;
      }
    }
    const selected = this.visual.clips[this.state] ? this.state : "idle";
    const clip = this.visual.clips[selected]!;
    const available = this.directions.get(selected)!;
    const desired = facingDirection(this.direction, available);
    const dir = available.includes(desired) ? desired : available[0]!;
    const frames = clip.directions[dir]!;
    const key = animationKey(this.visual, selected, dir);
    if (key === this.lastKey) return;
    this.lastKey = key;
    if (frames.length === 1) {
      this.sprite.stop();
      this.sprite.setTexture(clip.asset, frames[0]);
    } else this.sprite.play(key);
  }
}
