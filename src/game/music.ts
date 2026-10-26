/**
 * Background music (owner's recordings, muzyka/ → public/game/music, identical bytes): one loop on
 * the start and loading screens, one per continent in the game. Changing track crossfades.
 * Browsers start sound only after a user gesture, so a blocked start retries on the next tap.
 */
import { readUiPreferences } from "./uiPreferences";

export type MusicTrack = "loading" | "verdant" | "aether" | "nexus" | "pyra";
const FILES: Record<MusicTrack, string> = {
  loading: "/game/music/loadings.mp3",
  verdant: "/game/music/verdantia.mp3",
  aether: "/game/music/aetheria.mp3",
  nexus: "/game/music/nexus.mp3",
  pyra: "/game/music/pyra.mp3",
};
const FADE_MS = 1200;

/** Continent (world affinity) → its track; anything else keeps the loading theme. */
export function trackFor(continent: string | undefined | null): MusicTrack {
  return continent === "verdant" ||
    continent === "aether" ||
    continent === "nexus" ||
    continent === "pyra"
    ? continent
    : "loading";
}

class MusicPlayer {
  private current: { track: MusicTrack; audio: HTMLAudioElement } | null = null;
  private volume = 0.3;
  private muted = false;
  private waitingForGesture = false;

  constructor() {
    const prefs = readUiPreferences();
    this.volume = prefs.musicVolume;
    this.muted = prefs.musicMuted;
  }

  private target() {
    return this.muted ? 0 : this.volume;
  }

  play(track: MusicTrack) {
    if (typeof window === "undefined" || typeof Audio === "undefined") return;
    if (this.current?.track === track) {
      this.start(this.current.audio);
      return;
    }
    const previous = this.current;
    const audio = new Audio(FILES[track]);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    this.current = { track, audio };
    this.start(audio);
    this.fade(audio, this.target());
    if (previous) this.fade(previous.audio, 0, () => this.stop(previous.audio));
  }

  setVolume(volume: number, muted: boolean) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.muted = muted;
    if (this.current) this.current.audio.volume = this.target();
  }

  private start(audio: HTMLAudioElement) {
    try {
      const pending = audio.play();
      if (pending && typeof pending.catch === "function")
        pending.catch(() => this.retryOnGesture());
    } catch {
      this.retryOnGesture();
    }
  }

  /** Autoplay was refused: start on the next tap or key press. */
  private retryOnGesture() {
    if (this.waitingForGesture) return;
    this.waitingForGesture = true;
    const resume = () => {
      this.waitingForGesture = false;
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
      if (this.current) this.start(this.current.audio);
    };
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
  }

  private fade(audio: HTMLAudioElement, to: number, done?: () => void) {
    const from = audio.volume,
      begin = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - begin) / FADE_MS);
      // Fading to a changed level follows the live setting, not the one at the start.
      const goal = audio === this.current?.audio ? this.target() : to;
      audio.volume = Math.min(1, Math.max(0, from + (goal - from) * t));
      if (t < 1) requestAnimationFrame(step);
      else done?.();
    };
    requestAnimationFrame(step);
  }

  private stop(audio: HTMLAudioElement) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
}

let player: MusicPlayer | null = null;
export const music = {
  play(track: MusicTrack) {
    (player ??= new MusicPlayer()).play(track);
  },
  setVolume(volume: number, muted: boolean) {
    (player ??= new MusicPlayer()).setVolume(volume, muted);
  },
};
