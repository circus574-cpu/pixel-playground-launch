import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cuesFor, sfxFile, SFX_ABILITIES, type SfxSnapshot } from "../game/sfx";
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
});
