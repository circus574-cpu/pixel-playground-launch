import { describe, it, expect, vi } from "vitest";
import { KIT_NODES, RACE_BASE, canLearn, createKit } from "../game/kit";
import { RACE_IDS, type RaceId } from "../game/world/races";
import { harness, foe } from "./helpers/kitHarness";

type H = ReturnType<typeof harness>;
const make = (race: RaceId, ...ids: string[]) => {
  const h = harness(
    race,
    20,
    ["R", ...ids],
    [foe("a", 40, 0, 1e8), foe("b", 100, 0, 1e8), foe("far", 1200, 0, 1e8)],
  );
  h.state.target = h.foes[0];
  return h;
};
const cast = (h: H, id: string) => expect(h.kit.use(id).ok, id).toBe(true);
const raw = (h: H) => h.state.hits.at(-1)!.raw;
const hit = (h: H) => {
  cast(h, "R");
  return raw(h);
};
const stat = (race: RaceId, id: string, field: keyof H["kit"]["stats"], multiplier: number) => {
  const b = make(race),
    h = make(race, id);
  expect(h.kit.stats[field]).toBeCloseTo(
    field === "speed" ||
      field === "kiRegen" ||
      field === "ccMul" ||
      field === "range" ||
      field === "attackInterval"
      ? b.kit.stats[field] * multiplier
      : Math.floor(
          (RACE_BASE[race].base[
            field === "maxHp"
              ? "hp"
              : field === "maxKi"
                ? "ki"
                : field === "attack"
                  ? "attack"
                  : "defense"
          ] +
            19 *
              RACE_BASE[race].perLevel[
                field === "maxHp"
                  ? "hp"
                  : field === "maxKi"
                    ? "ki"
                    : field === "attack"
                      ? "attack"
                      : "defense"
              ]) *
            multiplier +
            0.5,
        ),
    6,
  );
};
const crit = (r: RaceId, id: string, n: number) =>
  expect(make(r, id).kit.stats.crit - make(r).kit.stats.crit).toBeCloseTo(n);
