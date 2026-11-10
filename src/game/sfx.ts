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

/**
 * Etap 1 (P0) development sound effects mapped to verified existing ElevenLabs assets
 * (`START-TUTAJ.txt` Krok 0 reuse audit), used as the default fallback until owner acceptance.
 */
export const DEVELOPMENT_SFX_REUSE = {
  "audio.development.dummy-hit": "/game/sfx/common/hit.mp3",
  "audio.development.target-hit": "/game/sfx/common/hit-armor.mp3",
  "audio.development.checkpoint": "/game/sfx/common/loot.mp3",
  "audio.development.exam-start": "/game/sfx/sage/A1.mp3",
  "audio.development.exam-success": "/game/sfx/common/quest-complete.mp3",
  "audio.development.exam-fail": "/game/sfx/common/no-energy.mp3",
  "audio.development.ki-charge": "/game/sfx/sage/C1.mp3",
} as const;

/**
 * Full 37 development SFX cues (7 P0 + 30 P2) generated via ElevenLabs Sound Effects v2
 * (`eleven_text_to_sound_v2`, `art/production/development/v001/audio-manifest.json`).
 * Opt-in via `?ki-dev-sfx=1` or `?ki-dev-art=1` until owner acceptance.
 */
export const DEVELOPMENT_SFX_DEDICATED = {
  "audio.development.dummy-hit": "/game/sfx/development/dummy-hit.mp3",
  "audio.development.target-hit": "/game/sfx/development/target-hit.mp3",
  "audio.development.checkpoint": "/game/sfx/development/checkpoint.mp3",
  "audio.development.exam-start": "/game/sfx/development/exam-start.mp3",
  "audio.development.exam-success": "/game/sfx/development/exam-success.mp3",
  "audio.development.exam-fail": "/game/sfx/development/exam-fail.mp3",
  "audio.development.ki-charge": "/game/sfx/development/ki-charge.mp3",
  "audio.development.training-start": "/game/sfx/development/training-start.mp3",
  "audio.development.training-stop": "/game/sfx/development/training-stop.mp3",
  "audio.development.window": "/game/sfx/development/window.mp3",
  "audio.development.exam-abandon": "/game/sfx/development/exam-abandon.mp3",
  "audio.development.warning": "/game/sfx/development/warning.mp3",
  "audio.development.ki-source": "/game/sfx/development/ki-source.mp3",
  "audio.development.restraint": "/game/sfx/development/restraint.mp3",
  "audio.development.rank": "/game/sfx/development/rank.mp3",
  "audio.development.mastery": "/game/sfx/development/mastery.mp3",
  "audio.development.variant": "/game/sfx/development/variant.mp3",
  "audio.development.module-install": "/game/sfx/development/module-install.mp3",
  "audio.development.module-remove": "/game/sfx/development/module-remove.mp3",
  "audio.development.scan": "/game/sfx/development/scan.mp3",
  "audio.development.chronicle": "/game/sfx/development/chronicle.mp3",
  "audio.development.record": "/game/sfx/development/record.mp3",
  "audio.development.consent": "/game/sfx/development/consent.mp3",
  "audio.development.project-start": "/game/sfx/development/project-start.mp3",
  "audio.development.project-done": "/game/sfx/development/project-done.mp3",
  "audio.development.forge": "/game/sfx/development/forge.mp3",
  "audio.development.repair": "/game/sfx/development/repair.mp3",
  "audio.development.attune": "/game/sfx/development/attune.mp3",
  "audio.development.name": "/game/sfx/development/name.mp3",
  "audio.development.temper": "/game/sfx/development/temper.mp3",
  "audio.development.inherit": "/game/sfx/development/inherit.mp3",
  "audio.development.escort-start": "/game/sfx/development/escort-start.mp3",
  "audio.development.escort-wait": "/game/sfx/development/escort-wait.mp3",
  "audio.development.escort-safe": "/game/sfx/development/escort-safe.mp3",
  "audio.development.cart-move": "/game/sfx/development/cart-move.mp3",
  "audio.development.protect-hit": "/game/sfx/development/protect-hit.mp3",
  "audio.development.protect-safe": "/game/sfx/development/protect-safe.mp3",
} as const;
export type DevelopmentSfxId = keyof typeof DEVELOPMENT_SFX_DEDICATED;

/**
 * P3 training yard ambience loops (4 worlds, 22 s seamless loops) generated via ElevenLabs Sound Effects v2.
 */
