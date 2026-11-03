import { loanSession } from "../loan";
import type { GameSession } from "../../session";
import { distance, type Point } from "../../navigation";
import type { ExamResult } from "../exams";
import type { PracticeTarget } from "../targets";
import { RestraintActivity } from "../heritage/restraint";
import { trialDefinition, type TrialId, type TrialTier } from "./catalog";
import { publicPuzzle, trialPuzzles, moduleSolutionValid } from "./puzzles";
import type { ModuleId } from "../state";

export class TrialAttempt {
  authoritative = false;
  readonly instanceId = "racial-trial:" + crypto.randomUUID();
  readonly session: GameSession;
  readonly definition;
  readonly race;
  private result: ExamResult = {
    outcome: "running",
    successes: 0,
    errors: 0,
    activeMs: 0,
    reason: "",
  };
  private previousNow = 0;
  private reading = false;
  private ready = false;
  private suspended = false;
  private round = 0;
  private dodges = 0;
  private phase = "read";
  private until = 0;
  private danger: Point = { x: 0, y: 0 };
  private target: PracticeTarget | undefined;
  private restraint: RestraintActivity | undefined;
  private puzzles;
  readonly targetCount;
  readonly points = [
    { x: 230, y: 550 },
    { x: 240, y: 170 },
    { x: 520, y: 130 },
    { x: 810, y: 250 },
    { x: 820, y: 620 },
  ];
  constructor(
    readonly trialId: TrialId,
    readonly tier: TrialTier,
  ) {
    const definition = trialDefinition(trialId);
    if (!definition || ![1, 2, 3].includes(tier)) throw Error("Nieznana próba lub stopień.");
    this.definition = definition;
    this.race = definition.race;
    this.targetCount = definition.targets[tier - 1]!;
    this.session = loanSession(this.race);
    const p = this.session.player;
    p.level = 20;
    p.items.potion = 0;
    p.hp = this.session.kit.stats.maxHp;
    p.ki = this.session.kit.stats.maxKi;
    const physical = ["counter", "earth-rhythm", "restraint", "position"].includes(definition.kind);
    this.puzzles = physical ? [] : trialPuzzles(definition, tier);
    if (physical) {
      Object.assign(p, { x: 600, y: 350 });
      if (definition.kind === "restraint") {
        this.restraint = new RestraintActivity(
          this.session,
          {
            id: `${trialId}:${tier}`,
            kind: "restraint",
            label: definition.name,
            site: "trainer",
            documents: [],
            windows: this.targetCount,
            maxErrors: 0,
            surrender: true,
          },
          this.instanceId,
          { x: 600, y: 315 },
        );
      } else {
        this.target = this.session.practiceTargets.add(
          this.instanceId,
          "Bezpieczny cel pojedynku",
          { x: 600, y: 315 },
          null,
          0,
          (contact) => {
            if (contact.hit.indirect || this.result.outcome !== "running") return;
            if (
              this.phase === "counter" &&
              contact.at <= this.until &&
              this.result.successes < this.targetCount
            ) {
              this.result.successes++;
              this.phase = "prepare";
              this.until = this.session.nowMs + 1200;
            } else if (
              this.phase === "attack" &&
              distance(this.session.player, { x: 600, y: 350 }) < 70
            )
              this.phase = "retreat";
          },
        );
        this.session.targetId = this.target.id;
        this.phase = ["counter", "earth-rhythm"].includes(definition.kind) ? "prepare" : "position";
        this.until = 1200;
      }
    }
    this.session.paused = true;
    this.session.say(this.instructions());
  }
  get started() {
    return this.ready;
  }
  suspend(value: boolean) {
    this.suspended = value;
    if (this.result.outcome === "running")
      this.session.command({ type: "pause", value: !this.ready || value });
  }
  begin(suspended = this.suspended) {
    if (this.result.outcome === "running" && !this.ready) {
      this.ready = true;
      this.suspended = suspended;
      this.session.paused = suspended;
    }
  }
  instructions() {
    const k = this.definition.kind;
    if (k === "earth-rhythm")
      return `Opuść ${this.definition.dodgeTargets![this.tier - 1]} zapowiedzianych kręgów i wykonaj ${this.targetCount} celnych kontrataków. Trafienie nie zalicza uniku. Oba cele są obowiązkowe; śmierć przerywa próbę. Kontra: 4 s.`;
    if (k === "flow-nodes")
      return `Napraw ${this.targetCount} węzły w kolejności odczytanej ze strzałek przy stanowiskach. Błędna kolejność przerywa próbę.`;
    if (k === "contamination")
      return `Oznacz, potem oczyść ${this.targetCount} skażone miejsca według pomiarów. Nie oznaczaj ani nie czyść zdrowego podłoża. Samo oznaczenie nie zalicza oczyszczenia.`;
    if (k === "counter")
      return `Uniknij zapowiedzianego kręgu, następnie traf zwykłym atakiem w oknie kontry. Cel: ${this.targetCount}. Maksymalnie 2 otrzymane trafienia. Zapowiedź ${[1800, 1500, 1300][this.tier - 1]} ms, kontra 4 s.`;
    if (k === "restraint")
      return `Wykonaj ${this.targetCount} celnych ataków między sygnałami STOP. 4 s na cios, 2 s bez ataku. Po poddaniu mistrza całkowicie zaprzestań atakowania. Każdy cios w zabronionym oknie przerywa próbę.`;
    if (k === "position")
      return `Wykonaj ${this.targetCount} sekwencje: zielony punkt ustawienia → pozycja przy celu i celny zwykły atak → punkt odwrotu. Sama liczba kliknięć nie zalicza próby.`;
    return `Podejdź do oznaczonego stanowiska. Przeczytaj jawne materiały i rozwiąż zadanie. ${this.definition.kind === "modules" ? "Dobór modułów jest wyłącznie testowy." : `Liczba kroków: ${this.targetCount}.`} Dopuszczalne błędy: ${this.definition.maxErrors}.`;
  }
  get passed() {
    return this.result.outcome === "passed";
  }
  get currentPoint(): Point | undefined {
    if (this.result.outcome !== "running") return undefined;
    if (this.puzzles.length)
      return this.points[
        (this.definition.kind === "contamination" ? Math.floor(this.round / 2) : this.round) %
          this.points.length
      ];
    if (this.phase === "position") return { x: 230, y: 550 };
    if (this.phase === "retreat") return { x: 240, y: 550 };
    if (this.phase === "attack" || this.phase === "counter") return { x: 600, y: 350 };
    return undefined;
  }
  private near() {
    const at = this.currentPoint;
    return (
      !!at &&
      distance(this.session.player, at) <= 70 &&
      this.session.nav.visible(this.session.player, at)
    );
  }
  inspect() {
    if (
      this.ready &&
      !this.session.paused &&
      this.result.outcome === "running" &&
      this.puzzles[this.round] &&
      this.near()
    )
      this.reading = true;
  }
  closeReading() {
    this.reading = false;
  }
  answer(round: number, answerId: string, modules?: ModuleId[]) {
    if (
      !this.ready ||
      this.session.paused ||
      this.result.outcome !== "running" ||
      !this.reading ||
      !this.near() ||
      round !== this.round
    )
      return;
    const puzzle = this.puzzles[this.round];
    if (!puzzle) return;
    const valid = puzzle.modules
      ? !!modules && moduleSolutionValid(puzzle, modules)
      : !modules && answerId === puzzle.answer;
    if (!valid) {
      this.result.errors++;
      if (this.result.errors > this.definition.maxErrors)
        this.finish("failed", "Błędne rozwiązanie. Ponów próbę i sprawdź dostępne materiały.");
      return;
    }
    this.result.successes += puzzle.modules
      ? this.targetCount
      : this.definition.kind === "contamination" && this.round % 2 === 0
        ? 0
        : 1;
    this.round++;
    this.reading = false;
    this.checkEnd();
  }
  private finish(outcome: ExamResult["outcome"], reason: string) {
    this.result.outcome = outcome;
    this.result.reason = reason;
    this.session.paused = true;
    this.session.practiceTargets.removeOwner(this.instanceId);
    this.restraint?.dispose();
  }
  abandon() {
    if (this.result.outcome === "running")
      this.finish("abandoned", "Próba przerwana. Oryginalny stan postaci zachowano.");
  }
  private checkEnd() {
    if (
      this.result.successes >= this.targetCount &&
      this.dodges >= (this.definition.dodgeTargets?.[this.tier - 1] ?? 0)
    )
      this.finish("passed", "Próba ukończona. Zatwierdź wynik, aby bezpiecznie zapisać postęp.");
  }
  update() {
    const s = this.session,
      dt = s.nowMs - this.previousNow;
    this.previousNow = s.nowMs;
    if (!this.ready || this.result.outcome !== "running" || dt <= 0) return;
    this.result.activeMs += dt;
    if (s.player.dead || s.player.hp <= 0)
      return this.finish(
        "failed",
        "Profil testowy poległ. Oryginalna postać nie utraciła zasobów.",
      );
    if (this.restraint) {
      this.restraint.update();
      const r = this.restraint.snapshot();
      this.result.successes = r.windows;
      this.result.errors = r.errors;
      if (r.phase === "passed") this.checkEnd();
      else if (r.phase === "failed") this.finish("failed", r.message);
      return;
    }
    if (this.definition.kind === "position") {
      if (this.phase === "position" && this.near()) this.phase = "attack";
      else if (this.phase === "retreat" && this.near()) {
        this.result.successes++;
        this.phase = "position";
        this.checkEnd();
      }
    }
    if (!["counter", "earth-rhythm"].includes(this.definition.kind)) return;
    if (this.phase === "prepare" && s.nowMs >= this.until) {
      this.danger = { x: s.player.x, y: s.player.y };
      this.phase = "warning";
      const ms = [1800, 1500, 1300][this.tier - 1]!;
      this.until = s.nowMs + ms;
      s.emit({ type: "telegraph", ...this.danger, radius: 110, ms });
    } else if (this.phase === "warning" && s.nowMs >= this.until) {
      if (distance(s.player, this.danger) < 110) {
        const dealt = s.kit.absorb(s.kit.stats.maxHp * 0.1, "other");
        if (dealt > 0) {
          s.player.hp = Math.max(0, s.player.hp - dealt);
          this.result.errors++;
        }
        this.phase = "prepare";
        this.until = s.nowMs + 1200;
        if (this.definition.kind === "counter" && this.result.errors > this.definition.maxErrors)
          return this.finish("failed", "Otrzymano więcej niż dwa zapowiedziane trafienia.");
      } else {
        this.dodges++;
        this.phase = this.result.successes < this.targetCount ? "counter" : "prepare";
        this.until = s.nowMs + (this.phase === "counter" ? 4000 : 1200);
      }
    } else if (this.phase === "counter" && s.nowMs > this.until) {
      this.phase = "prepare";
      this.until = s.nowMs + 1200;
    }
    this.checkEnd();
  }
  snapshot() {
    const r = this.restraint?.snapshot();
    const messages: Record<string, string> = {
      read: "Podejdź do stanowiska i zbadaj materiały.",
      prepare: "Przygotuj się na zapowiedź.",
      warning: "Opuść czerwony krąg.",
      counter: "OKNO KONTRY — traf cel zwykłym atakiem.",
      position: "Podejdź do punktu ustawienia.",
      attack: "Zajmij pozycję przy celu i traf go zwykłym atakiem.",
      retreat: "Wróć do punktu odwrotu.",
    };
    return {
      ...this.result,
      dodges: this.dodges,
      dodgeTarget: this.definition.dodgeTargets?.[this.tier - 1] ?? 0,
      phase: r?.phase ?? this.phase,
      message:
        this.result.outcome === "running"
          ? (r?.message ??
            (this.definition.kind === "earth-rhythm"
              ? `Uniki: ${this.dodges}/${this.definition.dodgeTargets![this.tier - 1]} · Kontry: ${this.result.successes}/${this.targetCount}. `
              : "") + (messages[this.phase] ?? ""))
          : this.result.reason,
      round: this.round,
      target: this.targetCount,
      point: this.currentPoint ?? null,
      puzzle: this.reading ? publicPuzzle(this.puzzles[this.round]) : null,
      targets: this.session.practiceTargets
        .list(null)
        .map(({ onHit: _onHit, ...target }) => target),
      danger: this.phase === "warning" ? this.danger : null,
    };
  }
}