const shield = (h: H, id: string, share: number, ms: number) => {
  cast(h, id);
  expect(h.kit.shieldPoints).toBeCloseTo(h.kit.stats.maxHp * share);
  expect(h.kit.shields[0]!.ms).toBe(ms);
};
const area = (h: H, id: string, mult: number, radius: number) => {
  const spy = vi.spyOn(h.port, "foesIn");
  cast(h, id);
  expect(spy).toHaveBeenCalledWith(expect.anything(), radius);
  expect(h.state.hits[0]!.raw).toBeCloseTo(h.kit.stats.attack * mult);
  expect(h.foes[2]!.hp).toBe(1e8);
};
const buffs = (h: H, id: string, values: Record<string, unknown>) => {
  cast(h, id);
  expect(h.kit.buff(id)).toMatchObject(values);
};
const effects: Record<RaceId, Record<string, () => void>> = {
  planetary: {
    R: () => {
      const h = make("planetary");
      const first = hit(h);
      h.step(650);
      hit(h);
      h.step(650);
      expect(hit(h)).toBeCloseTo(first * 1.3);
    },
    A1: () => {
      const h = make("planetary", "A1");
      cast(h, "A1");
      expect(h.state.player.x).toBe(160);
      expect(h.kit.absorb(40, "melee")).toBe(0);
      h.step(400);
      expect(h.kit.absorb(40, "melee")).toBe(40);
    },
    A2: () => stat("planetary", "A2", "speed", 1.06),
    A3: () => {
      const h = make("planetary", "A1", "A3");
      cast(h, "A1");
      expect(h.kit.buff("A3")).toMatchObject({ nextHitPct: 0.25, ms: 5000 });
      h.state.player.x = 0;
      expect(hit(h)).toBeCloseTo(h.kit.stats.attack * 1.25);
    },
    A4: () => area(make("planetary", "A4"), "A4", 1.8, 140),
    A5: () => {
      const h = make("planetary", "A5");
      h.kit.onKill(h.foes[0]!);
      expect(h.kit.buff("A5")).toMatchObject({ ms: 4000, speedPct: 0.15 });
    },
    A6: () => crit("planetary", "A6", 5),
    A7: () => {
      const h = make("planetary", "A1", "A7");
      cast(h, "A1");
      h.state.player.x = 0;
      hit(h);
      expect(h.state.hits.at(-1)!.hit.crit).toBe(true);
    },
    A8: () => {
      const h = make("planetary", "A1", "A8");
      cast(h, "A1");
      expect(h.kit.cooldowns["A1"]).toBe(4200);
      expect(h.kit.buff("A8")).toMatchObject({ ms: 1000, defPct: 0.2 });
    },
    A9: () => {
      const h = make("planetary", "A9");
      cast(h, "A9");
      h.step(650);
      expect(h.state.hits).toHaveLength(5);
      expect(h.state.hits.reduce((n, x) => n + x.raw, 0)).toBeCloseTo(h.kit.stats.attack * 4);
    },
    B1: () => {
      const h = make("planetary", "B1");
      area(h, "B1", 1.4, 120);
      expect(h.foes[0]!.slowed).toBe(0.3);
    },
    B2: () => {
      const h = make("planetary", "B2");
      h.state.terrain = "forest";
      expect(h.kit.stats.kiRegen).toBeCloseTo(make("planetary").kit.stats.kiRegen * 1.3);
      h.state.terrain = "water";
      expect(h.kit.stats.speed).toBeCloseTo(make("planetary").kit.stats.speed * 1.08);
      h.state.terrain = "rock";
      expect(h.kit.stats.defense).toBe(Math.floor(make("planetary").kit.stats.defense * 1.1 + 0.5));
    },
    B3: () => stat("planetary", "B3", "defense", 1.08),
    B4: () => {
      const h = make("planetary", "B4");
      cast(h, "B4");
      expect(raw(h)).toBe(h.kit.stats.attack * 2);
      expect(h.foes[0]!.stunned).toBe(1000);
    },
    B5: () => {
      const h = make("planetary", "B1", "B5");
      cast(h, "B1");
      const first = raw(h);
      h.step(450);
      expect(h.state.hits).toHaveLength(2);
      h.step(50);
      expect(h.state.hits).toHaveLength(4);
      expect(raw(h)).toBeCloseTo(first * 0.6);
    },
    B6: () => {
      const h = make("planetary", "B1", "B6");
      h.foes.push(foe("c", 20, 0));
      const k = h.state.player.ki;
      cast(h, "B1");
      expect(h.state.player.ki).toBe(k - 10 + 15);
    },
    B7: () => {
      const h = make("planetary", "B4", "B7");
      cast(h, "B4");
      expect(h.kit.shieldPoints).toBeCloseTo(h.kit.stats.maxHp * 0.15);
      expect(h.kit.shields[0]!.ms).toBe(5000);
    },
    B8: () => {
      const h = make("planetary", "B1", "B8");
      area(h, "B1", 1.4, 168);
      expect(h.foes[0]!.stunned).toBe(500);
    },
    B9: () => {
      const h = make("planetary", "B9");
      area(h, "B9", 4, 220);
      expect(h.foes[0]!.stunned).toBe(1500);
    },
    C1: () => {
      const h = make("planetary", "C1");
      cast(h, "C1");
      h.step(4000);
      expect(h.state.heals).toBeCloseTo(h.kit.stats.maxHp * 0.12);
    },
    C2: () => stat("planetary", "C2", "maxHp", 1.1),
    C3: () => {
      const h = make("planetary", "C3");
      h.state.inCombat = false;
      expect(h.kit.hpRegen()).toBe(0.01);
      h.state.inCombat = true;
      expect(h.kit.hpRegen()).toBe(0);
    },
    C4: () => shield(make("planetary", "C4"), "C4", 0.18, 5000),
    C5: () => stat("planetary", "C5", "ccMul", 0.75),
    C6: () => {
      const h = make("planetary", "C1", "C6");
      cast(h, "C1");
      h.step(4000);
      expect(h.state.heals).toBeCloseTo(h.kit.stats.maxHp * 0.12 * 1.3);
    },
    C7: () => {
      const h = make("planetary", "C4", "C7");
      cast(h, "C4");
      const hp = h.foes[0]!.hp;
      h.kit.absorb(100, "melee", h.foes[0]);
      expect(h.foes[0]!.hp).toBeLessThan(hp);
      expect(h.kit.shields[0]!.reflectMelee).toBe(0.2);
    },
    C8: () => {
      const h = make("planetary", "C1", "C8");
      const k = h.state.player.ki;
      cast(h, "C1");
      expect(h.state.player.ki).toBe(k - 12 + 15);
    },
    C9: () => {
      const h = make("planetary", "C9");
      cast(h, "C9");
      expect(h.state.heals).toBeCloseTo(h.kit.stats.maxHp * 0.4);
      expect(h.kit.shieldPoints).toBeCloseTo(h.kit.stats.maxHp * 0.2);
      expect(h.kit.shields[0]!.ms).toBe(6000);
    },
    T: () =>
      buffs(make("planetary", "T", "A9"), "T", {
        ms: 20000,
        atkPct: 0.2,
        defPct: 0.15,
        speedPct: 0.1,
      }),
  },
  sage: {
    R: () => {
      const h = make("sage");
      expect(hit(h)).toBe(h.kit.stats.attack);
    },
    A1: () => {
      const h = make("sage", "A1");
      const s = vi.spyOn(h.port, "sealFoe");
      cast(h, "A1");
      expect(s).toHaveBeenCalledWith(h.foes[0], 3000, 0);
      h.step(2950);
      expect(h.state.hits).toHaveLength(0);
      h.step(50);
      expect(raw(h)).toBe(h.kit.stats.attack * 2);
    },
    A2: () => {
      const h = make("sage", "A1", "A2");
      const s = vi.spyOn(h.port, "sealFoe");
      cast(h, "A1");
      expect(s).toHaveBeenCalledWith(h.foes[0], 3000, 0.1);
    },
    A3: () => {
      const h = make("sage", "A1", "A3");
      cast(h, "A1");
      expect(h.kit.cooldowns["A1"]).toBe(6400);
    },
    A4: () => {
      const h = make("sage", "A4");
      cast(h, "A4");
      h.step(3000);
      expect(h.state.hits).toHaveLength(6);
      expect(h.state.hits.reduce((s, x) => s + x.raw, 0)).toBeCloseTo(h.kit.stats.attack * 2.4);
    },
    A5: () => {
      const h = make("sage", "A1", "A5");
      cast(h, "A1");
      h.step(3000);
      expect(h.state.hits).toHaveLength(2);
      expect(raw(h)).toBe(h.kit.stats.attack);
    },
    A6: () => crit("sage", "A6", 8),
    A7: () => {
      const h = make("sage", "A1", "A7");
      cast(h, "A1");
      h.step(3000);
      expect(h.kit.circles[0]).toMatchObject({ radius: 120, ms: 3000, dps: 0.4 });
    },
    A8: () => {
      const h = make("sage", "A1", "A8");
      const k = h.state.player.ki;
      cast(h, "A1");
      h.step(3000);
      expect(h.state.player.ki).toBe(k - 12 + 15);
    },
    A9: () => {
      const h = make("sage", "A9");
      cast(h, "A9");
      h.step(1450);
      expect(h.state.hits).toHaveLength(0);
      h.step(50);
      expect(raw(h)).toBeCloseTo(h.kit.stats.attack * 4.2);
    },
    B1: () => shield(make("sage", "B1"), "B1", 0.15, 4000),
    B2: () => {
      const h = make("sage", "B1", "B2");
      cast(h, "B1");
      expect(h.kit.circles[0]).toMatchObject({ ms: 5000, defPct: 0.1 });
    },
    B3: () => shield(make("sage", "B1", "B3"), "B1", 0.15, 6000),
    B4: () => {
      const h = make("sage", "B4");
      cast(h, "B4");
      h.step(50);
      expect(h.foes[0]!.slowed).toBe(0.4);
      expect(h.kit.circles[0]).toMatchObject({ radius: 140, ms: 4950 });
    },
    B5: () => {
      const h = make("sage", "B1", "B5");
      cast(h, "B1");
      expect(h.kit.shields[0]!.reflectProjectile).toBe(0.15);
    },
    B6: () => {
      const h = make("sage", "B4", "B6");
      cast(h, "B4");
      h.step(50);
      expect(h.foes[0]!.weak).toBe(0.1);
    },
    B7: () => shield(make("sage", "B1", "B7"), "B1", 0.15 * 1.3, 4000),
    B8: () => {
      const h = make("sage", "B1", "B8");
      cast(h, "B1");
      const hp = h.foes[0]!.hp;
      expect(h.kit.absorb(40, "melee", h.foes[0])).toBe(0);
      expect(hp - h.foes[0]!.hp).toBe(40);
      expect(h.kit.shields[0]!.mirror).toBe(false);
    },
    B9: () => {
      const h = make("sage", "B9");
      cast(h, "B9");
      expect(h.kit.circles[0]).toMatchObject({ radius: 220, ms: 8000, slow: 0.3, defPct: 0.3 });
    },
    C1: () => {
      const h = make("sage", "C1");
      h.state.player.ki = 0;
      cast(h, "C1");
      h.step(3000);
      expect(h.state.player.ki).toBeCloseTo(h.kit.stats.maxKi * 0.3);
    },
    C2: () => stat("sage", "C2", "maxKi", 1.15),
    C3: () => {
      const h = make("sage", "B1", "C3");
      const k = h.state.player.ki;
      cast(h, "B1");
      expect(h.state.player.ki).toBe(k - 11);
    },
    C4: () => {
      const h = make("sage", "C4");
      cast(h, "C4");
      h.step(3000);
      expect(h.state.heals).toBeCloseTo(h.kit.stats.maxHp * 0.2);
    },
    C5: () => stat("sage", "C5", "ccMul", 0.75),
    C6: () => {
      const h = make("sage", "C1", "C6", "A4");
      cast(h, "C1");
      h.step(3000);
      cast(h, "A4");
      h.step(500);
      expect(raw(h)).toBeCloseTo(h.kit.stats.attack * 0.4 * 1.25);
      expect(h.kit.buff("C6")).toBeUndefined();
    },
    C7: () => {
      const h = make("sage", "C4", "C7");
      cast(h, "C4");
      h.step(3000);
      expect(h.state.heals).toBeCloseTo(h.kit.stats.maxHp * 0.3);
    },
    C8: () => {
      const h = make("sage", "C1", "C8");
      cast(h, "C1");
      h.step(50, true);
      expect(h.kit.channel).toBeDefined();
      h.kit.absorb(1, "melee");
      expect(h.kit.channel).toBeUndefined();
    },
    C9: () => buffs(make("sage", "C9"), "C9", { ms: 8000, noKi: true, dealtPct: 0.3 }),
    T: () =>
      buffs(make("sage", "T", "A9"), "T", {
        ms: 20000,
        atkPct: 0.25,
        defPct: 0.15,
        cooldownPct: -0.3,
      }),
  },
  android: {
    R: () => {
      const h = make("android");
      expect(hit(h)).toBe(h.kit.stats.attack);
      expect(h.kit.resource()!.value).toBe(4);
    },
    A1: () => {
      const h = make("android", "A1");
      const spy = vi.spyOn(h.port, "markFoe");
      cast(h, "A1");
      expect(spy).toHaveBeenCalledWith(h.foes[0], 6000, 15, 0);
    },
    A2: () => crit("android", "A2", 6),
    A3: () => stat("android", "A3", "range", 1.15),
    A4: () => {
      const h = make("android", "A4");
      h.foes[0]!.marked = true;
      cast(h, "A4");
      h.step(350);
      expect(h.state.hits).toHaveLength(3);
      expect(h.state.hits.reduce((s, x) => s + x.raw, 0)).toBeCloseTo(h.kit.stats.attack * 2.2);
    },
    A5: () => {
      const h = make("android", "A1", "A5");
      const spy = vi.spyOn(h.port, "markFoe");
      cast(h, "A1");
      expect(spy).toHaveBeenCalledWith(h.foes[0], 6000, 15, 0.1);
    },
    A6: () => stat("android", "A6", "attackInterval", 0.92),
    A7: () => {
      const h = make("android", "A7");
      h.foes[0]!.marked = true;
      expect(hit(h)).toBeCloseTo(h.kit.stats.attack * 1.4);
      expect(h.kit.stats.attackInterval).toBeCloseTo(770);
    },
    A8: () => {
      const h = make("android", "A8");
      hit(h);
      expect(h.state.hits).toHaveLength(2);
      expect(raw(h)).toBeCloseTo(h.kit.stats.attack * 0.4);
    },
    A9: () => {
      const h = make("android", "A9");
      h.foes[0]!.marked = true;
      h.foes[0]!.hp = 1e7;
      cast(h, "A9");
      expect(raw(h)).toBe(h.kit.stats.attack * 6);
    },
    B1: () => shield(make("android", "B1"), "B1", 0.18, 5000),
    B2: () => stat("android", "B2", "defense", 1.08),
    B3: () => shield(make("android", "B1", "B3"), "B1", 0.18 * 1.25, 5000),
    B4: () => {
      const h = make("android", "B4");
      area(h, "B4", 1.2, 160);
      expect(h.foes[0]!.stunned).toBe(500);
    },
    B5: () => {
      const h = make("android", "B1", "B5");
      cast(h, "B1");
      expect(h.kit.shields[0]!.reflectProjectile).toBe(0.25);
    },
    B6: () => expect(make("android", "B6").kit.hpRegen()).toBe(0.005),
    B7: () => {
      const h = make("android", "B1", "B7");
      cast(h, "B1");
      expect(h.kit.shields[0]!.reflectMelee).toBe(0.3);
    },
    B8: () => {
      const h = make("android", "B1", "B8");
      cast(h, "B1");
      expect(h.kit.cooldowns["B1"]).toBe(6500);
    },
    B9: () => buffs(make("android", "B9"), "B9", { ms: 6000, defPct: 0.6, ccImmune: true }),
    C1: () => {
      const h = make("android", "C1");
      cast(h, "C1");
      expect(raw(h)).toBe(h.kit.stats.attack);
    },
    C2: () => {
      const h = make("android", "C2");
      const kit = h.kit as typeof h.kit & { charge: number; overheatMs: number };
      kit.charge = 99;
      hit(h);
      expect(kit.overheatMs).toBe(1000);
      h.step(1000);
      expect(kit.overheatMs).toBe(0);
    },
    C3: () => {
      const h = make("android", "C3");
      hit(h);
      expect((h.kit as typeof h.kit & { charge: number }).charge).toBeCloseTo(3.4);
    },
    C4: () => {
      const h = make("android", "C4");
      cast(h, "C4");
      expect(h.state.heals).toBeCloseTo(h.kit.stats.maxHp * 0.1);
      expect(h.kit.resource()!.value).toBe(0);
    },
    C5: () => stat("android", "C5", "maxKi", 1.12),
    C6: () => {
      const h = make("android", "C1", "C6");
      const k = h.state.player.ki;
      cast(h, "C1");
      expect(h.state.player.ki).toBe(k - 12);
    },
    C7: () => {
      const h = make("android", "C1", "C7");
      (h.kit as typeof h.kit & { charge: number }).charge = 150;
      cast(h, "C1");
      expect(raw(h)).toBe(h.kit.stats.attack * 4);
      expect(h.kit.resource()!.max).toBe(150);
    },
    C8: () => {
      const h = make("android", "C8");
      (h.kit as typeof h.kit & { charge: number }).charge = 69;
      hit(h);
      expect(h.kit.resource()).toMatchObject({ max: 70, state: "full" });
    },
    C9: () => {
      const h = make("android", "C9");
      cast(h, "C9");
      expect(h.kit.buff("C9")).toMatchObject({ ms: 6000, dealtPct: 0.4, noKi: true });
      h.step(6000);
      expect(h.kit.lockMs).toBe(2000);
      h.step(2000);
      expect(h.kit.lockMs).toBe(0);
    },
    T: () => buffs(make("android", "T", "A9"), "T", { ms: 20000, atkPct: 0.25, defPct: 0.15 }),
  },
  legend: {
    R: () => {
      const h = make("legend");
      hit(h);
      expect(h.kit.resource()!.value).toBe(4);
    },
    A1: () => {
      const h = make("legend", "A1");
      cast(h, "A1");
      h.step(350);
      expect(h.state.hits).toHaveLength(3);
      expect(h.state.hits[0]!.raw).toBeCloseTo(h.kit.stats.attack * 0.6);
    },
    A2: () => {
      const h = make("legend", "A1", "A2");
      cast(h, "A1");
      h.step(350);
      expect(h.foes[0]!.burn).toBeCloseTo(h.kit.stats.attack * 0.3);
    },
    A3: () => {
      const h = make("legend", "A3");
      for (let i = 0; i < 3; i++) {
        hit(h);
        h.step(750);
      }
      expect(h.kit.buff("A3")).toMatchObject({ intervalPct: -0.1 });
    },
    A4: () => {
      const h = make("legend", "A4");
      cast(h, "A4");
      expect(raw(h)).toBeCloseTo(h.kit.stats.attack * 2.2);
    },
    A5: () => stat("legend", "A5", "attack", 1.08),
    A6: () => crit("legend", "A6", 6),
    A7: () => {
      const h = make("legend", "A1", "A7");
      cast(h, "A1");
      h.step(650);
      expect(h.state.hits).toHaveLength(5);
      expect(h.state.hits[0]!.raw).toBeCloseTo((h.kit.stats.attack * 2.6) / 5);
    },
    A8: () => {
      const h = make("legend", "A8");
      h.foes.splice(1);
      expect(hit(h)).toBeCloseTo(h.kit.stats.attack * 1.25);
    },
    A9: () => {
      const h = make("legend", "A9");
      cast(h, "A9");
      h.step(900);
      expect(h.state.hits).toHaveLength(8);
      expect(h.state.hits[0]!.raw).toBeCloseTo((h.kit.stats.attack * 4.2) / 8);
    },
    B1: () => {
      const h = make("legend", "B1");
      const spy = vi.spyOn(h.port, "breakFoeShield");
      cast(h, "B1");
      expect(raw(h)).toBe(h.kit.stats.attack * 1.5);
      expect(h.foes[0]!.stunned).toBe(1200);
      expect(spy).toHaveBeenCalledWith(h.foes[0]);
    },
    B2: () => stat("legend", "B2", "defense", 1.08),
    B3: () => stat("legend", "B3", "maxHp", 1.1),
    B4: () => buffs(make("legend", "B4"), "B4", { ms: 8000, atkPct: 0.3, defPct: -0.2 }),
    B5: () => buffs(make("legend", "B4", "B5"), "B4", { stunImmune: true }),
    B6: () => {
      const h = make("legend", "B6");
      h.kit.onKill(h.foes[0]!);
      expect(h.state.heals).toBeCloseTo(h.kit.stats.maxHp * 0.03);
    },
    B7: () => buffs(make("legend", "B4", "B7"), "B4", { ms: 12000, atkPct: 0.4 }),
    B8: () => buffs(make("legend", "B4", "B8"), "B4", { defPct: 0 }),
    B9: () => {
      const h = make("legend", "B9");
      cast(h, "B9");
      expect(h.kit.saveFromDeath()).toBe(true);
      expect(h.kit.saveFromDeath()).toBe(false);
      expect(h.state.heals).toBeCloseTo(h.kit.stats.maxHp * 0.3);
    },
    C1: () => area(make("legend", "C1"), "C1", 1.8, 150),
    C2: () => {
      const h = make("legend", "C2");
      hit(h);
      expect(h.kit.resource()!.value).toBe(6);
      h.state.inCombat = false;
      h.step(1000);
      expect(h.kit.resource()!.value).toBe(4);
    },
    C3: () => {
      const h = make("legend", "C1", "C3");
      cast(h, "C1");
      expect(h.foes[0]!.burn).toBeCloseTo(h.kit.stats.attack * 0.4);
    },
    C4: () => {
      const h = make("legend", "C4");
      (h.kit as typeof h.kit & { ember: number }).ember = 100;
      area(h, "C4", 3.3, 160);
      expect(h.kit.resource()!.value).toBe(0);
    },
    C5: () => {
      const h = make("legend", "C5");
      h.step(50);
      expect(h.kit.resource()!.value).toBe(20);
    },
    C6: () => {
      const h = make("legend", "C6");
      (h.kit as typeof h.kit & { ember: number }).ember = 100;
      expect(h.kit.stats.kiRegen).toBeCloseTo(make("legend").kit.stats.kiRegen * 1.5);
    },
    C7: () => {
      const h = make("legend", "C4", "C7");
      const spy = vi.spyOn(h.port, "foesIn");
      cast(h, "C4");
      expect(spy).toHaveBeenCalledWith(expect.anything(), 240);
    },
    C8: () => {
      const h = make("legend", "C4", "C8");
      const spy = vi.spyOn(h.port, "foesIn");
      cast(h, "C4");
      expect(spy).toHaveBeenCalledWith(expect.anything(), 128);
      expect(h.state.hits[0]!.raw).toBeCloseTo(h.kit.stats.attack * 1.25);
    },
    C9: () => {
      const h = make("legend", "C9");
      cast(h, "C9");
      expect(h.state.hits[0]!.raw).toBeCloseTo(h.kit.stats.attack * 4.5);
      expect(h.foes[0]!.burn).toBeCloseTo(h.kit.stats.attack * 0.5);
    },
    T: () => {
      const h = make("legend", "T", "A9");
      buffs(h, "T", { ms: 20000, atkPct: 0.3 });
      expect(h.kit.resource()!.value).toBe(100);
    },
  },
};
for (const race of RACE_IDS)
  describe(`${race}: node runtime contracts`, () => {
    for (const node of KIT_NODES[race])
      it(`${node.id}: ${node.name}`, () => {
        expect(effects[race][node.id], "missing behavioural contract").toBeTypeOf("function");
        if (node.excludes) expect(canLearn(race, 20, ["R", node.excludes], node.id).ok).toBe(false);
        effects[race][node.id]!();
      });
  });

