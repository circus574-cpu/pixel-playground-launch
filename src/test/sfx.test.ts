import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOSS_CATALOG } from "../game/bosses/catalog";
import { MONSTER_BASE } from "../game/monsters/base.generated";
import {
  BOSS_SFX_DIR,
  cuesFor,
  monsterSfxFile,
  monsterHurtFile,
  monsterSkillFile,
  statusSfxFile,
  stepFile,
  stepSurface,
  type StepSurface,
  DEVELOPMENT_AMBIENCE_FILES,
  DEVELOPMENT_SFX_DEDICATED,
  DEVELOPMENT_SFX_REUSE,
  developmentAmbienceFile,
  developmentSfxFile,
  devSfxEnabled,
  sfxFile,
  SFX_ABILITIES,
  type DevelopmentAmbienceId,
  type DevelopmentSfxId,
  type SfxSnapshot,
} from "../game/sfx";
import type { GameEvent } from "../game/session";

const at = { x: 0, y: 0 };
const snap = (over: Partial<SfxSnapshot> = {}): SfxSnapshot => ({
  potions: 3,
  interior: null,
  noticeId: 1,
  notice: "",
  ...over,
});
const cues = (events: GameEvent[], before = snap(), now = snap()) =>
  cuesFor("legend", events, before, now);

