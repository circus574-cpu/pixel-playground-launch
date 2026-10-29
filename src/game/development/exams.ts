import { GameSession } from "../session";
import { Navigation, distance, type Point } from "../navigation";
import { WORLDS } from "../world/worlds";
import { RACES, type RaceId } from "../world/races";
import { type Discipline } from "./training";

export type ExamResult = {
  outcome: "running" | "passed" | "failed" | "abandoned";
  successes: number;
  errors: number;
  activeMs: number;
  reason: string;
};
export type ExamSpec = {
  discipline: Discipline;
  tier: number;
  target: number;
  limitMs: number;
  windowMs: number;
  maxErrors: number;
  kiBudget: number;
};
export function examSpec(discipline: Discipline, tier: number): ExamSpec {
  if (!Number.isInteger(tier) || tier < 1 || tier > 6) throw Error("Invalid exam tier");
  const i = tier - 1;
  const target =
    discipline === "endurance"
      ? [4, 5, 6, 7, 8, 9][i]!
      : discipline === "kiCapacity"
        ? [2, 3, 4, 5, 6, 7][i]!
        : discipline === "defense"
          ? [4, 5, 6, 7, 8, 10][i]!
          : [3, 4, 5, 6, 7, 8][i]!;
  return {
    discipline,
    tier,
    target,
    limitMs: [180, 210, 240, 270, 300, 330][i]! * 1000,
    windowMs:
      discipline === "defense"
        ? [1800, 1650, 1500, 1400, 1300, 1200][i]!
        : [1600, 1450, 1300, 1150, 1000, 900][i]!,
    maxErrors: discipline === "strength" ? 3 : 2,
    kiBudget: [70, 70, 65, 65, 60, 60][i]! / 100,
  };
}
export function examInstructions(spec: ExamSpec): string {
  switch (spec.discipline) {
    case "strength":
      return `Traf manekin w ${spec.target} osobnych zielonych oknach (${spec.windowMs} ms). Atakuj zwykłym atakiem; najwyżej 3 trafienia poza oknem. Kilka ciosów w jednym oknie daje tylko jeden punkt.`;
    case "endurance":
      return `Przejdź ${spec.target} kolejnych zielonych punktów omijając przeszkody. Limit ${spec.limitMs / 1000} s. Zakończ z co najmniej 30% HP.`;
    case "kiCapacity":
      return `Naładuj ${spec.target} oznaczonych węzłów w kolejności. Podejdź do zielonego kręgu i użyj „Naładuj węzeł”. Błękitne źródło odnawia testowe KI. Bez mikstur.`;
    case "defense":
      return `Uniknij lub osłoń ${spec.target} zapowiedzi. Przed uderzeniem masz ${spec.windowMs} ms, żeby opuścić czerwony krąg lub użyć poznanej osłony. Maksymalnie 2 trafienia. Ruch i osłony korzystają z normalnego silnika.`;
    case "kiControl":
      return `Wykonaj ${spec.target} celnych zwykłych ataków na manekin. Każdy udany atak zużywa część testowego budżetu ${Math.round(spec.kiBudget * 100)}% KI. Nietrafione lub przedwczesne naciśnięcia nie są sukcesem; powtórne trafienia tej samej serii nie dają dodatkowej nagrody.`;
  }
}
let attemptSequence = 0;