for (const race of RACE_IDS)
  describe(`${race}: active costs and learning gates`, () => {
    for (const node of KIT_NODES[race])
      it(`${node.id}: owner KI/cooldown, level and prerequisites`, () => {
        const learned: string[] = [];
        const ancestors = (id: string) => {
          const n = KIT_NODES[race].find((n) => n.id === id)!;
          if (n.requires[0]) ancestors(n.requires[0]);
          if (!learned.includes(id)) learned.push(id);
        };
        if (node.requires[0]) ancestors(node.requires[0]);
        expect(canLearn(race, 20, learned, node.id).ok).toBe(true);
        if (node.minLevel > 1)
          expect(canLearn(race, node.minLevel - 1, learned, node.id).ok).toBe(false);
        if (node.requires.length) expect(canLearn(race, 20, [], node.id).ok).toBe(false);
        const h = make(race, node.id, ...(node.id === "T" ? ["A9"] : []));
        const cost = node.text.match(/(?:;\s*|^)(\d+)\s*Ki/i),
          cd = node.text.match(/odn\.\s*(\d+)\s*s/i);
        if (!h.kit.defs[node.id]) return;
        if (cost) expect(h.kit.defs[node.id]!.ki).toBe(Number(cost[1]));
        if (cd) expect(h.kit.defs[node.id]!.cd).toBe(Number(cd[1]) * 1000);
        h.foes[0]!.marked = true;
        const ki = h.state.player.ki;
        cast(h, node.id);
        expect(h.state.player.ki).toBe(ki - h.kit.defs[node.id]!.ki);
        const remaining = h.kit.cooldowns[node.id];
        expect(remaining).toBe(h.kit.defs[node.id]!.cd);
        expect(h.kit.use(node.id).ok).toBe(false);
        expect(h.state.player.ki).toBe(ki - h.kit.defs[node.id]!.ki);
      });
    it("KI form cannot bypass the level/ultimate requirement", () => {
      const h = harness(race, 19, ["R", "T", "A9"]);
      expect(h.kit.use("T").ok).toBe(false);
      expect(make(race, "T").kit.use("T").ok).toBe(false);
    });
  });
it("missed Legend hit does not award ember or a combo bonus", () => {
  const h = make("legend", "A3");
  h.port.hurtFoe = () => 0;
  for (let i = 0; i < 3; i++) {
    cast(h, "R");
    h.step(750);
  }
  expect(h.kit.resource()!.value).toBe(0);
  expect(h.kit.buff("A3")).toBeUndefined();
});
it("Sage B2 leaves its circle for support/channel skills as well as attacks", () => {
  for (const id of ["C1", "C4", "C9", "T"]) {
    const h = make("sage", id, "B2", "A9");
    cast(h, id);
    expect(h.kit.circles.some((c) => c.id === "B2" && c.defPct === 0.1 && c.ms === 5000)).toBe(
      true,
    );
  }
});
it("Sage C6 is captured on seal cast, even when its six-second buff expires before detonation", () => {
  const h = make("sage", "C1", "C6", "A1");
  cast(h, "C1");
  h.step(3000);
  h.step(5500);
  cast(h, "A1");
  expect(h.kit.buff("C6")).toBeUndefined();
  h.step(3000);
  expect(raw(h)).toBeCloseTo(h.kit.stats.attack * 2 * 1.25);
});