export const DEVELOPMENT_AMBIENCE_FILES = {
  "audio.ambience.planetary": "/game/sfx/ambience/planetary.mp3",
  "audio.ambience.sage": "/game/sfx/ambience/sage.mp3",
  "audio.ambience.android": "/game/sfx/ambience/android.mp3",
  "audio.ambience.legend": "/game/sfx/ambience/legend.mp3",
} as const;
export type DevelopmentAmbienceId = keyof typeof DEVELOPMENT_AMBIENCE_FILES;

export function devSfxEnabled(
  search = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  const params = new URLSearchParams(search);
  return params.get("ki-dev-sfx") === "1" || params.get("ki-dev-art") === "1";
}

export function developmentSfxFile(id: DevelopmentSfxId, dedicated = devSfxEnabled()): string {
  if (!dedicated && id in DEVELOPMENT_SFX_REUSE) {
    return DEVELOPMENT_SFX_REUSE[id as keyof typeof DEVELOPMENT_SFX_REUSE];
  }
  return DEVELOPMENT_SFX_DEDICATED[id];
}

export function developmentAmbienceFile(id: DevelopmentAmbienceId): string {
  return DEVELOPMENT_AMBIENCE_FILES[id];
}

/** Monster definition ids that have their own sounds (public/game/sfx/monsters/<id>/{atk,die}.mp3). */
const MONSTER_SFX_IDS = new Set<string>([
  "aether-duch-bibliotekarza",
  "aether-krysztalowy-motyl",
  "aether-lew-swiatyni",
  "aether-marionetka-rytualu",
  "aether-mgielny-zuraw",
  "aether-oko-wiedzy",
  "aether-pergaminowy-straznik",
  "aether-swietlik-pieczeci",
  "aether-szmaragdowy-waz",
  "aether-zloty-skarabeusz",
  "nexus-dron-zwiadowca",
  "nexus-kruk-danych",
  "nexus-latarnia-plazmowa",
  "nexus-pajak-spawalniczy",
  "nexus-pelzacz-serwisowy",
  "nexus-pies-lowca",
  "nexus-roj-nanitow",
  "nexus-skaner-gasienicowy",
  "nexus-straznik-rdzenia",
  "nexus-wiezyczka-autonomiczna",
  "pyra-byk-areny",
  "pyra-golem-ruin",
  "pyra-magmowy-krab",
  "pyra-ognista-salamandra",
  "pyra-plomien-duch",
  "pyra-popielny-wilk",
  "pyra-skalny-berserker",
  "pyra-skorpion-obsydianowy",
  "pyra-wegielek",
  "pyra-zarowy-nietoperz",
  "verdant-bursztynowa-osa",
  "verdant-cierniowy-wilk",
  "verdant-grzybowy-zarodnik",
  "verdant-korzeniowy-pelzacz",
  "verdant-lesny-pajak",
  "verdant-lisciak-skrytobojca",
  "verdant-mchowy-szlamak",
  "verdant-puchacz-pylowy",
  "verdant-skalny-jelen",
  "verdant-straznik-ruin",
  ...[
    "verdant-ygdrasha",
    "verdant-thorgar",
    "aether-arcykaplan-pustki",
    "aether-aurelith",
    "nexus-arbiter-zero",
    "nexus-hydra-rdzen",
    "pyra-kharzul",
    "pyra-pyrrhax",
  ],
]);
/** Boss monsters are defined as "boss:<boss id>"; their sound folders carry the world prefix. */
export const BOSS_SFX_DIR: Record<string, string> = {
  "boss:ygdrasha": "verdant-ygdrasha",
  "boss:thorgar": "verdant-thorgar",
  "boss:arcykaplan-pustki": "aether-arcykaplan-pustki",
  "boss:aurelith": "aether-aurelith",
  "boss:arbiter-zero": "nexus-arbiter-zero",
  "boss:hydra-rdzen": "nexus-hydra-rdzen",
  "boss:kharzul": "pyra-kharzul",
  "boss:pyrrhax": "pyra-pyrrhax",
};

/** Own sound of a monster species for an attack, death or (bosses) intro roar, if it has one. */
export function monsterSfxFile(
  species: string | undefined,
  cue: "atk" | "die" | "roar",
): string | undefined {
  if (!species) return undefined;
  const dir = BOSS_SFX_DIR[species] ?? species;
  return MONSTER_SFX_IDS.has(dir) ? "/game/sfx/monsters/" + dir + "/" + cue + ".mp3" : undefined;
}

