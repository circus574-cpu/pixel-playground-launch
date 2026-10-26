import {
  KIT_NODES,
  RACE_BASE,
  canLearn,
  createKit,
  freePoints,
  validLearned,
  type Foe,
  type Hit,
  type KitPort,
} from "../../game/kit";
import { RACE_IDS, type RaceId } from "../../game/world/races";

type TestFoe = Foe & {
  def: number;
  stunned: number;
  slowed: number;
  burn: number;
  sealed: boolean;
  marked: boolean;
  shield: boolean;
  weak: number;
};
export function foe(id: string, x: number, y: number, hp = 1000, def = 0): TestFoe {
  return {
    id,
    x,
    y,
    hp,
    maxHp: hp,
    def,
    stunned: 0,
    slowed: 0,
    burn: 0,
    sealed: false,
    marked: false,
    shield: true,
    weak: 0,
  };
}
export function harness(race: RaceId, level: number, learned: string[], foes: TestFoe[] = []) {
  const state = {
    now: 0,
    player: { x: 0, y: 0, level, hp: 1, ki: 1000 },
    heals: 0,
    inCombat: true,
    seq: 0.99,
    events: [] as string[],
    hits: [] as { foe: string; raw: number; hit: Hit }[],
    terrain: "open" as "open" | "forest" | "rock" | "water",
    target: undefined as TestFoe | undefined,
  };
  const port: KitPort = {
    get nowMs() {
      return state.now;
    },
    gear: { attack: 0, defense: 0 },
    get inCombat() {
      return state.inCombat;
    },
    terrain: () => state.terrain,
    player: state.player,
    facing: { x: 1, y: 0 },
    random: () => state.seq,
    say: () => {},
    foesIn: (c, r) => foes.filter((f) => f.hp > 0 && Math.hypot(f.x - c.x, f.y - c.y) <= r),
    target: () => state.target,
    visible: () => true,
    hurtFoe: (f, raw, hit) => {
      const t = f as TestFoe;
      const dealt = Math.max(1, raw - t.def / 2);
      t.hp = Math.max(0, t.hp - dealt);
      state.hits.push({ foe: f.id, raw, hit });
      return dealt;
    },
    stunFoe: (f, ms) => void ((f as TestFoe).stunned = Math.max((f as TestFoe).stunned, ms)),
    slowFoe: (f, pct) => void ((f as TestFoe).slowed = pct),
    burnFoe: (f, dps, ms) => void ((f as TestFoe).burn += dps * (ms / 1000)),
    sealFoe: (f) => void ((f as TestFoe).sealed = true),
    markFoe: (f) => void ((f as TestFoe).marked = true),
    pushFoe: () => {},
    weakenFoe: (f, pct) => void ((f as TestFoe).weak = pct),
    breakFoeShield: (f) => void ((f as TestFoe).shield = false),
    isSealed: (f) => (f as TestFoe).sealed,
    isMarked: (f) => (f as TestFoe).marked,
    foeHpFraction: (f) => f.hp / f.maxHp,
    dash: (to, d) => {
      const len = Math.hypot(to.x - state.player.x, to.y - state.player.y) || 1;
      const k = Math.min(1, d / len);
      state.player.x += (to.x - state.player.x) * k;
      state.player.y += (to.y - state.player.y) * k;
      return { x: state.player.x, y: state.player.y };
    },
    emit: (e) => void state.events.push(e.type + ":" + (e.ability ?? "")),
    heal: (n) => void (state.heals += n),
    addKi: (n) => void (state.player.ki += n),
  };
  const kit = createKit(race, port, learned);
  const step = (ms: number, moving = false) => {
    for (let t = 0; t < ms; t += 50) {
      state.now += 50;
      kit.tick(50, moving);
    }
  };
  return { kit, state, port, step, foes };
}