describe("sound effects", () => {
  it("has a file for every cue it can play", () => {
    for (const race of ["planetary", "sage", "android", "legend"] as const)
      for (const ability of SFX_ABILITIES)
        expect(existsSync("public" + sfxFile({ race, ability })), race + "/" + ability).toBe(true);
    const events: GameEvent[] = [
      { type: "hit", ...at, target: "m1" },
      { type: "hit", ...at, target: "m1", crit: true },
      { type: "hit", ...at, target: "m1", text: "Tarcza" },
      { type: "hit", ...at, target: "player", text: "-5" },
      { type: "hit", ...at, target: "player", text: "Unik" },
      { type: "death", ...at, target: "player" },
      { type: "death", ...at, target: "m1" },
      { type: "respawn", ...at },
      { type: "level", ...at },
      { type: "loot", ...at, text: "+4 monet" },
      { type: "loot", ...at, text: "+1 Kieł" },
      { type: "telegraph", ...at },
    ];
    for (const file of cues(events)) expect(existsSync("public" + file), file).toBe(true);
    for (const file of cues(
      [],
      snap(),
      snap({ potions: 2, interior: "depot", noticeId: 2, notice: "Nagroda: X" }),
    ))
      expect(existsSync("public" + file), file).toBe(true);
  });
  it("plays the race's own ability sound only for the player's kit events", () => {
    expect(cues([{ type: "attack", ...at, ability: "R" }])).toEqual(["/game/sfx/legend/R.mp3"]);
    expect(cues([{ type: "burst", ...at, ability: "C9" }])).toEqual(["/game/sfx/legend/C9.mp3"]);
    // Choice nodes have no sound of their own; monsters' attacks and statuses stay silent.
    expect(cues([{ type: "buff", ...at, ability: "A7" }])).toEqual([]);
    expect(cues([{ type: "attack", ...at, ability: "R", source: "m1" }])).toEqual([]);
    expect(cues([{ type: "status", ...at, ability: "A1", target: "m1" }])).toEqual([]);
  });
  it("maps hits, misses and deaths, and plays one sound per cue per frame", () => {
    expect(
      cues([
        { type: "hit", ...at, target: "m1" },
        { type: "hit", ...at, target: "m2" },
        { type: "hit", ...at, target: "m3", text: "Pudło" },
      ]),
    ).toEqual(["/game/sfx/common/hit.mp3"]);
    expect(cues([{ type: "hit", ...at, target: "player", text: "Unik" }])).toEqual([
      "/game/sfx/common/dodge.mp3",
    ]);
    expect(cues([{ type: "respawn", ...at, target: "m1" }])).toEqual([]);
    expect(cues([{ type: "loot", ...at, text: "+12 monet" }])).toEqual([
      "/game/sfx/common/gold.mp3",
    ]);
  });
  it("reads the potion, door and notices from the player snapshot", () => {
    expect(cues([], snap(), snap({ potions: 2 }))).toEqual(["/game/sfx/common/potion.mp3"]);
    expect(cues([], snap(), snap({ interior: "depot" }))).toEqual(["/game/sfx/common/door.mp3"]);
    expect(cues([], snap(), snap({ noticeId: 2, notice: "Za mało KI (20)." }))).toEqual([
      "/game/sfx/common/no-energy.mp3",
    ]);
    // The same notice id is not a new message; the first frame has no previous snapshot.
    expect(cues([], snap({ notice: "Za mało KI" }), snap({ notice: "Za mało KI" }))).toEqual([]);
    expect(cuesFor("sage", [], null, snap({ potions: 0 }))).toEqual([]);
  });
  it("maps P0 development training, measurement target and exam cues via Krok 0 reuse", () => {
    for (const id of Object.keys(DEVELOPMENT_SFX_REUSE) as DevelopmentSfxId[]) {
      const file = developmentSfxFile(id);
      expect(existsSync("public" + file), id + " -> " + file).toBe(true);
    }
    expect(cues([{ type: "hit", ...at, target: "training-dummy", text: "-12" }])).toEqual([
      "/game/sfx/common/hit.mp3",
    ]);
    expect(cues([{ type: "hit", ...at, target: "practice-target-1", text: "-18" }])).toEqual([
      "/game/sfx/common/hit-armor.mp3",
    ]);
    expect(
      cues(
        [],
        snap(),
        snap({ noticeId: 2, notice: "Egzamin zdany. +250 praktyki; wynik zapisano." }),
      ),
    ).toEqual(["/game/sfx/common/quest-complete.mp3"]);
    expect(
      cues([], snap(), snap({ noticeId: 2, notice: "Przekroczono dopuszczalną liczbę błędów." })),
    ).toEqual(["/game/sfx/common/no-energy.mp3"]);
    expect(
      cues(
        [],
        snap(),
        snap({
          noticeId: 2,
          notice: "Zapisano nowy stopień treningu. HP i KI nie zostały odnowione.",
        }),
      ),
    ).toEqual(["/game/sfx/common/level-up.mp3"]);
  });
  it("verifies all 37 dedicated development SFX and 4 P3 ambience loops exist on disk and opt-in via ?ki-dev-sfx=1", () => {
    expect(devSfxEnabled("")).toBe(false);
    expect(devSfxEnabled("?ki-dev-sfx=1")).toBe(true);
    expect(devSfxEnabled("?ki-dev-art=1")).toBe(true);

    for (const id of Object.keys(DEVELOPMENT_SFX_DEDICATED) as DevelopmentSfxId[]) {
      const dedicatedFile = developmentSfxFile(id, true);
      expect(dedicatedFile.startsWith("/game/sfx/development/")).toBe(true);
      expect(existsSync("public" + dedicatedFile), `${id} -> ${dedicatedFile}`).toBe(true);
    }

    for (const id of Object.keys(DEVELOPMENT_AMBIENCE_FILES) as DevelopmentAmbienceId[]) {
      const ambFile = developmentAmbienceFile(id);
      expect(ambFile.startsWith("/game/sfx/ambience/")).toBe(true);
      expect(existsSync("public" + ambFile), `${id} -> ${ambFile}`).toBe(true);
      expect(sfxFile(id)).toBe(ambFile);
    }
  });
});