/** An in-memory loan profile using the production session and kit. It has no save port or rewards. */
export class ExamAttempt {
  readonly instanceId = "exam-attempt-" + ++attemptSequence;
  readonly session: GameSession;
  readonly spec: ExamSpec;
  readonly race: RaceId;
  private result: ExamResult = {
    outcome: "running",
    successes: 0,
    errors: 0,
    activeMs: 0,
    reason: "",
  };
  private lastNow = 0;
  private previousHits = 0;
  private previousCycle = -1;
  private lastScoredCycle = -1;
  private warnedCycle = -1;
  private danger: Point = { x: 0, y: 0 };
  private spentKi = 0;
  private initialKi: number;
  readonly points: Point[];
  constructor(
    race: RaceId,
    discipline: Discipline,
    tier: number,
    readonly rehearsal = false,
  ) {
    this.race = race;
    this.spec = examSpec(discipline, tier);
    const world = {
      ...WORLDS[RACES[race].world],
      settlement: "Sala egzaminacyjna",
      width: 960,
      height: 760,
      spawn: { x: 480, y: 550 },
      npcs: [],
      enemies: [],
      monsters: [],
      objects: [],
      landmarks: [],
      obstacles: [
        { x: 0, y: 0, width: 960, height: 55 },
        { x: 0, y: 0, width: 55, height: 760 },
        { x: 905, y: 0, width: 55, height: 760 },
        { x: 0, y: 705, width: 960, height: 55 },
        { x: 340, y: 190, width: 40, height: 260 },
        { x: 700, y: 360, width: 40, height: 210 },
      ],
      city: { name: "Sala egzaminacyjna", buildings: [], roads: [] },
      safeAreas: [],
    };
    delete world.terrain;
    this.session = new GameSession(undefined, race, {
      world,
      navigation: new Navigation(960, 760, world.obstacles),
      practiceOnly: true,
      random: () => 0.99,
    });
    const p = this.session.player;
    p.level = 20;
    // A legal, deliberately small profile. No copied gear, training, variant or racial resource.
    if (discipline === "defense") {
      const defenseNodes =
        race === "planetary" ? ["C1", "C2", "C4"] : race === "legend" ? [] : ["B1"];
      for (const node of defenseNodes) {
        p.skills.push(node);
        this.session.kit.learn(node);
      }
    }
    p.items.potion = 0;
    p.hp = this.session.kit.stats.maxHp;
    p.ki = this.session.kit.stats.maxKi;
    this.initialKi = p.ki;
    this.session.training.active = discipline === "strength" || discipline === "kiControl";
    this.points = [
      { x: 230, y: 550 },
      { x: 240, y: 170 },
      { x: 520, y: 130 },
      { x: 810, y: 250 },
      { x: 820, y: 620 },
      { x: 520, y: 620 },
      { x: 500, y: 340 },
      { x: 620, y: 180 },
      { x: 200, y: 350 },
    ].slice(0, this.spec.target);
    if (discipline === "strength" || discipline === "kiControl")
      Object.assign(p, { x: 600, y: 350 });
    this.session.say(examInstructions(this.spec));
  }
  snapshot(): ExamResult {
    return { ...this.result };
  }
  get currentPoint() {
    return this.points[this.result.successes];
  }
  get passed() {
    return this.result.outcome === "passed";
  }
  get windowOpen() {
    return this.result.activeMs % (this.spec.windowMs + 1400) >= 1400;
  }
  abandon() {
    if (this.result.outcome === "running")
      this.finish("abandoned", "Próba przerwana. Oryginalny stan postaci nie zmienił się.");
  }
  private finish(outcome: ExamResult["outcome"], reason: string) {
    this.result.outcome = outcome;
    this.result.reason = reason;
    this.session.paused = true;
  }
  chargeNode() {
    if (
      this.spec.discipline !== "kiCapacity" ||
      this.result.outcome !== "running" ||
      this.session.paused
    )
      return;
    const target = this.points[this.result.successes];
    if (
      !target ||
      distance(this.session.player, target) > 65 ||
      !this.session.nav.visible(this.session.player, target)
    )
      return this.session.say("Podejdź do kolejnego zielonego węzła.");
    const cost = this.initialKi * 0.6;
    if (this.session.player.ki < cost)
      return this.session.say("Za mało testowego KI. Podejdź do błękitnego źródła pośrodku sali.");
    this.session.player.ki -= cost;
    this.result.successes++;
    this.checkEnd();
  }
  private checkEnd() {
    if (this.result.errors > this.spec.maxErrors)
      return this.finish("failed", "Przekroczono dopuszczalną liczbę błędów.");
    if (this.session.player.hp < this.session.kit.stats.maxHp * 0.3)
      return this.finish("failed", "Życie spadło poniżej 30%.");
    if (this.result.successes >= this.spec.target)
      this.finish(
        "passed",
        this.rehearsal
          ? "Trening przygotowawczy wykonany. Bez nagrody i bez zmiany stopni."
          : "Wszystkie cele wykonane. Wynik oczekuje na bezpieczny zapis.",
      );
  }
  update() {
    const now = this.session.nowMs;
    const dt = now - this.lastNow;
    this.lastNow = now;
    if (this.result.outcome !== "running" || dt <= 0) return;
    this.result.activeMs += dt;
    if (this.result.activeMs > this.spec.limitMs)
      return this.finish("failed", "Upłynął aktywny czas egzaminu.");
    const p = this.session.player;
    const cycle = Math.floor(this.result.activeMs / (this.spec.windowMs + 1400));
    const newHits = this.session.training.hits - this.previousHits;
    this.previousHits = this.session.training.hits;
    if (this.spec.discipline === "strength" && newHits > 0) {
      if (!this.windowOpen) this.result.errors += newHits;
      else if (cycle !== this.lastScoredCycle) {
        this.result.successes++;
        this.lastScoredCycle = cycle;
      }
    }
    if (this.spec.discipline === "kiControl" && newHits > 0) {
      for (let i = 0; i < newHits && this.result.successes < this.spec.target; i++) {
        const cost = (this.initialKi * this.spec.kiBudget) / this.spec.target;
        this.spentKi += cost;
        this.result.successes++;
      }
      p.ki = Math.max(0, this.initialKi - this.spentKi);
    }
    if (this.spec.discipline === "endurance") {
      const point = this.points[this.result.successes];
      if (point && distance(p, point) <= 55) this.result.successes++;
    }
    if (this.spec.discipline === "kiCapacity") {
      // Regeneration exists only at the disclosed source, not while charging a remote node.
      const previousKi = this.initialKi - this.spentKi;
      if (distance(p, { x: 480, y: 370 }) <= 65) p.ki = this.initialKi;
      else p.ki = Math.min(p.ki, previousKi);
      this.spentKi = this.initialKi - p.ki;
    }
    if (this.spec.discipline === "defense") {
      const offset = this.result.activeMs % (this.spec.windowMs + 1400);
      if (cycle !== this.warnedCycle && offset >= 1400) {
        this.warnedCycle = cycle;
        this.danger = { x: p.x, y: p.y };
        this.session.emit({
          type: "telegraph",
          ...this.danger,
          radius: 110,
          ms: this.spec.windowMs,
        });
      }
      if (
        this.previousCycle >= 0 &&
        cycle !== this.previousCycle &&
        this.warnedCycle === cycle - 1
      ) {
        const inside = distance(p, this.danger) < 110;
        const damage = inside
          ? this.session.kit.absorb(this.session.kit.stats.maxHp * 0.1, "other")
          : 0;
        if (damage > 0) {
          p.hp = Math.max(0, p.hp - damage);
          this.result.errors++;
        } else this.result.successes++;
      }
    }
    this.previousCycle = cycle;
    this.checkEnd();
  }
}
