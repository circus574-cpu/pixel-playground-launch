import { RecoveryUnit } from "./recoveryUnit";
import { ResourceControlTrial, resourceProfile, type ResourceTrialKind } from "./resourceControl";
import { CalibrationTrial, type CalibrationKind } from "./calibration";
import { FocusTrial, FOCUS_ROOM } from "./focus";
import { BarrierWaves, CoverWindows } from "./barriers";
import { traceMirrors } from "./mirrors";
import { CampTrial } from "./camp";
import { EscortActivity } from "../heritage/escort";
import { ProtectedActor } from "../heritage/protectedActor";
import { loanSession } from "../loan";
import type { GameSession } from "../../session";
import { distance, type Point } from "../../navigation";
import type { ExamResult } from "../exams";
import type { PracticeTarget } from "../targets";
import { RestraintActivity } from "../heritage/restraint";
import { trialDefinition, TRIAL_RULES, type TrialId, type TrialTier } from "./catalog";
import {
  publicPuzzle,
  trialPuzzles,
  moduleSolutionValid,
  packAnswerValid,
  allocationAnswerValid,
} from "./puzzles";
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
  private camp: CampTrial | undefined;
  private waves: BarrierWaves | undefined;
  private cover: CoverWindows | undefined;
  private focus: FocusTrial | undefined;
  private calibration: CalibrationTrial | undefined;
  private resourceControl: ResourceControlTrial | undefined;
  private recovery: RecoveryUnit | undefined;
  private escort: EscortActivity | undefined;
  private companion: ProtectedActor | undefined;
  private escortHazard: { x: number; y: number; until: number } | undefined;
  private nextEscortHazard = 5000;
  private insideHazard = false;
  readonly route = [
    { x: 230, y: 550 },
    { x: 240, y: 170 },
    { x: 520, y: 130 },
    { x: 810, y: 250 },
    { x: 820, y: 620 },
    { x: 520, y: 620 },
    { x: 520, y: 350 },
    { x: 230, y: 550 },
  ];
  readonly routeHazards = [{ x: 600, y: 440, radius: 50 }];
  get routeLimitMs() {
    return [180000, 210000, 240000][this.tier - 1]!;
  }
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
    if (definition.kind === "marked-shots") {
      p.skills.push("A1");
      this.session.kit.learn("A1");
    }
    if (definition.kind === "focus-cycles") {
      p.skills.push("C1");
      this.session.kit.learn("C1");
    }
    if (definition.kind === "barrier-waves") {
      p.skills.push("B1");
      this.session.kit.learn("B1");
    }
    const resourceKind = [
      "core-sequence",
      "core-band",
      "core-windows",
      "ember-band",
      "ember-windows",
      "ki-budget",
    ].includes(definition.kind);
    if (resourceKind) resourceProfile(this.session, definition.kind as ResourceTrialKind, tier);
    p.items.potion = 0;
    p.hp = this.session.kit.stats.maxHp;
    p.ki = this.session.kit.stats.maxKi;
    const physical = ["counter", "earth-rhythm", "restraint", "position"].includes(definition.kind);
    this.puzzles =
      resourceKind ||
      physical ||
      [
        "ordered-shots",
        "moving-shots",
        "marked-shots",
        "wind-route",
        "messenger",
        "camp",
        "barrier-waves",
        "cover-windows",
        "focus-cycles",
        "power-targets",
        "sustain-nodes",
      ].includes(definition.kind)
        ? []
        : trialPuzzles(definition, tier);
    if (
      definition.kind === "focus-cycles" ||
      definition.kind === "power-targets" ||
      definition.kind === "sustain-nodes"
    ) {
      this.focus = new FocusTrial(this.session, definition.kind, tier);
      this.phase = definition.kind === "power-targets" ? "read" : "focus";
    }
    if (["ordered-shots", "moving-shots", "marked-shots"].includes(definition.kind)) {
      this.calibration = new CalibrationTrial(
        this.session,
        definition.kind as CalibrationKind,
        tier,
        this.instanceId,
      );
      this.phase = "calibration";
    }
    if (resourceKind) {
      this.resourceControl = new ResourceControlTrial(
        this.session,
        definition.kind as ResourceTrialKind,
        tier,
        this.instanceId,
      );
      this.phase = "resource-control";
    }
    if (definition.kind === "barrier-waves") {
      this.waves = new BarrierWaves(this.session, tier);
      this.phase = "barrier-waves";
    }
    if (definition.kind === "cover-windows") {
      this.cover = new CoverWindows(this.session, tier);
      this.phase = "cover-windows";
    }
    if (definition.kind === "camp") {
      this.camp = new CampTrial(this.session, tier);
      this.phase = "camp";
    }
    if (definition.kind === "wind-route") this.phase = "route";
    if (definition.kind === "messenger") {
      this.phase = "escort";
      this.companion = new ProtectedActor(
        this.session,
        "Posłaniec próby",
        { x: p.x, y: p.y },
        100,
        0,
        true,
        false,
      );
      this.escort = new EscortActivity(
        this.session,
        {
          id: this.instanceId,
          kind: "escort",
          label: definition.name,
          site: "trainer",
          documents: [],
          checkpoints: this.targetCount,
          actor: "Posłaniec próby",
          minHealthFraction: 0.5,
          combat: false,
        },
        this.instanceId,
        {
          id: this.instanceId,
          label: definition.name,
          point: { x: p.x, y: p.y },
          feature: this.session.world.id,
          interior: null,
          npc: null,
          witness: false,
          entrance: null,
        },
        this.route.slice(0, this.targetCount),
        0,
        () => !!this.companion?.valid() && this.companion.body.hp / this.companion.maxHp >= 0.5,
      );
    }
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
    if (definition.kind === "manual-recovery") this.recovery = new RecoveryUnit(tier);
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
    if (this.resourceControl) {
      const r = this.resourceControl.snapshot();
      return `${TRIAL_RULES[k]} Limit sali 240 s. Okna: sygnał 1,5 s, działanie 3 s. Przerwa między aktywnymi trafieniami podczas utrzymania: najwyżej 8 s. Aktualne maksimum zasobu: ${r.max}, budżet KI ${r.budgetKi.toFixed(1)}. Wszystkie umiejętności zachowują zwykłe koszty i cooldowny; bez T. Własne zasoby postaci pozostają poza próbą.`;
    }
    if (this.calibration)
      return `Kalibracja: ${this.targetCount} celów. ${k === "ordered-shots" ? "Trafiaj kolejno ponumerowane cele zwykłym R." : k === "moving-shots" ? `Traf różne ruchome cele; szybkość ${this.calibration.speed} j./s.` : "Trafiaj tylko cele zgodne z kartą: najpierw A1, potem R. Nie strzelaj do chronionego celu ani wabika."} Wszystkie strzały używają realnych pocisków i LOS; limit 240 s, maksymalnie ${this.definition.maxErrors} chybień.`;
    if (TRIAL_RULES[k]) return TRIAL_RULES[k]!;
    if (k === "focus-cycles")
      return `Ukończ ${this.targetCount} pełne kanały C1 bez przerwania. Podejdź kolejno do stanowisk, poczekaj na koniec sygnału 1500 ms i użyj Skupienia KI. Ruch lub trafienie przerywa kanał. Normalny cooldown 15 s; 20 s na rozpoczęcie po sygnale. Testowe C1 nie przechodzi do własnej postaci.`;
    if (k === "power-targets")
      return `Zasil ${this.targetCount} celów w limicie ${[70, 65, 60][this.tier - 1]}% testowego KI. Precyzyjny przepływ kosztuje 10% maksimum, szeroki 25%. Wybierz przepływ przy każdym stanowisku. Regeneracja nie odnawia łącznego budżetu. Nie używasz własnych zasobów.`;
    if (k === "sustain-nodes")
      return `Utrzymaj ${this.targetCount} węzły przez ${this.focus!.duration / 1000} s. Odwiedzaj je kolejno i utrzymaj pozycję przez 0,5 s; każdy wymaga odnowienia przed wygaśnięciem. Nie wchodź do czerwonego zagrożenia. Samo czekanie nie zalicza próby.`;
    if (k === "barrier-waves")
      return `Osłoń rdzeń przed ${this.targetCount} falami, zachowując minimum 50% jego HP. Stań w zielonym punkcie między źródłem a rdzeniem i włącz Świetlistą Barierę B1 po zapowiedzi. Bariera zużywa prawdziwą pojemność i testowe KI; odnowienie działa normalnie. Nie nauczysz swojej postaci B1 przez tę próbę.`;
    if (k === "cover-windows")
      return `Zajmij rzeczywistą osłonę w ${this.targetCount} oknach. Reakcja ${[1800, 1500, 1300][this.tier - 1]} ms od zapowiedzi. Zielony punkt musi być za ścianą względem czerwonego źródła; wykonaj ruch po sygnale. Samo stanie za ścianą nie zalicza okna.`;
    if (k === "mirrors")
      return `Ustaw ${this.targetCount} zwierciadła. Promień ma przejść przez wszystkie do odbiornika O, nie dotykając chronionego punktu !. Jawny podgląd pokazuje rzeczywistą trasę.`;
    if (k === "supplies")
      return `Przygotuj cały zestaw ${this.targetCount} wypożyczonych składników według jawnych opisów. Nie dodawaj zbędnych elementów.`;
    if (k === "water-allocation")
      return `Rozdziel ${this.targetCount} jednostek wody pomiędzy obie osady zgodnie z zapotrzebowaniem. Nie używasz własnych zasobów.`;
    if (k === "camp")
      return `Utrzymaj ${this.targetCount} punkty przez ${this.camp!.duration / 1000} s. Co najwyżej 10 s na zajęcie następnej osłony. Stań w zielonym kręgu, za rzeczywistą przeszkodą względem czerwonego źródła zagrożenia. Samo czekanie bez zmiany punktu nie wystarcza.`;
    if (k === "wind-route")
      return `Przejdź kolejno ${this.targetCount} punktów w ${this.routeLimitMs / 1000} s. Maksymalnie dwa wejścia w czerwone zagrożenie; trzecie przerywa próbę. Stanie w środku nie nalicza kolejnych wejść.`;
    if (k === "messenger")
      return `Przeprowadź posłańca przez ${this.targetCount} punkty. Wymagane minimum 50% jego HP. Czeka, gdy oddalisz się o ponad 220 j. Unikaj zapowiedzianych zagrożeń razem z nim; sama obecność gracza w celu nie zalicza eskorty.`;
    if (k === "tracks")
      return `Rozpoznaj ${this.targetCount} kolejnych śladów według jawnej karty. Wybierz spośród ${this.tier === 1 ? 2 : 3} szlaków. Maksymalnie jedna pomyłka.`;
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
    if (this.resourceControl) return this.resourceControl.point;
    if (this.calibration) return this.calibration.point;
    if (this.focus) return this.focus.point;
    if (this.waves) return this.waves.point;
    if (this.cover) return this.cover.snapshot().phase === "warning" ? this.cover.point : undefined;
    if (this.camp) return this.camp.point;
    if (this.escort) return this.escort.nextTarget().point;
    if (this.definition.kind === "wind-route") return this.route[this.result.successes];
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
      (this.puzzles[this.round] || this.focus?.kind === "power-targets") &&
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
    if (this.focus?.kind === "power-targets") {
      if (modules || !this.focus.feed(answerId)) {
        this.syncFocus();
        return;
      }
      this.round++;
      this.reading = false;
      this.syncFocus();
      return;
    }
    const puzzle = this.puzzles[this.round];
    if (!puzzle) return;
    const valid = puzzle.modules
      ? !!modules && moduleSolutionValid(puzzle, modules)
      : !modules &&
        (puzzle.mirrors
          ? traceMirrors(puzzle.mirrors, answerId).passed
          : puzzle.pack
            ? packAnswerValid(puzzle, answerId)
            : puzzle.allocation
              ? allocationAnswerValid(puzzle, answerId)
              : answerId === puzzle.answer);
    if (!valid) {
      this.result.errors++;
      if (this.result.errors > this.definition.maxErrors)
        this.finish("failed", "Błędne rozwiązanie. Ponów próbę i sprawdź dostępne materiały.");
      return;
    }
    if (this.recovery && !this.recovery.execute(this.recovery.steps[this.round]!)) {
      this.finish("failed", "Naruszono bezpieczny stan terminala ratunkowego.");
      return;
    }
    this.result.successes +=
      puzzle.pack || puzzle.allocation || puzzle.mirrors
        ? this.targetCount
        : puzzle.modules
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
    this.resourceControl?.dispose();
    this.calibration?.dispose();
    this.focus?.dispose();
    this.waves?.dispose();
    this.cover?.dispose();
    this.camp?.dispose();
    this.restraint?.dispose();
    this.escortHazard = undefined;
    this.escort?.dispose();
    this.companion?.dispose();
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
  private syncFocus() {
    if (!this.focus) return;
    const r = this.focus.snapshot();
    this.result.successes = r.completed;
    if (r.phase === "failed") this.finish("failed", r.reason);
    else if (r.phase === "passed")
      this.finish("passed", "Wszystkie cele Skupienia wykonane. Zatwierdź wynik.");
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
    if (this.resourceControl) {
      this.resourceControl.update();
      const r = this.resourceControl.snapshot();
      this.result.successes =
        r.kind === "core-sequence" ? Math.min(r.shots, r.target) : r.completed;
      if (r.phase === "failed") this.finish("failed", r.reason);
      else if (r.phase === "passed")
        this.finish("passed", "Cele kontroli zasobu wykonane. Zatwierdź wynik.");
      return;
    }
    if (this.calibration) {
      this.calibration.update();
      const r = this.calibration.snapshot();
      this.result.successes = r.completed;
      this.result.errors = r.errors;
      if (r.phase === "failed") this.finish("failed", r.reason);
      else if (r.phase === "passed") this.checkEnd();
      return;
    }
    if (this.focus) {
      this.focus.update();
      this.syncFocus();
      return;
    }
    const barrier = this.waves ?? this.cover;
    if (barrier) {
      barrier.update();
      const r = barrier.snapshot();
      this.result.successes = r.completed;
      if (r.phase === "failed")
        this.finish(
          "failed",
          this.waves
            ? "Rdzeń utracił wymagane 50% HP."
            : "Nie zajęto osłony w wymaganym oknie po zapowiedzi.",
        );
      else if (r.phase === "passed")
        this.finish("passed", "Wszystkie cele osłony wykonane. Zatwierdź wynik.");
      return;
    }
    if (this.camp) {
      this.camp.update(this.result.activeMs);
      const r = this.camp.snapshot();
      this.result.successes = r.completed;
      if (r.phase === "failed")
        this.finish("failed", "Nie zabezpieczono punktu osłoną w wymaganym oknie.");
      else if (r.phase === "passed")
        this.finish("passed", "Obóz utrzymany przez wymagany czas. Zatwierdź wynik.");
      return;
    }
    if (this.definition.kind === "wind-route") {
      if (this.result.activeMs > this.routeLimitMs)
        return this.finish("failed", "Przekroczono limit czasu trasy.");
      const danger = this.routeHazards.some((h) => distance(s.player, h) < h.radius);
      if (danger && !this.insideHazard) this.result.errors++;
      this.insideHazard = danger;
      if (this.result.errors > 2) return this.finish("failed", "Trzecie wejście w zagrożenie.");
      if (
        this.currentPoint &&
        distance(s.player, this.currentPoint) <= 45 &&
        s.nav.visible(s.player, this.currentPoint)
      )
        this.result.successes++;
      this.checkEnd();
      return;
    }
    if (this.escort && this.companion) {
      this.escort.update();
      Object.assign(this.companion.body, this.escort.actor);
      const r = this.escort.snapshot();
      this.result.successes = r.windows;
      if (this.escortHazard && s.nowMs >= this.escortHazard.until) {
        if (distance(this.companion.body, this.escortHazard) < 65)
          this.companion.hurtEnvironment(20);
        this.escortHazard = undefined;
        this.nextEscortHazard = s.nowMs + 5000;
      }
      if (!this.companion.valid() || this.companion.body.hp / this.companion.maxHp < 0.5)
        return this.finish("failed", "Zdrowie posłańca spadło poniżej 50%.");
      if (r.phase === "failed") return this.finish("failed", r.message);
      if (r.phase === "passed") {
        this.checkEnd();
        return;
      }
      if (!this.escortHazard && s.nowMs >= this.nextEscortHazard) {
        this.escortHazard = { ...this.companion.body, until: s.nowMs + 1800 };
        s.emit({
          type: "telegraph",
          x: this.companion.body.x,
          y: this.companion.body.y,
          radius: 65,
          ms: 1800,
        });
      }
      return;
    }
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
    const focus = this.focus?.snapshot();
    const messages: Record<string, string> = {
      focus: focus
        ? this.definition.kind === "sustain-nodes"
          ? `Pozostało ${Math.ceil(focus.remainingMs / 1000)} s. Odwiedzaj świecące węzły; unikaj czerwonej strefy.`
          : `${focus.phase === "ready" ? "TERAZ — użyj C1." : focus.phase === "channel" ? "Nie przerywaj kanału C1." : focus.phase === "cue" ? "Poczekaj na koniec sygnału." : "Podejdź do następnego stanowiska."} ${Math.ceil(focus.remainingMs / 1000)} s.`
        : "",
      "barrier-waves": this.waves
        ? `Rdzeń: ${Math.ceil(this.waves.actor.body.hp)}% HP. ${this.waves.snapshot().phase === "warning" ? "FALA — zajmij zielony punkt i użyj B1." : "Przygotuj się na kolejną falę."}`
        : "",
      "cover-windows": this.cover
        ? `${this.cover.snapshot().phase === "warning" ? "OSŁONA — rusz do zielonego punktu za ścianą." : "Czekaj na zapowiedź."} ${Math.ceil(this.cover.snapshot().remainingMs)} ms.`
        : "",
      camp: this.camp
        ? `Pozostało ${Math.ceil(this.camp.snapshot().remainingMs / 1000)} s. Okno osłony ${Math.ceil(this.camp.snapshot().windowMs / 1000)} s. ${this.camp.snapshot().guarded ? "Punkt osłonięty; przygotuj się do kolejnego." : "Podejdź do zaznaczonej osłony."}`
        : "",
      route: `Kolejny punkt ${this.result.successes + 1}/${this.targetCount}. Czas ${Math.ceil(Math.max(0, this.routeLimitMs - this.result.activeMs) / 1000)} s.`,
      escort: this.escort
        ? `${this.escort.snapshot().message} HP: ${this.companion?.body.hp ?? 0}%`
        : "",
      calibration: "Trafiaj cele zwykłym R. Oznaczanie: A1. Zwróć uwagę na numer i opis celu.",
      "resource-control": this.resourceControl
        ? `Faza: ${({ build: "budowanie", cue: "sygnał", window: "okno działania", hold: "utrzymanie", passed: "zaliczona", failed: "przerwana" } as const)[this.resourceControl.snapshot().phase]}. Zasób ${this.resourceControl.value.toFixed(1)}/${this.resourceControl.max}. Strzały ${this.resourceControl.snapshot().shots}; zużycia ${this.resourceControl.snapshot().discharges}. Utrzymano ${Math.floor(this.resourceControl.snapshot().heldMs / 1000)} s. KI ${this.resourceControl.snapshot().spentKi}/${this.resourceControl.budget.toFixed(1)}.`
        : "",
      read: this.recovery
        ? `Terminal: pamięć ${this.recovery.snapshot().memoryIntact ? "nienaruszona" : "naruszona"}, obwód ${this.recovery.snapshot().isolated ? "odłączony" : "uszkodzony"}, kopia ${this.recovery.snapshot().backup ? "zabezpieczona" : "oczekuje"}, zasilanie ${this.recovery.snapshot().powered ? "bezpieczne" : "odłączone"}. Podejdź do stanowiska i wykonaj następne działanie.`
        : "Podejdź do stanowiska i zbadaj materiały.",
      prepare: "Przygotuj się na zapowiedź.",
      warning: "Opuść czerwony krąg.",
      counter: "OKNO KONTRY — traf cel zwykłym atakiem.",
      position: "Podejdź do punktu ustawienia.",
      attack: "Zajmij pozycję przy celu i traf go zwykłym atakiem.",
      retreat: "Wróć do punktu odwrotu.",
    };
    return {
      ...this.result,
      resourceControl: this.resourceControl?.snapshot() ?? null,
      recovery: this.recovery?.snapshot() ?? null,
      calibration: this.calibration?.snapshot() ?? null,
      focus: focus ?? null,
      waves: this.waves?.snapshot() ?? null,
      cover: this.cover?.snapshot() ?? null,
      camp: this.camp?.snapshot() ?? null,
      escort:
        this.escort && this.companion
          ? {
              ...this.escort.snapshot().actor,
              hp: this.companion.body.hp,
              maxHp: this.companion.maxHp,
            }
          : null,
      routeHazards: this.definition.kind === "wind-route" ? this.routeHazards : [],
      escortDanger: this.escortHazard ?? null,
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
      puzzle: this.reading
        ? focus?.kind === "power-targets"
          ? publicPuzzle({
              prompt: `Zasil cel ${this.round + 1}/${this.targetCount}`,
              documents: [
                {
                  title: "Budżet testowego KI",
                  text: `Zużyto ${focus.spentKi.toFixed(1)} / ${focus.budgetKi.toFixed(1)} KI. Regeneracja nie odnawia tego limitu. Wybrany przepływ naprawdę pobiera KI z wypożyczonego profilu.`,
                },
              ],
              options: [
                {
                  id: "precise",
                  label: `Precyzyjny przepływ · ${(focus.maxKi * FOCUS_ROOM.preciseCost).toFixed(1)} KI`,
                },
                {
                  id: "wide",
                  label: `Szeroki przepływ · ${(focus.maxKi * FOCUS_ROOM.wideCost).toFixed(1)} KI`,
                },
              ],
              answer: "",
            })
          : publicPuzzle(this.puzzles[this.round])
        : null,
      targets: this.session.practiceTargets
        .list(null)
        .map(({ onHit: _onHit, ...target }) => target),
      danger: this.phase === "warning" ? this.danger : null,
    };
  }
}