const STONE_HURT = new Set([
  "verdant-skalny-jelen",
  "verdant-straznik-ruin",
  "pyra-golem-ruin",
  "pyra-skalny-berserker",
  "pyra-magmowy-krab",
]);
/** Reaction to a hit: robots in Nexus-9, spirits and scribes in Aetheria, stone creatures, else animals. */
export function monsterHurtFile(species: string | undefined): string | undefined {
  if (!species) return undefined;
  const dir = BOSS_SFX_DIR[species] ?? species;
  if (!MONSTER_SFX_IDS.has(dir)) return undefined;
  const kind = dir.startsWith("nexus-")
    ? "robot"
    : dir.startsWith("aether-")
      ? "magic"
      : STONE_HURT.has(dir)
        ? "stone"
        : "beast";
  return "/game/sfx/monsters/generic/hurt-" + kind + ".mp3";
}

/** Monster skill ids (monsters/catalog.ts) that share a generic sound, played when the skill winds up. */
const SKILL_SOUND: Record<string, string> = {
  szarza: "charge",
  taran: "charge",
  nurkowanie: "charge",
  skok: "charge",
  tupniecie: "stomp",
  mlot: "stomp",
  miazdzenie: "stomp",
  chmura: "poison",
  pylek: "poison",
  mgla: "poison",
  oblok: "poison",
  oplatanie: "web",
  zadlo: "sting",
  ukaszenie: "sting",
  plwocina: "spit",
  "wybuch-korzeni": "explosion",
  "rozbicie-bariery": "explosion",
  wyladowanie: "explosion",
  odlamki: "explosion",
  roj: "swarm",
};
export function monsterSkillFile(ability: string | undefined): string | undefined {
  const name = ability ? SKILL_SOUND[ability] : undefined;
  return name ? "/game/sfx/monsters/generic/" + name + ".mp3" : undefined;
}

/** Status effects monsters put on the hero that have a sound. */
const STATUS_SOUND: Record<string, string> = {
  burn: "burn",
  poison: "poison",
  slow: "slow",
  stun: "stun",
  root: "freeze",
};
export function statusSfxFile(id: string): string | undefined {
  const name = STATUS_SOUND[id];
  return name ? "/game/sfx/status/" + name + ".mp3" : undefined;
}

export type StepSurface =
  "grass" | "dirt" | "stone" | "sand" | "snow" | "wood" | "metal" | "ash" | "water";
/** Milliseconds between two footsteps while the hero walks. */
export const STEP_INTERVAL_MS = 340;
/** Footsteps are quieter than hits: they play all the time. */
export const STEP_GAIN = 0.45;
const WORLD_STEP_SURFACE: Record<string, StepSurface> = {
  verdant: "grass",
  aether: "stone",
  nexus: "metal",
  pyra: "ash",
};
/** Surface under the hero: indoors wood (metal in Nexus-9), Verdantia's river and rocks, else the world's default. */
export function stepSurface(
  world: string,
  terrain: "forest" | "rock" | "water" | "open",
  interior: string | null,
): StepSurface {
  if (interior) return world === "nexus" ? "metal" : "wood";
  if (terrain === "water") return "water";
  if (terrain === "rock") return "stone";
  return WORLD_STEP_SURFACE[world] ?? "dirt";
}
export function stepFile(surface: StepSurface): string {
  return "/game/sfx/steps/" + surface + ".mp3";
}

/** Event types a race kit emits for its own abilities (monsters also use "status" and "telegraph"). */
const KIT_EVENTS = new Set(["attack", "buff", "burst", "heal", "shield", "circle", "channel"]);

