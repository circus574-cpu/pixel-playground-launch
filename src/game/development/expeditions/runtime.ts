import type { GameSession, Player } from "../../session";
import { distance, type Point, type Navigation } from "../../navigation";
import type { Enemy } from "../../monsters/types";
import { COMBAT_BUDGET } from "../../combatBudget";
import { ProtectedActor } from "../heritage/protectedActor";
import { HeritageBindings, type HeritageHome, type HeritageTarget } from "../heritage/bindings";
import { combatGround } from "../heritage/encounter";
import { advanceExperience } from "../../experience";
import type { DevelopmentState } from "../state";
import {
  DEVELOPMENT_ENCOUNTERS,
  DEVELOPMENT_ENCOUNTER_BY_ID,
  EXPEDITIONS,
  EXPEDITION_BY_ID,
  type ExpeditionDefinition,
} from "./catalog";

export type ExpeditionCommand = {
  type: "expedition";
  action: "go" | "start" | "leave";
  id: string;
};
type Commit = (change: (d: DevelopmentState, p: Player) => void) => boolean;
type Attempt = {
  definition: ExpeditionDefinition;
  id: string;
  point: HeritageTarget;
  members: Enemy[];
  stage: number;
  actor: ProtectedActor | null;
  outcome: "running" | "failed" | "passed";
  reason: string;
  paid: Set<string>;
  pending: Enemy[];
  lastObservation: number;
  elapsed: number;
  lastNow: number;
};
export const EXPEDITION_RULES = {
  waves: 3,
  protectedHealth: 0.5,
  protectedHpMultiplier: 4,
  maxRange: 950,
  maxActiveMs: 600000,
  spawnRadius: 190,
} as const;
/** One bounded local expedition; it owns only its actors, never authored world spawn slots. */
export class ExpeditionRuntime {
  private readonly bindings: HeritageBindings;
  private active: Attempt | null = null;
  private readonly contacts = new Map<string, HeritageTarget | null>();
  constructor(
    private readonly s: GameSession,
    private readonly commit: Commit,
    readonly feature: string,
    home: HeritageHome,
    private readonly nav: Navigation,
  ) {
    this.bindings = new HeritageBindings(s.world, structuredClone(home), nav);
  }
  private contact(d: ExpeditionDefinition) {
    if (this.contacts.has(d.id)) return this.contacts.get(d.id)!;
    const offset =
      { single: 0, pair: 1, protection: 2 }[d.layout] + [22, 28, 34, 40].indexOf(d.level) * 3;
    const target = this.bindings.resolve(
      {
        id: d.id,
        kind: "inspect",
        site: "trail",
        label: d.name,
        documents: [],
        targets: [d.name],
        observations: [],
      },
      d.world,
    )[0];
    if (!target) {
      this.contacts.set(d.id, null);
      return null;
    }
    // A small authored encounter space near the existing trail, not a new biome or planet geometry.
    const origin = {
      x: target.point.x + (offset % 3) * 400 - 400,
      y: target.point.y + Math.floor(offset / 3) * 300 + 360,
    };
    let point: Point | undefined;
    for (let n = 0; n < 24; n++) {
      const p = this.nav.safe({
        x: origin.x + Math.cos((n * Math.PI) / 12) * 80,
        y: origin.y + Math.sin((n * Math.PI) / 12) * 80,
      });
      const path = this.nav.path(target.point, p);
      if (
        combatGround(this.s, p) &&
        path.length &&
        path.every((p) => combatGround(this.s, p)) &&
        distance(path.at(-1)!, p) < 20
      ) {
        point = p;
        break;
      }
    }
    const value = point ? { ...target, point, interior: null, label: d.name } : null;
    this.contacts.set(d.id, value);
    return value;
  }
  private available(d: ExpeditionDefinition) {
    const s = this.s;
    if (!s.saves || s.player.dead) return "Wyprawa wymaga aktywnej, żywej postaci z zapisem.";
    if (d.world !== this.feature || d.race !== s.player.race)
      return "Ta wyprawa należy do innej ścieżki kulturowej.";
    if (s.player.development?.heritage.quests[d.prerequisite]?.status !== "done")
      return `Najpierw zakończ rozdział ${d.level < 34 ? 4 : 5} swojego dziedzictwa.`;
    if (!this.contact(d)) return "W tym miejscu nie znaleziono osiągalnego terenu poza miastem.";
    return "";
  }
  private near(point: HeritageTarget | null) {
    const s = this.s;
    return (
      !!point &&
      !s.player.interior &&
      distance(s.player, point.point) <= 180 &&
      s.nav.visible(s.player, point.point)
    );
  }
  command(c: ExpeditionCommand) {
    const d = EXPEDITION_BY_ID.get(c.id);
    if (!d) return;
    if (c.action === "leave") {
      if (this.active?.definition.id === d.id) {
        if (this.active.pending.length && !this.flushKills())
          return this.s.say("Nie zapisano jeszcze pokonań. Ponów zapis przed wyjściem.");
        this.cancel();
      }
      return;
    }
    const point = this.contact(d);
    if (c.action === "go") {
      if (d.world === this.feature && point) this.s.heritage.goTo(point);
      return;
    }
    const locked = this.available(d);
    if (locked) return this.s.say(locked);
    if (this.s.combatIn > 0)
      return this.s.say("Zakończ bieżącą walkę przed rozpoczęciem nowej wyprawy.");
    if (!this.near(point)) return this.s.say("Podejdź do oznaczonego punktu wyprawy poza miastem.");
    if (this.active?.outcome === "running")
      return this.s.say("Najpierw zakończ lub opuść aktywną wyprawę.");
    if (this.active?.pending.length && !this.flushKills())
      return this.s.say("Najpierw ponów zapis pokonań poprzedniej wyprawy.");
    this.cancel();
    this.s.fieldwork.cancel();
    this.s.heritage.cancelActivities();
    const id = "development-expedition:" + crypto.randomUUID();
    const a: Attempt = {
      definition: d,
      id,
      point: point!,
      members: [],
      stage: 0,
      actor: null,
      outcome: "running",
      reason: "",
      paid: new Set(),
      pending: [],
      lastObservation: -1000,
      elapsed: 0,
      lastNow: this.s.nowMs,
    };
    this.active = a;
    if (d.layout === "protection") {
      const heavy = DEVELOPMENT_ENCOUNTERS.find(
        (v) => v.race === d.race && v.level === d.level && v.role === "heavy",
      )!;
      a.actor = new ProtectedActor(
        this.s,
        "Chroniony punkt wyprawy",
        point!.point,
        heavy.hp * EXPEDITION_RULES.protectedHpMultiplier,
        heavy.def,
        false,
      );
    }
    try {
      this.spawnWave(a);
    } catch (e) {
      this.fail(e instanceof Error ? e.message : "Brak miejsca na wyprawę.");
    }
    this.s.say(
      "Wyprawa rozpoczęta. Rzeczywiste pokonania dają zwykły XP; brak dodatkowej praktyki, skrzyń i farmienia nagrody celu. Powtórka po porażce jest dozwolona.",
    );
  }
  private spawnWave(a: Attempt) {
    this.clearWave(a);
    const defs = DEVELOPMENT_ENCOUNTERS.filter(
      (v) => v.race === a.definition.race && v.level === a.definition.level,
    );
    const heavy = defs.find((v) => v.role === "heavy")!,
      other = defs.find((v) => v.role !== "heavy")!;
    const lineup =
      a.definition.layout === "single"
        ? [heavy]
        : a.definition.layout === "pair"
          ? [heavy, other]
          : a.stage === 0
            ? [other]
            : a.stage === 1
              ? [heavy]
              : [heavy, other];
    if (this.s.enemies.length + lineup.length > COMBAT_BUDGET.activeEnemies)
      throw Error("Brak budżetu aktywnych przeciwników. Zakończ inne spotkanie.");
    const selected: Point[] = [];
    for (const [index, variant] of lineup.entries()) {
      let at: Point | undefined;
      for (let n = 0; n < 24; n++) {
        const angle = ((n + index * 12) * Math.PI) / 12;
        const p = this.nav.safe({
          x: a.point.point.x + Math.cos(angle) * EXPEDITION_RULES.spawnRadius,
          y: a.point.point.y + Math.sin(angle) * EXPEDITION_RULES.spawnRadius,
        });
        const path = this.nav.path(p, a.point.point);
        if (
          combatGround(this.s, p) &&
          this.nav.visible(p, a.point.point) &&
          distance(p, a.point.point) > 100 &&
          distance(p, a.point.point) < 260 &&
          path.length &&
          path.every((p) => combatGround(this.s, p)) &&
          selected.every((t) => distance(t, p) > 110)
        ) {
          at = p;
          break;
        }
      }
      if (!at) throw Error("Brak bezpiecznego miejsca dla grupy wyprawy.");
      selected.push(at);
      const enemy = this.s.monsters.spawnDevelopment(variant.id, at, `${a.id}:${a.stage}:${index}`);
      enemy.encounterOwner = a.id;
      if (a.actor && !this.s.monsters.setCombatTarget(enemy, a.actor.id))
        throw Error("Nie można przypisać chronionego celu.");
      a.members.push(enemy);
    }
  }
  killed(enemy: Enemy) {
    const a = this.active;
    if (
      !a ||
      a.outcome !== "running" ||
      !a.members.includes(enemy) ||
      enemy.hp > 0 ||
      enemy.mode !== "dead" ||
      !DEVELOPMENT_ENCOUNTER_BY_ID.has(enemy.developmentVariant ?? "")
    )
      return false;
    if (!a.paid.has(enemy.id) && !a.pending.includes(enemy)) a.pending.push(enemy);
    return this.flushKills();
  }
  private flushKills() {
    const a = this.active;
    if (!a || !a.pending.length) return true;
    const pending = [...a.pending],
      previous = this.s.player.level;
    if (
      !this.commit((d, p) => {
        for (const enemy of pending) {
          const v = DEVELOPMENT_ENCOUNTER_BY_ID.get(enemy.developmentVariant!)!;
          d.encounterKnowledge[v.id] = "defeated";
          advanceExperience(p, v.xp);
        }
      })
    )
      return false;
    for (const enemy of pending) a.paid.add(enemy.id);
    a.pending = a.pending.filter((e) => !a.paid.has(e.id));
    if (this.s.player.level > previous)
      this.s.emit({ type: "level", ...this.s.player, text: "Poziom " + this.s.player.level });
    this.s.say(
      "Zapisano pokonanie wariantu: +" +
        pending.reduce(
          (n, e) => n + DEVELOPMENT_ENCOUNTER_BY_ID.get(e.developmentVariant!)!.xp,
          0,
        ) +
        " XP. Bez dodatkowej nagrody za gatunek.",
    );
    return true;
  }
  interrupt(reason: string) {
    if (this.active?.outcome === "running") {
      this.flushKills();
      this.fail(reason);
    }
  }
  private fail(reason: string) {
    const a = this.active;
    if (!a) return;
    a.outcome = "failed";
    a.reason = reason;
    this.clearWave(a);
    a.actor?.dispose();
    a.actor = null;
    this.s.say(reason + " Możesz rozpocząć wyprawę ponownie; zapisane odkrycia pozostają.");
  }
  tick() {
    const a = this.active,
      s = this.s;
    if (!a || s.paused) return;
    if (a.outcome !== "running") {
      this.flushKills();
      return;
    }
    const dt = Math.max(0, s.nowMs - a.lastNow);
    a.lastNow = s.nowMs;
    a.elapsed += dt;
    if (
      s.player.dead ||
      s.player.interior ||
      a.elapsed > EXPEDITION_RULES.maxActiveMs ||
      distance(s.player, a.point.point) > EXPEDITION_RULES.maxRange
    ) {
      this.fail("Wyprawę przerwano przez śmierć, odejście lub limit 10 aktywnych minut.");
      return;
    }
    a.actor?.tick(dt);
    if (
      a.actor &&
      (!a.actor.valid() || a.actor.body.hp / a.actor.maxHp < EXPEDITION_RULES.protectedHealth)
    ) {
      this.fail("Chroniony punkt utracił wymagane 50% HP.");
      return;
    }
    if (!this.flushKills()) return;
    if (s.nowMs - a.lastObservation >= 500) {
      a.lastObservation = s.nowMs;
      const seen = a.members.filter(
        (e) =>
          e.hp > 0 &&
          !e.m.hidden &&
          distance(e, s.player) <= 650 &&
          s.nav.visible(s.player, e) &&
          !s.player.development?.encounterKnowledge[e.developmentVariant!],
      );
      if (seen.length)
        this.commit((d) => {
          for (const enemy of seen) d.encounterKnowledge[enemy.developmentVariant!] = "seen";
        });
    }
    const remaining = s.enemies.some(
      (e) => e.encounterOwner === a.id && e.mode !== "dead" && e.hp > 0,
    );
    if (!a.members.length || remaining || a.members.some((e) => e.hp > 0 || e.mode !== "dead"))
      return;
    if (a.definition.layout === "protection" && a.stage + 1 < EXPEDITION_RULES.waves) {
      a.stage++;
      try {
        this.spawnWave(a);
      } catch (e) {
        this.fail(e instanceof Error ? e.message : "Nie można rozpocząć następnej fali.");
      }
      return;
    }
    if (!this.near(a.point)) return;
    if (
      !this.commit((d) => {
        d.completedExpeditions[a.definition.id] = true;
      })
    )
      return;
    a.outcome = "passed";
    a.reason =
      "Wyprawa ukończona. Odkrycia i rzeczywiste pokonania zapisano; cel nie wypłaca dodatkowej nagrody.";
    this.clearWave(a);
    a.actor?.dispose();
    a.actor = null;
    s.say(a.reason);
  }
  private clearWave(a: Attempt) {
    const ids = new Set(this.s.enemies.filter((e) => e.encounterOwner === a.id).map((e) => e.id));
    this.s.monsters.forget(ids);
    this.s.enemies.splice(
      0,
      this.s.enemies.length,
      ...this.s.enemies.filter((e) => !ids.has(e.id)),
    );
    if (this.s.targetId && ids.has(this.s.targetId)) {
      this.s.targetId = null;
      this.s.autoAttack = false;
    }
    a.members = [];
  }
  cancel() {
    const a = this.active;
    if (a) {
      this.clearWave(a);
      a.actor?.dispose();
    }
    this.active = null;
  }
  markers() {
    return EXPEDITIONS.filter(
      (d) => d.race === this.s.player.race && d.world === this.feature && !this.available(d),
    )
      .map((d) => this.contact(d)!)
      .filter((p) => !!p && !this.s.player.interior);
  }
  snapshot() {
    const a = this.active;
    return {
      active: a
        ? {
            id: a.definition.id,
            phase: a.outcome,
            reason: a.reason,
            point: a.point.point,
            stage: a.stage + 1,
            waves: a.definition.layout === "protection" ? EXPEDITION_RULES.waves : 1,
            protected: a.actor ? { ...a.actor.body, maxHp: a.actor.maxHp } : null,
            pendingSaves: a.pending.length,
          }
        : null,
      entries: EXPEDITIONS.filter((d) => d.race === this.s.player.race).map((d) => ({
        id: d.id,
        name: d.name,
        level: d.level,
        layout: d.layout,
        locked: this.available(d),
        target: this.contact(d),
        near: this.near(this.contact(d)),
        done: !!this.s.player.development?.completedExpeditions[d.id],
      })),
      knowledge: Object.entries(this.s.player.development?.encounterKnowledge ?? {}).map(
        ([id, stage]) => ({ id, stage, name: DEVELOPMENT_ENCOUNTER_BY_ID.get(id)!.name }),
      ),
    };
  }
}
