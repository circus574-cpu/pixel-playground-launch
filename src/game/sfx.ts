/**
 * Sound effects (ElevenLabs, generated 26.10.2026; list in public/game/sfx/README.md): combat, the
 * four races' abilities and a few world cues. The game reads its own event stream and player
 * snapshot here, so sessions and kits stay free of audio. Web Audio lets hits overlap without
 * cutting each other; buffers load on first use, and a blocked context resumes on the next tap.
 */
import type { GameEvent } from "./session";
import type { RaceId } from "./world/races";
import { readUiPreferences } from "./uiPreferences";

const COMMON = [
  "hit",
  "hit-crit",
  "hit-armor",
  "player-hurt",
  "player-death",
  "respawn",
  "monster-death",
  "dodge",
  "potion",
  "level-up",
  "loot",
  "gold",
  "no-energy",
  "quest-complete",
  "door",
  "boss-warning",
] as const;
/** Abilities with their own sound: the basic attack and each branch's two actives and ultimate. */
export const SFX_ABILITIES = ["R", "A1", "A4", "A9", "B1", "B4", "B9", "C1", "C4", "C9"] as const;
type Common = (typeof COMMON)[number];
/** Event types a race kit emits for its own abilities (monsters also use "status" and "telegraph"). */
const KIT_EVENTS = new Set(["attack", "buff", "burst", "heal", "shield", "circle", "channel"]);

/** Sound file for a cue, or undefined when the cue has none (e.g. an ability without its own sound). */
export function sfxFile(cue: Common | { race: RaceId; ability: string }): string | undefined {
  if (typeof cue === "string") return "/game/sfx/common/" + cue + ".mp3";
  return (SFX_ABILITIES as readonly string[]).includes(cue.ability)
    ? "/game/sfx/" + cue.race + "/" + cue.ability + ".mp3"
    : undefined;
}

/** Shortest gap between two plays of one sound, so a burst of hits does not turn into noise. */
const GAP_MS: Partial<Record<string, number>> = {
  "/game/sfx/common/hit.mp3": 70,
  "/game/sfx/common/hit-armor.mp3": 90,
  "/game/sfx/common/player-hurt.mp3": 180,
  "/game/sfx/common/boss-warning.mp3": 3000,
  "/game/sfx/common/no-energy.mp3": 400,
};
const DEFAULT_GAP_MS = 250;

export type SfxSnapshot = {
  potions: number;
  interior: string | null;
  noticeId: number;
  notice: string;
};

/** Which cues one frame's events and player snapshot call for. Pure, so it is unit tested. */
export function cuesFor(
  race: RaceId,
  events: readonly GameEvent[],
  before: SfxSnapshot | null,
  now: SfxSnapshot,
): string[] {
  const out: string[] = [];
  const add = (file: string | undefined) => {
    if (file && !out.includes(file)) out.push(file);
  };
  for (const e of events) {
    if (e.type === "hit") {
      if (e.target === "player")
        add(
          sfxFile(e.text === "Unik" ? "dodge" : e.text === "Tarcza" ? "hit-armor" : "player-hurt"),
        );
      else if (e.text === "Tarcza") add(sfxFile("hit-armor"));
      else if (e.text !== "Pudło") add(sfxFile(e.crit ? "hit-crit" : "hit"));
    } else if (e.type === "death")
      add(sfxFile(e.target === "player" ? "player-death" : "monster-death"));
    else if (e.type === "respawn") {
      if (!e.target || e.target === "player") add(sfxFile("respawn"));
    } else if (e.type === "level") add(sfxFile("level-up"));
    else if (e.type === "loot") add(sfxFile(e.text?.endsWith("monet") ? "gold" : "loot"));
    else if (e.type === "telegraph") add(sfxFile("boss-warning"));
    else if (e.ability && !e.source && KIT_EVENTS.has(e.type))
      add(sfxFile({ race, ability: e.ability }));
  }
  if (before) {
    if (now.potions < before.potions) add(sfxFile("potion"));
    if (now.interior !== before.interior) add(sfxFile("door"));
    if (now.noticeId !== before.noticeId) {
      if (/^(Za mało KI|Odnowienie)/.test(now.notice)) add(sfxFile("no-energy"));
      else if (now.notice.startsWith("Nagroda:")) add(sfxFile("quest-complete"));
    }
  }
  return out;
}

class SfxPlayer {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private lastAt = new Map<string, number>();
  private volume = 0.6;
  private muted = false;
  private waitingForGesture = false;

  constructor() {
    const prefs = readUiPreferences();
    this.volume = prefs.sfxVolume;
    this.muted = prefs.sfxMuted;
  }

  setVolume(volume: number, muted: boolean) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.muted = muted;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume;
  }

  play(file: string) {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.gain) return;
    const now = performance.now();
    if (now - (this.lastAt.get(file) ?? -Infinity) < (GAP_MS[file] ?? DEFAULT_GAP_MS)) return;
    this.lastAt.set(file, now);
    if (ctx.state === "suspended") {
      this.retryOnGesture();
      return;
    }
    const gain = this.gain;
    void this.load(ctx, file).then((buffer) => {
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // A slight random pitch keeps repeated hits from sounding mechanical.
      source.playbackRate.value = 0.94 + Math.random() * 0.12;
      source.connect(gain);
      source.start();
    });
  }

  unlock() {
    const ctx = this.ensureContext();
    if (ctx?.state === "suspended") void ctx.resume();
  }

  private ensureContext() {
    if (this.context) return this.context;
    const Ctx =
      typeof window === "undefined"
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return null;
    try {
      this.context = new Ctx();
    } catch {
      return null;
    }
    this.gain = this.context.createGain();
    this.gain.gain.value = this.muted ? 0 : this.volume;
    this.gain.connect(this.context.destination);
    return this.context;
  }

  private load(ctx: AudioContext, file: string) {
    let pending = this.buffers.get(file);
    if (!pending) {
      pending = fetch(file)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => null);
      this.buffers.set(file, pending);
    }
    return pending;
  }

  /** The browser refused audio before a gesture: resume on the next tap or key press. */
  private retryOnGesture() {
    if (this.waitingForGesture) return;
    this.waitingForGesture = true;
    const resume = () => {
      this.waitingForGesture = false;
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
      void this.context?.resume();
    };
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
  }
}

let player: SfxPlayer | null = null;
// Mobile browsers start Web Audio only inside a gesture: the first tap anywhere unlocks it.
if (typeof window !== "undefined") {
  const unlock = () => {
    window.removeEventListener("pointerdown", unlock, true);
    (player ??= new SfxPlayer()).unlock();
  };
  window.addEventListener("pointerdown", unlock, true);
}
export const sfx = {
  play(file: string) {
    (player ??= new SfxPlayer()).play(file);
  },
  setVolume(volume: number, muted: boolean) {
    (player ??= new SfxPlayer()).setVolume(volume, muted);
  },
};