describe("monster, footstep and interface sounds", () => {
  it("has attack and death sounds for every bestiary monster", () => {
    for (const m of MONSTER_BASE)
      for (const cue of ["atk", "die"] as const) {
        const file = monsterSfxFile(m.id, cue);
        expect(file, m.id + " " + cue).toBeDefined();
        expect(existsSync("public" + file), String(file)).toBe(true);
      }
  });
  it("maps every boss to a folder with attack, death and roar sounds", () => {
    for (const boss of BOSS_CATALOG) {
      expect(BOSS_SFX_DIR["boss:" + boss.id], boss.id).toBeDefined();
      for (const cue of ["atk", "die", "roar"] as const) {
        const file = monsterSfxFile("boss:" + boss.id, cue);
        expect(file, boss.id + " " + cue).toBeDefined();
        expect(existsSync("public" + file), String(file)).toBe(true);
      }
    }
  });
  it("plays a monster's own attack and death sound and falls back for unknown species", () => {
    expect(
      cues([
        {
          type: "attack",
          ...at,
          source: "verdant-cierniowy-wilk#1",
          species: "verdant-cierniowy-wilk",
          target: "player",
        },
      ]),
    ).toEqual(["/game/sfx/monsters/verdant-cierniowy-wilk/atk.mp3"]);
    expect(
      cues([{ type: "death", ...at, target: "boss:pyrrhax#2", species: "boss:pyrrhax" }]),
    ).toEqual(["/game/sfx/monsters/pyra-pyrrhax/die.mp3"]);
    expect(cues([{ type: "death", ...at, target: "boar#1", species: "boar" }])).toEqual([
      "/game/sfx/common/monster-death.mp3",
    ]);
    expect(cues([{ type: "attack", ...at, source: "boar#1", species: "boar" }])).toEqual([]);
  });
  it("chooses the footstep surface from the world, terrain and interior", () => {
    expect(stepSurface("verdant", "forest", null)).toBe("grass");
    expect(stepSurface("verdant", "water", null)).toBe("water");
    expect(stepSurface("verdant", "rock", null)).toBe("stone");
    expect(stepSurface("aether", "open", null)).toBe("stone");
    expect(stepSurface("nexus", "open", null)).toBe("metal");
    expect(stepSurface("pyra", "open", null)).toBe("ash");
    expect(stepSurface("verdant", "forest", "smithy")).toBe("wood");
    expect(stepSurface("nexus", "open", "depot")).toBe("metal");
    const surfaces: StepSurface[] = [
      "grass",
      "dirt",
      "stone",
      "sand",
      "snow",
      "wood",
      "metal",
      "ash",
      "water",
    ];
    for (const surface of surfaces)
      expect(existsSync("public" + stepFile(surface)), surface).toBe(true);
  });
  it("ships the interface click sound", () => {
    expect(existsSync("public/game/sfx/ui/click.mp3")).toBe(true);
  });
  it("plays hurt, skill, roar, status, shop and upgrade sounds that exist on disk", () => {
    const files = [
      monsterHurtFile(MONSTER_BASE[0]!.id),
      monsterHurtFile("boss:" + BOSS_CATALOG[0]!.id),
      monsterSkillFile("szarza"),
      monsterSkillFile("roj"),
      statusSfxFile("burn"),
      statusSfxFile("root"),
    ];
    for (const f of files) {
      expect(f).toBeDefined();
      expect(existsSync("public" + f), String(f)).toBe(true);
    }
    expect(monsterSkillFile("nieznana")).toBeUndefined();
    expect(statusSfxFile("fear")).toBeUndefined();
    expect(monsterHurtFile(undefined)).toBeUndefined();
  });
  it("maps cues from events and status changes", () => {
    const snap = { potions: 0, interior: null, noticeId: 1, notice: "", fx: [] as string[] };
    const hit = cuesFor(
      "sage",
      [{ type: "hit", target: "x#1", species: MONSTER_BASE[0]!.id, text: "-5" } as never],
      snap,
      snap,
    );
    expect(hit.some((f) => f.includes("/generic/hurt-"))).toBe(true);
    const tele = cuesFor("sage", [{ type: "telegraph", ability: "szarza" } as never], snap, snap);
    expect(tele).toContain("/game/sfx/monsters/generic/charge.mp3");
    const fx = cuesFor("sage", [], snap, { ...snap, fx: ["stun"] });
    expect(fx).toContain("/game/sfx/status/stun.mp3");
    expect(cuesFor("sage", [], { ...snap, fx: ["stun"] }, { ...snap, fx: ["stun"] })).not.toContain(
      "/game/sfx/status/stun.mp3",
    );
  });
});
