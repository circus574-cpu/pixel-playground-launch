import { describe, expect, it, vi } from "vitest";
import { ActorAnimation } from "../game/assets/actorAnimation";
import { technicalPack, actorVisual, worldAssets, catalog } from "../game/assets/catalog";
import { renderDepth } from "../game/assets/layers";
import { DIRECTIONS } from "../game/assets/schema";
import type Phaser from "phaser";
function rig() {
  const sprite = {
    anims: { pause: vi.fn(), resume: vi.fn() },
    play: vi.fn(),
    stop: vi.fn(),
    setTexture: vi.fn(),
    flipX: false,
    setFlipX: vi.fn(function (this: { flipX: boolean }, v: boolean) {
      this.flipX = v;
    }),
  };
  return {
    sprite,
    animation: new ActorAnimation(
      sprite as unknown as Phaser.GameObjects.Sprite,
      technicalPack.actors[0]!,
    ),
  };
}
describe("Tryb KI walk (kiwalk)", () => {
  const withKi = () => {
    const base = actorVisual("verdant", "hero", undefined, false, catalog);
    const sprite = {
      anims: { pause: vi.fn(), resume: vi.fn() },
      play: vi.fn(),
      stop: vi.fn(),
      setTexture: vi.fn(),
      flipX: false,
      setFlipX: vi.fn(function (this: { flipX: boolean }, v: boolean) {
        this.flipX = v;
      }),
    };
    return {
      sprite,
      animation: new ActorAnimation(sprite as unknown as Phaser.GameObjects.Sprite, base),
    };
  };
  it("walks in the powered-up form only while Tryb KI is active and the hero moves", () => {
    const { animation, sprite } = withKi();
    animation.update(0, true, false, { x: 1, y: 0 }, false, false);
    expect(animation.state).toBe("walk");
    animation.update(100, true, false, { x: 1, y: 0 }, false, true);
    expect(animation.state).toBe("kiwalk");
    expect(String(sprite.setTexture.mock.calls.at(-1)?.[1])).toContain("/kiwalk/");
    animation.update(200, false, false, { x: 1, y: 0 }, false, true);
    expect(animation.state).toBe("idle");
    animation.update(300, true, false, { x: 1, y: 0 }, false, false);
    expect(animation.state).toBe("walk");
  });
  it("falls back to the normal walk for a hero without a kiwalk clip", () => {
    const { animation } = rig();
    animation.update(0, true, false, { x: 1, y: 0 }, false, true);
    expect(animation.state).toBe("walk");
  });
});
describe("Tryb KI stance, basic attack and skill (kiidle, kiattack, kiskill)", () => {
  const rigKi = () => {
    const base = actorVisual("verdant", "hero", undefined, false, catalog);
    const sprite = {
      anims: { pause: vi.fn(), resume: vi.fn() },
      play: vi.fn(),
      stop: vi.fn(),
      setTexture: vi.fn(),
      flipX: false,
      setFlipX: vi.fn(function (this: { flipX: boolean }, v: boolean) {
        this.flipX = v;
      }),
    };
    return {
      sprite,
      base,
      animation: new ActorAnimation(sprite as unknown as Phaser.GameObjects.Sprite, base),
    };
  };
  it("ships both clips for every hero with the contract frame counts", () => {
    for (const world of ["verdant", "aether", "nexus", "pyra"] as const) {
      const hero = actorVisual(world, "hero", undefined, false, catalog);
      for (const [clip, frames] of [
        ["kiidle", 6],
        ["kiattack", 6],
        ["kiskill", 8],
      ] as const) {
        const c = hero.clips[clip]!;
        expect(c, world + clip).toBeDefined();
        expect(Object.keys(c.directions).sort()).toEqual([...DIRECTIONS].sort());
        for (const names of Object.values(c.directions)) expect(names).toHaveLength(frames);
      }
    }
  });
  it("stands in the powered-up stance only while Tryb KI is active", () => {
    const { animation, sprite, base } = rigKi();
    animation.update(0, false, false, { x: 1, y: 0 }, false, false);
    expect(animation.state).toBe("idle");
    expect(String(sprite.setTexture.mock.calls.at(-1)?.[1] ?? "")).not.toContain("kiidle");
    animation.update(100, false, false, { x: 1, y: 0 }, false, true);
    expect(animation.state).toBe("idle");
    expect(base.clips.kiidle!.loop).toBe(true);
    expect(String(sprite.setTexture.mock.calls.at(-1)?.[1])).toContain("/kiidle/");
    animation.update(200, false, false, { x: 1, y: 0 }, false, false);
    expect(String(sprite.setTexture.mock.calls.at(-1)?.[1] ?? "")).not.toContain("kiidle");
  });
  it("plays the powered-up basic attack only in Tryb KI and keeps the priority rules", () => {
    const { animation, sprite } = rigKi();
    animation.update(0, false, false, { x: 1, y: 0 }, false, true);
    animation.trigger("attack", 10, { x: 1, y: 0 });
    animation.update(20, false, false, { x: 1, y: 0 }, false, true);
    expect(animation.state).toBe("attack");
    // The KI strikes chain kiattack2, kifinisher, kiattack: the first one is the light strike.
    expect(String(sprite.play.mock.calls.at(-1)?.[0])).toContain("/kiattack2/");
    animation.trigger("skill", 30, { x: 1, y: 0 });
    animation.update(40, false, false, { x: 1, y: 0 }, false, true);
    expect(animation.state).toBe("skill");
    expect(String(sprite.play.mock.calls.at(-1)?.[0])).toContain("/kiskill/");
    // Without Tryb KI the same trigger uses the base attack and skill clips.
    const plain = rigKi();
    plain.animation.update(0, false, false, { x: 1, y: 0 }, false, false);
    plain.animation.trigger("attack", 10, { x: 1, y: 0 });
    plain.animation.update(20, false, false, { x: 1, y: 0 }, false, false);
    expect(String(plain.sprite.play.mock.calls.at(-1)?.[0])).not.toContain("kiattack");
    plain.animation.trigger("skill", 400, { x: 1, y: 0 });
    plain.animation.update(410, false, false, { x: 1, y: 0 }, false, false);
    expect(String(plain.sprite.play.mock.calls.at(-1)?.[0])).not.toContain("kiskill");
  });
  it("falls back to the base idle and attack for a rig without the clips", () => {
    const { animation } = rig();
    animation.update(0, false, false, { x: 1, y: 0 }, false, true);
    expect(animation.state).toBe("idle");
    animation.trigger("attack", 10, { x: 1, y: 0 });
    animation.update(20, false, false, { x: 1, y: 0 }, false, true);
    expect(animation.state).toBe("attack");
  });
});
describe("base-form combat clips (attack chain, area skill, dodge, guard)", () => {
  const make = () => {
    const base = actorVisual("verdant", "hero", undefined, false, catalog);
    const sprite = {
      anims: { pause: vi.fn(), resume: vi.fn() },
      play: vi.fn(),
      stop: vi.fn(),
      setTexture: vi.fn(),
      flipX: false,
      setFlipX: vi.fn(function (this: { flipX: boolean }, v: boolean) {
        this.flipX = v;
      }),
    };
    return {
      base,
      sprite,
      animation: new ActorAnimation(sprite as unknown as Phaser.GameObjects.Sprite, base),
    };
  };
  const played = (sprite: ReturnType<typeof make>["sprite"]) =>
    String(sprite.play.mock.calls.at(-1)?.[0]);
  it("ships the clips for every hero with the contract frame counts", () => {
    for (const world of ["verdant", "aether", "nexus", "pyra"] as const) {
      const hero = actorVisual(world, "hero", undefined, false, catalog);
      for (const [clip, frames] of [
        ["attack2", 6],
        ["finisher", 8],
        ["skillb", 8],
        ["dodge", 6],
        ["guard", 6],
      ] as const) {
        const c = hero.clips[clip]!;
        expect(c, world + clip).toBeDefined();
        expect(c.loop).toBe(false);
        for (const names of Object.values(c.directions)) expect(names).toHaveLength(frames);
      }
    }
  });
  it("chains basic strikes attack, attack2, finisher within 1.4 s and starts over after a pause", () => {
    const { animation, sprite } = make();
    const f = { x: 1, y: 0 };
    animation.trigger("attack", 0, f);
    animation.update(10, false, false, f);
    expect(played(sprite)).toContain("/attack/");
    animation.trigger("attack", 800, f);
    animation.update(810, false, false, f);
    expect(played(sprite)).toContain("/attack2/");
    animation.trigger("attack", 1600, f);
    animation.update(1610, false, false, f);
    expect(played(sprite)).toContain("/finisher/");
    animation.trigger("attack", 2400, f);
    animation.update(2410, false, false, f);
    expect(played(sprite)).toContain("/attack/");
    animation.trigger("attack", 6000, f);
    animation.update(6010, false, false, f);
    expect(played(sprite)).toContain("/attack/");
  });
  it("plays skillb, dodge and guard, and uses kiskillb for skillb in Tryb KI", () => {
    const { animation, sprite } = make();
    const f = { x: 1, y: 0 };
    animation.trigger("skillb", 0, f);
    animation.update(10, false, false, f);
    expect(played(sprite)).toContain("/skillb/");
    animation.trigger("dodge", 2000, f);
    animation.update(2010, false, false, f);
    expect(played(sprite)).toContain("/dodge/");
    animation.trigger("guard", 4000, f);
    animation.update(4010, false, false, f);
    expect(played(sprite)).toContain("/guard/");
    animation.update(6000, false, false, f, false, true);
    animation.trigger("skillb", 6100, f);
    animation.update(6110, false, false, f, false, true);
    expect(played(sprite)).toContain("/kiskillb/");
  });
});
describe("Tryb KI combat and reactions use the form's own clips", () => {
  const make = (world: "verdant" | "aether" | "nexus" | "pyra" = "nexus") => {
    const visual = actorVisual(world, "hero", undefined, false, catalog);
    const sprite = {
      anims: { pause: vi.fn(), resume: vi.fn() },
      play: vi.fn(),
      stop: vi.fn(),
      setTexture: vi.fn(),
      flipX: false,
      setFlipX: vi.fn(function (this: { flipX: boolean }, v: boolean) {
        this.flipX = v;
      }),
    };
    return {
      visual,
      sprite,
      animation: new ActorAnimation(sprite as unknown as Phaser.GameObjects.Sprite, visual),
    };
  };
  const played = (sprite: ReturnType<typeof make>["sprite"]) =>
    String(sprite.play.mock.calls.at(-1)?.[0]);
  const f = { x: 1, y: 0 };
  it("ships the clips with the contract frame counts (Android has every one, all races have the combat clips)", () => {
    const combat = [
      ["kiattack2", 6],
      ["kifinisher", 8],
      ["kiskillb", 8],
      ["kidodge", 6],
      ["kiguard", 6],
    ] as const;
    const reactions = [
      ["kihit", 6],
      ["kihitheavy", 8],
      ["kideath", 8],
      ["kirespawn", 8],
      ["kivictory", 8],
    ] as const;
    for (const world of ["verdant", "aether", "nexus", "pyra"] as const) {
      const hero = actorVisual(world, "hero", undefined, false, catalog);
      for (const [clip, frames] of combat) {
        if (world === "verdant" && clip === "kifinisher") continue; // Planetary's video has no third strike
        expect(hero.clips[clip], world + clip).toBeDefined();
        for (const names of Object.values(hero.clips[clip]!.directions))
          expect(names).toHaveLength(frames);
      }
      for (const [clip, frames] of reactions) {
        const c = hero.clips[clip];
        expect(c, world + clip).toBeDefined();
        for (const names of Object.values(c!.directions)) expect(names).toHaveLength(frames);
      }
    }
  });
  it("chains the KI strikes kiattack2, kifinisher, kiattack within 1.4 s", () => {
    const { animation, sprite } = make();
    animation.update(0, false, false, f, false, true);
    animation.trigger("attack", 100, f);
    animation.update(110, false, false, f, false, true);
    expect(played(sprite)).toContain("/kiattack2/");
    animation.trigger("attack", 900, f);
    animation.update(910, false, false, f, false, true);
    expect(played(sprite)).toContain("/kifinisher/");
    animation.trigger("attack", 1700, f);
    animation.update(1710, false, false, f, false, true);
    expect(played(sprite)).toContain("/kiattack/");
  });
  it("plays the KI skill B, dodge, guard, hit, heavy hit and victory instead of the base clips", () => {
    const { animation, sprite } = make();
    animation.update(0, false, false, f, false, true);
    let t = 100;
    for (const [state, clip] of [
      ["skillb", "kiskillb"],
      ["dodge", "kidodge"],
      ["guard", "kiguard"],
      ["hit", "kihit"],
      ["hitheavy", "kihitheavy"],
      ["victory", "kivictory"],
    ] as const) {
      t += 3000;
      animation.trigger(state, t, f);
      animation.update(t + 10, false, false, f, false, true);
      expect(played(sprite), state).toContain("/" + clip + "/");
    }
  });
  it("falls and gets up in the KI form even when the buff ends meanwhile", () => {
    const { animation, sprite } = make();
    animation.update(0, false, false, f, false, true);
    animation.trigger("death", 100, f);
    animation.update(110, false, true, f, false, true);
    expect(played(sprite)).toContain("/kideath/");
    animation.update(500, false, true, f, false, false);
    expect(animation.state).toBe("death");
    animation.update(600, false, false, f, false, false);
    expect(animation.state).toBe("respawn");
    expect(played(sprite)).toContain("/kirespawn/");
  });
  it("leaves the base form untouched: its own hit and attack clips play", () => {
    const base = make();
    base.animation.update(0, false, false, f, false, false);
    base.animation.trigger("hit", 100, f);
    base.animation.update(110, false, false, f, false, false);
    expect(played(base.sprite)).toContain("/hit/");
    base.animation.trigger("attack", 3000, f);
    base.animation.update(3010, false, false, f, false, false);
    expect(played(base.sprite)).toContain("/attack/");
  });
});
describe("base-form movement clips (run, channel, skill C, interact)", () => {
  const make = () => {
    const base = actorVisual("verdant", "hero", undefined, false, catalog);
    const sprite = {
      anims: { pause: vi.fn(), resume: vi.fn() },
      play: vi.fn(),
      stop: vi.fn(),
      setTexture: vi.fn(),
      flipX: false,
      setFlipX: vi.fn(function (this: { flipX: boolean }, v: boolean) {
        this.flipX = v;
      }),
    };
    return {
      sprite,
      animation: new ActorAnimation(sprite as unknown as Phaser.GameObjects.Sprite, base),
    };
  };
  const shown = (sprite: ReturnType<typeof make>["sprite"]) =>
    String(sprite.setTexture.mock.calls.at(-1)?.[1] ?? "");
  const played = (sprite: ReturnType<typeof make>["sprite"]) =>
    String(sprite.play.mock.calls.at(-1)?.[0]);
  it("ships the clips for every hero with the contract frame counts", () => {
    for (const world of ["verdant", "aether", "nexus", "pyra"] as const) {
      const hero = actorVisual(world, "hero", undefined, false, catalog);
      for (const [clip, frames, loop] of [
        ["run", 8, true],
        ["channel", 8, true],
        ["skillc", 8, false],
        ["interact", 6, false],
      ] as const) {
        const c = hero.clips[clip]!;
        expect(c, world + clip).toBeDefined();
        expect(c.loop).toBe(loop);
        for (const names of Object.values(c.directions)) expect(names).toHaveLength(frames);
      }
    }
  });
  it("runs instead of walking only when fast, and runs in the KI form in Tryb KI", () => {
    const { animation, sprite } = make();
    const f = { x: 1, y: 0 };
    animation.update(0, true, false, f);
    expect(animation.state).toBe("walk");
    animation.update(100, true, false, f, false, false, true);
    expect(animation.state).toBe("run");
    expect(shown(sprite)).toContain("/run/");
    animation.update(200, true, false, f, false, true, true);
    expect(animation.state).toBe("kirun");
    expect(shown(sprite)).toContain("/kirun/");
    animation.update(300, true, false, f, false, true, false);
    expect(animation.state).toBe("kiwalk");
  });
  it("holds the channel pose for the channel time and drops it when the hero moves", () => {
    const { animation, sprite } = make();
    const f = { x: 1, y: 0 };
    animation.trigger("channel", 0, f, 3000);
    animation.update(2500, false, false, f);
    expect(animation.state).toBe("channel");
    expect(shown(sprite)).toContain("/channel/");
    animation.update(3100, false, false, f);
    expect(animation.state).toBe("idle");
    animation.trigger("channel", 4000, f, 3000);
    animation.update(4100, true, false, f);
    expect(animation.state).toBe("walk");
  });
  it("plays skill C and the pick-up gesture, and their KI-form clips in Tryb KI", () => {
    const { animation, sprite } = make();
    const f = { x: -1, y: 0 };
    animation.trigger("skillc", 0, f);
    animation.update(10, false, false, f);
    expect(played(sprite)).toContain("/skillc/");
    animation.trigger("interact", 2000, f);
    animation.update(2010, false, false, f);
    expect(played(sprite)).toContain("/interact/");
    animation.update(4000, false, false, f, false, true);
    animation.trigger("skillc", 4100, f);
    animation.update(4110, false, false, f, false, true);
    expect(played(sprite)).toContain("/kiskillc/");
    animation.trigger("interact", 6000, f);
    animation.update(6010, false, false, f, false, true);
    expect(played(sprite)).toContain("/kiinteract/");
  });
  it("ships the Tryb KI movement clips for every hero, drawn mirrored to the left", () => {
    for (const world of ["verdant", "aether", "nexus", "pyra"] as const) {
      const hero = actorVisual(world, "hero", undefined, false, catalog);
      for (const [clip, frames, loop] of [
        ["kirun", 8, true],
        ["kichannel", 8, true],
        ["kiskillc", 8, false],
        ["kiinteract", 6, false],
      ] as const) {
        const c = hero.clips[clip]!;
        expect(c, world + clip).toBeDefined();
        expect(c.loop).toBe(loop);
        expect(c.mirrored).toEqual(["down-left", "left", "up-left"]);
        for (const names of Object.values(c.directions)) expect(names).toHaveLength(frames);
      }
    }
  });
  it("holds the KI channel in the KI form", () => {
    const { animation, sprite } = make();
    const f = { x: 1, y: 0 };
    animation.update(0, false, false, f, false, true);
    animation.trigger("channel", 100, f, 3000);
    animation.update(2500, false, false, f, false, true);
    expect(animation.state).toBe("channel");
    expect(shown(sprite)).toContain("/kichannel/");
  });
  it("keeps a charge on screen when the same cast also raises a shield", () => {
    const { animation, sprite } = make();
    const f = { x: 1, y: 0 };
    animation.trigger("skillc", 0, f);
    animation.trigger("guard", 0);
    animation.update(10, false, false, f);
    expect(played(sprite)).toContain("/skillc/");
    animation.update(2000, false, false, f);
    animation.trigger("guard", 2000);
    animation.update(2010, false, false, f);
    expect(played(sprite)).toContain("/guard/");
  });
});
describe("walk keeps its stride when only the facing changes", () => {
  const make = () => {
    const base = actorVisual("verdant", "hero", undefined, false, catalog);
    const sprite = {
      anims: { pause: vi.fn(), resume: vi.fn() },
      play: vi.fn(),
      stop: vi.fn(),
      setTexture: vi.fn(),
      flipX: false,
      setFlipX: vi.fn(function (this: { flipX: boolean }, v: boolean) {
        this.flipX = v;
      }),
    };
    return {
      base,
      sprite,
      animation: new ActorAnimation(sprite as unknown as Phaser.GameObjects.Sprite, base),
    };
  };
  it("advances with one clock while the facing flips between neighbouring directions every tick", () => {
    const { animation, sprite, base } = make();
    const walk = base.clips.walk!;
    const flips = [
      ["right", { x: 1, y: 0 }],
      ["down-right", { x: 1, y: 1 }],
    ] as const;
    const shown: string[] = [];
    // A new facing every 20 ms (faster than one 62.5 ms frame): restarting the animation would never leave frame 0.
    for (let t = 0; t <= 500; t += 20) {
      const [dir, facing] = flips[(t / 20) % 2]!;
      animation.update(t, true, false, facing, false, false);
      const frame = String(sprite.setTexture.mock.calls.at(-1)?.[1]);
      expect(walk.directions[dir]).toContain(frame);
      shown.push(frame.split("/").at(-1)!);
    }
    expect(new Set(shown).size).toBe(walk.directions.right!.length);
    expect(sprite.play).not.toHaveBeenCalled();
  });
  it("starts the stride from its first frame when the state changes to walking", () => {
    const { animation, sprite, base } = make();
    animation.update(0, false, false, { x: 1, y: 0 }, false, false);
    animation.update(1000, true, false, { x: 1, y: 0 }, false, false);
    expect(sprite.setTexture).toHaveBeenLastCalledWith(
      base.clips.walk!.asset,
      base.clips.walk!.directions.right![0],
    );
  });
});
describe("animation presentation remains separate from mechanical actions", () => {
  it("maps all eight real movement vectors and does not restart an unchanged clip", () => {
    const { sprite, animation } = rig();
    const walk = technicalPack.actors[0]!.clips.walk!;
    for (const [i, dir] of DIRECTIONS.entries()) {
      const angle = Math.PI / 2 + (i * Math.PI) / 4;
      animation.update(i * 100, true, false, { x: Math.cos(angle), y: Math.sin(angle) });
      const frame = String(sprite.setTexture.mock.calls.at(-1)?.[1]);
      expect(walk.directions[dir]).toContain(frame);
    }
    const count = sprite.setTexture.mock.calls.length;
    animation.update(1000, true, false, { x: 1, y: 1 });
    animation.update(1001, true, false, { x: 1, y: 1 });
    expect(sprite.setTexture.mock.calls.length).toBeLessThanOrEqual(count + 1);
  });
  it("prioritizes death/hit over attacks and resumes walking only after event animation", () => {
    const { animation } = rig();
    animation.trigger("attack", 0);
    expect(animation.state).toBe("attack");
    animation.trigger("hit", 10);
    animation.trigger("attack", 20);
    expect(animation.state).toBe("hit");
    animation.update(300, true, false, { x: 1, y: 0 });
    expect(animation.state).toBe("attack");
    animation.update(900, true, false, { x: 1, y: 0 });
    expect(animation.state).toBe("walk");
    animation.trigger("death", 1000);
    animation.update(5000, false, true, { x: 0, y: 1 });
    expect(animation.state).toBe("death");
    animation.trigger("attack", 5100);
    expect(animation.state).toBe("death");
    animation.update(5200, false, false, { x: 0, y: 1 });
    expect(animation.state).toBe("respawn");
    animation.update(5500, false, false, { x: 0, y: 1 });
    expect(animation.state).toBe("idle");
  });
  it("coalesces blocked actions, preserves hit priority and discards stale presentation", () => {
    const { animation, sprite } = rig();
    animation.trigger("hit", 0);
    animation.trigger("attack", 10);
    animation.trigger("skill", 20);
    animation.trigger("attack", 30);
    animation.update(100, false, false, { x: 0, y: 1 });
    expect(animation.state).toBe("hit");
    animation.trigger("attack", 270);
    animation.update(270, false, false, { x: 0, y: 1 });
    expect(animation.state).toBe("skill");
    expect(sprite.play).toHaveBeenLastCalledWith("technical-mannequin/skill/down");
    const stale = rig().animation;
    stale.trigger("hit", 0);
    stale.trigger("skill", 10);
    stale.update(1000, true, false, { x: 0, y: 1 });
    expect(stale.state).toBe("walk");
  });
  it("never replays a blocked action after death and respawn", () => {
    const { animation } = rig();
    animation.trigger("hit", 0);
    animation.trigger("skill", 10);
    animation.update(30, false, true, { x: 0, y: 1 });
    expect(animation.state).toBe("death");
    animation.update(100, false, false, { x: 0, y: 1 });
    animation.update(900, false, false, { x: 0, y: 1 });
    expect(animation.state).toBe("idle");
  });
  it("uses legacy fallback without inventing missing painted clips, freezes when paused", () => {
    const sprite = {
      anims: { pause: vi.fn(), resume: vi.fn() },
      play: vi.fn(),
      stop: vi.fn(),
      setTexture: vi.fn(),
      flipX: false,
      setFlipX: vi.fn(function (this: { flipX: boolean }, v: boolean) {
        this.flipX = v;
      }),
    };
    const animation = new ActorAnimation(
      sprite as unknown as Phaser.GameObjects.Sprite,
      actorVisual("pyra", "npc"),
    );
    animation.trigger("skill", 0);
    animation.update(1, false, false, { x: 0, y: 1 });
    expect(sprite.setTexture).toHaveBeenCalledWith("hero-sheet", 0);
    animation.update(2000, false, false, { x: 0, y: 1 }, true);
    expect(sprite.anims.pause).toHaveBeenCalled();
    expect(animation.state).toBe("skill");
  });
  it("separates world layers, selects one continent and never preloads the diagnostic rig by default", () => {
    expect(renderDepth("ground")).toBeLessThan(renderDepth("below"));
    expect(renderDepth("objects", 100)).toBeLessThan(renderDepth("actors", 101));
    expect(renderDepth("overhead")).toBeGreaterThan(renderDepth("actors", 2048));
    expect(renderDepth("combat")).toBeGreaterThan(renderDepth("atmosphere"));
    expect(worldAssets("pyra").map((a) => a.id)).not.toContain("technical-rig");
    expect(worldAssets("pyra", true).map((a) => a.id)).toContain("technical-rig");
    expect(worldAssets("pyra").map((a) => a.id)).not.toContain("forest-objects");
    expect(catalog.actorBindings["hero.human-v2"]).toBe("human-v2");
  });
});