/** Sound file for a cue, or undefined when the cue has none (e.g. an ability without its own sound). */
export function sfxFile(
  cue: Common | DevelopmentSfxId | DevelopmentAmbienceId | { race: RaceId; ability: string },
  dedicated = devSfxEnabled(),
): string | undefined {
  if (typeof cue === "string") {
    if (cue in DEVELOPMENT_SFX_DEDICATED)
      return developmentSfxFile(cue as DevelopmentSfxId, dedicated);
    if (cue in DEVELOPMENT_AMBIENCE_FILES)
      return developmentAmbienceFile(cue as DevelopmentAmbienceId);
    return "/game/sfx/common/" + cue + ".mp3";
  }
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
/** Effects are normalized to -16 LUFS like quiet speech; the music masters are much hotter. */
const BOOST = 3;

export type SfxSnapshot = {
  potions: number;
  interior: string | null;
  noticeId: number;
  notice: string;
  /** Ids of the status effects currently on the hero (PlayerFx.active). */
  fx?: readonly string[];
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
      else if (e.target?.startsWith("practice-")) add(sfxFile("audio.development.target-hit"));
      else if (e.target === "training-dummy")
        add(sfxFile(e.crit ? "hit-crit" : "audio.development.dummy-hit"));
      else if (e.text !== "Pudło") {
        add(sfxFile(e.crit ? "hit-crit" : "hit"));
        add(monsterHurtFile(e.species));
      }
    } else if (e.type === "death")
      add(
        e.target === "player"
          ? sfxFile("player-death")
          : (monsterSfxFile(e.species, "die") ?? sfxFile("monster-death")),
      );
    else if (e.type === "attack" && e.source && e.species) add(monsterSfxFile(e.species, "atk"));
    else if (e.type === "respawn") {
      if (!e.target || e.target === "player") add(sfxFile("respawn"));
    } else if (e.type === "level") add(sfxFile("level-up"));
    else if (e.type === "loot") add(sfxFile(e.text?.endsWith("monet") ? "gold" : "loot"));
    else if (e.type === "telegraph") add(monsterSkillFile(e.ability) ?? sfxFile("boss-warning"));
    else if (e.type === "status" && e.species && e.text?.startsWith("Faza"))
      add(monsterSfxFile(e.species, "roar"));
    else if (e.ability === "dodge" && !e.source) add(sfxFile("dodge"));
    else if (e.ability === "combo" && !e.source) add(sfxFile("hit-crit"));
    else if (e.ability && !e.source && KIT_EVENTS.has(e.type))
      add(sfxFile({ race, ability: e.ability }));
  }
  if (before) {
    for (const id of now.fx ?? []) if (!before.fx?.includes(id)) add(statusSfxFile(id));
    if (now.potions < before.potions) add(sfxFile("potion"));
    if (now.interior !== before.interior) add(sfxFile("door"));
    if (now.noticeId !== before.noticeId) {
      if (
        /^(Za mało KI|Odnowienie|Przekroczono dopuszczalną liczbę błędów\.|Życie spadło poniżej 30%\.|Upłynął aktywny czas egzaminu\.)/.test(
          now.notice,
        )
      )
        add(sfxFile("audio.development.exam-fail"));
      else if (
        /^(Nagroda:|Egzamin zdany\.|Wszystkie cele wykonane\.|Trening przygotowawczy wykonany\.|Projekt ukończony:)/.test(
          now.notice,
        )
      )
        add(sfxFile("audio.development.exam-success"));
      else if (/^(Zapisano nowy stopień treningu\.|.+ · trening \d+$)/.test(now.notice))
        add(sfxFile("level-up"));
      else if (/^(Sprzedano:|Kupiono)/.test(now.notice)) add("/game/sfx/ui/buy-sell.mp3");
      else if (/^Ostrze ulepszone/.test(now.notice)) add("/game/sfx/ui/upgrade-ok.mp3");
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
    if (this.gain) this.gain.gain.value = this.level();
  }

  play(file: string, gain = 1) {
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
    const master = this.gain;
    void this.load(ctx, file).then((buffer) => {
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // A slight random pitch keeps repeated hits from sounding mechanical.
      source.playbackRate.value = 0.94 + Math.random() * 0.12;
      if (gain === 1) source.connect(master);
      else {
        const own = ctx.createGain();
        own.gain.value = gain;
        source.connect(own).connect(master);
      }
      source.start();
    });
  }

  private level() {
    return this.muted ? 0 : this.volume * BOOST;
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
    this.gain.gain.value = this.level();
    // Effects sit above the music (owner: they were too quiet); a limiter keeps the boost clean.
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.ratio.value = 12;
    this.gain.connect(limiter).connect(this.context.destination);
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
  play(file: string, gain = 1) {
    (player ??= new SfxPlayer()).play(file, gain);
  },
  setVolume(volume: number, muted: boolean) {
    (player ??= new SfxPlayer()).setVolume(volume, muted);
  },
};

/** Soft tick on every button, tab and link press while the game is mounted. Opt out with data-no-ui-sound. */
export function installUiClickSound(doc: Document = document): () => void {
  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest('button, [role="button"], [role="tab"], a[href]');
    if (!control || control.closest("[data-no-ui-sound]")) return;
    if (control instanceof HTMLButtonElement && control.disabled) return;
    sfx.play("/game/sfx/ui/click.mp3", 0.7);
  };
  doc.addEventListener("click", onClick, true);
  return () => doc.removeEventListener("click", onClick, true);
}
