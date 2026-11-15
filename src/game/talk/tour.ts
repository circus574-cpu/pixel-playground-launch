import { BUILDING_IDS, type CityDefinition } from "../city/types";
import { distance, type Point } from "../navigation";
import type { WorldId } from "../world/races";
import { whereIs } from "./compass";
import { SpeechQueue } from "./speech";
import { splitBubbles } from "./timing";
import { SERVICE_FACTS, TOUR_VOICES } from "./voices";

/**
 * Oprowadzanie po mieście: przewodniczka podchodzi do gracza, opowiada o każdym budynku i prowadzi do niego, a gra
 * cały czas biegnie. Ten moduł jest czystą logiką prezentacji: nie zmienia stanu gry, nie wysyła poleceń i nie zna
 * Phasera. Przewodniczka jest rysowana w innym miejscu niż jej posterunek w danych świata, ale rozmowa z nią w czasie
 * trasy jest obsługiwana osobno (patrz `TalkEngine`), więc położenie postaci nie wpływa na zasady gry ani na serwer.
 */

export type TourStop = {
  /** Identyfikator budynku albo „market” (cel pierwszego zadania). */
  id: string;
  label: string;
  /** Drzwi budynku lub punkt rynku; tu stoi znacznik i tu kończy się marsz przewodniczki. */
  point: Point;
  /** Ogłoszenie z kierunkiem, mówione przed ruszeniem w drogę. Zależy od miejsca, z którego mówi przewodniczka. */
  announce: (from: Point) => string[];
  /** Opis na miejscu, po dojściu. Pusty dla rynku (jego opis jest w ogłoszeniu). */
  explain: string[];
};

export type TourPlan = {
  stops: TourStop[];
  hello: string[];
  rules: string;
  follow: readonly string[];
  nag: readonly string[];
  resume: string;
  outro: readonly string[];
  skipped: string;
  back: string;
  busy: string;
};

export type TourInput = {
  worldId: WorldId;
  city: CityDefinition;
  market: { x: number; y: number; label: string };
  guideName: string;
  /** Pozycja bohatera: od niej liczona jest kolejność zwiedzania (najbliższy budynek pierwszy). */
  hero: Point;
};

/** Kolejność zwiedzania: za każdym razem najbliższy z pozostałych budynków; rynek zawsze na końcu. */
export function planTour(input: TourInput): TourPlan {
  const voice = TOUR_VOICES[input.worldId];
  const buildings = [...input.city.buildings].sort(
    (a, b) => BUILDING_IDS.indexOf(a.id) - BUILDING_IDS.indexOf(b.id),
  );
  const ordered: typeof buildings = [];
  let at = input.hero;
  while (buildings.length) {
    let best = 0;
    for (let i = 1; i < buildings.length; i++)
      if (distance(at, buildings[i]!.door) < distance(at, buildings[best]!.door) - 1e-9) best = i;
    const [next] = buildings.splice(best, 1);
    ordered.push(next!);
    at = next!.door;
  }
  const stops: TourStop[] = ordered.map((b, i) => {
    const frame = voice.frames[Math.min(i, voice.frames.length - 1)]!;
    const own = b.description.trim() && b.description.trim() !== b.name.trim();
    return {
      id: b.id,
      label: b.name,
      point: { x: b.door.x, y: b.door.y },
      announce: (from) => splitBubbles(frame(b.name, whereIs(from, b.door))),
      explain: [...splitBubbles(own ? b.description : SERVICE_FACTS[b.id]), voice.flavor[b.id]],
    };
  });
  const market = { x: input.market.x, y: input.market.y };
  stops.push({
    id: "market",
    label: input.market.label,
    point: market,
    announce: (from) => voice.market(input.market.label, whereIs(from, market)),
    explain: [],
  });
  return {
    stops,
    hello: voice.hello(input.city.name, input.guideName),
    rules: voice.rules,
    follow: voice.follow,
    nag: voice.nag,
    resume: voice.resume,
    outro: voice.outro,
    skipped: voice.skipped,
    back: voice.back,
    busy: voice.busy,
  };
}

export type TourNav = { path(from: Point, to: Point): Point[] };

export type TourPhase =
  "idle" | "approach" | "intro" | "announce" | "lead" | "explain" | "outro" | "return" | "done";

export type TourView = {
  phase: TourPhase;
  /** Prawda od `start()` do zakończenia: w tym czasie przewodniczka jest rysowana poza swoim posterunkiem. */
  active: boolean;
  /** Położenie rysowanej przewodniczki; null, gdy stoi na posterunku. */
  position: Point | null;
  facing: Point;
  moving: boolean;
  line: { id: number; text: string } | null;
  marker: { x: number; y: number; label: string } | null;
  /** Numer bieżącego punktu (od 1) i liczba punktów trasy. */
  step: number;
  steps: number;
};

export const TOUR = {
  /** Jak blisko gracza zatrzymuje się podchodząca przewodniczka. */
  approachStop: 150,
  approachSpeed: 230,
  leadSpeed: 150,
  returnSpeed: 190,
  /** Dalej niż to od gracza przewodniczka czeka i nie zaczyna nowej kwestii. */
  far: 700,
  /** Bliżej niż to gracz „dogonił” czekającą przewodniczkę. */
  near: 450,
  /** Dojście do drzwi: tyle przed nimi przewodniczka staje. */
  arrive: 190,
  nagAfterMs: 3500,
  nagEveryMs: 10_000,
  giveUpMs: 90_000,
  /** Przerwa między dymkami, żeby kolejna kwestia nie zlewała się z poprzednią. */
  gapMs: 350,
  /** Teleportacja bohatera dalej niż to przerywa oprowadzanie bez oznaczania go jako ukończone. */
  abortDistance: 6000,
} as const;

const EPS = 4;

export class TourDirector {
  private phase: TourPhase = "idle";
  private position: Point | null = null;
  private facing: Point = { x: 0, y: 1 };
  private moving = false;
  private route: Point[] = [];
  private routeFor: Point | null = null;
  private stop = 0;
  private readonly speech = new SpeechQueue(TOUR.gapMs);
  private marker: TourView["marker"] = null;
  /** Czekanie na gracza: czas bieżącego oczekiwania, czas łączny, liczba zawołań i próg następnego. */
  private waited = 0;
  private waitTotal = 0;
  private waiting = false;
  private nagCount = 0;
  private nextNag = 0;
  private followIndex = 0;
  private entered = false;
  private aborted = false;
  private skippedByUser = false;

  constructor(
    private readonly plan: TourPlan,
    /** Posterunek przewodniczki: tu wraca po trasie. */
    private readonly post: Point,
    /** Skąd wychodzi, gdy podchodzi do gracza (np. drzwi sali zgromadzeń). */
    private readonly origin: Point,
    private readonly nav: TourNav,
  ) {}

  get finished() {
    return this.phase === "done";
  }
  get wasAborted() {
    return this.aborted;
  }
  /** Zakończone w pełni lub pominięte przez gracza (ma być zapamiętane); przerwane teleportem nie. */
  get completed() {
    return this.phase === "done" && !this.aborted;
  }

  get view(): TourView {
    return {
      phase: this.phase,
      active: this.phase !== "idle" && this.phase !== "done",
      position: this.position ? { ...this.position } : null,
      facing: { ...this.facing },
      moving: this.moving,
      line: this.speech.current,
      marker: this.marker ? { ...this.marker } : null,
      step:
        this.phase === "announce" || this.phase === "lead" || this.phase === "explain"
          ? this.stop + 1
          : 0,
      steps: this.plan.stops.length,
    };
  }

  /**
   * Ustawia przewodniczkę w punkcie wyjścia, zanim trasa ruszy (nowa postać: zamiast stać obok gracza, czeka przy sali
   * zgromadzeń i stamtąd do niego podchodzi). Nie rozpoczyna trasy: `view.active` pozostaje false.
   */
  stage(hero: Point) {
    if (this.phase !== "idle" && this.phase !== "done") return;
    this.reset();
    this.position = { ...this.origin };
    this.face(hero);
    this.phase = "idle";
  }
  get staged() {
    return this.phase === "idle" && this.position !== null;
  }

  start(hero: Point) {
    if (this.phase !== "idle" && this.phase !== "done") return;
    const staged = this.phase === "idle" ? this.position : null;
    this.reset();
    this.position = staged ? { ...staged } : { ...this.origin };
    this.face(hero);
    this.phase = "approach";
  }

  /** Gracz rezygnuje: przewodniczka żegna się jednym zdaniem i wraca na posterunek. */
  skip() {
    if (this.phase === "idle" || this.phase === "done" || this.phase === "return") return;
    this.skippedByUser = true;
    this.marker = null;
    this.speech.sayNow(this.plan.skipped);
    this.phase = "outro";
    this.entered = true;
  }

  /** Przerwanie bez zapamiętania (np. bohater zmienił miasto): przewodniczka natychmiast wraca na posterunek. */
  abort() {
    if (this.phase === "idle" || this.phase === "done") return;
    this.reset();
    this.aborted = true;
    this.phase = "done";
  }

  tick(dtMs: number, hero: Point, heroInside = false) {
    if (this.phase === "idle" || this.phase === "done" || !Number.isFinite(dtMs) || dtMs <= 0)
      return;
    if (heroInside) {
      // Wnętrza budynków mają własny układ współrzędnych: trasa czeka na wyjście.
      this.moving = false;
      return;
    }
    if (this.position && distance(this.position, hero) > TOUR.abortDistance) {
      this.abort();
      return;
    }
    this.speech.tick(dtMs);
    switch (this.phase) {
      case "approach":
        return this.approach(dtMs, hero);
      case "intro":
        return this.intro(hero);
      case "announce":
        return this.announce(dtMs, hero);
      case "lead":
        return this.lead(dtMs, hero);
      case "explain":
        return this.explain(dtMs, hero);
      case "outro":
        return this.outro();
      case "return":
        return this.back(dtMs);
    }
  }

  private reset() {
    this.position = null;
    this.moving = false;
    this.route = [];
    this.routeFor = null;
    this.stop = 0;
    this.speech.clear();
    this.marker = null;
    this.waited = 0;
    this.waitTotal = 0;
    this.waiting = false;
    this.nagCount = 0;
    this.nextNag = 0;
    this.followIndex = 0;
    this.entered = false;
    this.aborted = false;
    this.skippedByUser = false;
  }

  // ---- mowa -------------------------------------------------------------------------------------------------------

  private say(...lines: string[]) {
    this.speech.say(...lines);
  }
  private get speaking() {
    return this.speech.busy;
  }

  // ---- ruch -------------------------------------------------------------------------------------------------------

  private face(to: Point) {
    if (!this.position) return;
    const d = distance(this.position, to);
    if (d > 1) this.facing = { x: (to.x - this.position.x) / d, y: (to.y - this.position.y) / d };
  }
  /** Idzie do `target` po ścieżce nawigacji. Zwraca true po dojściu (albo gdy ścieżki nie ma: stoi w miejscu). */
  private walk(target: Point, speed: number, dt: number, stopWithin: number): boolean {
    const pos = this.position!;
    if (distance(pos, target) <= stopWithin) {
      this.moving = false;
      return true;
    }
    if (!this.routeFor || distance(this.routeFor, target) > 80) {
      this.route = this.nav.path(pos, target);
      this.routeFor = { ...target };
      if (this.route.length === 0) {
        this.moving = false;
        return true; // brak drogi: opisuje z miejsca, w którym stoi
      }
    }
    let budget = (speed * dt) / 1000;
    this.moving = false;
    while (budget > 0 && this.route.length) {
      const next = this.route[0]!;
      const d = distance(pos, next);
      if (d <= EPS) {
        this.route.shift();
        continue;
      }
      const step = Math.min(budget, d);
      this.facing = { x: (next.x - pos.x) / d, y: (next.y - pos.y) / d };
      pos.x += this.facing.x * step;
      pos.y += this.facing.y * step;
      budget -= step;
      this.moving = true;
      if (distance(pos, target) <= stopWithin) {
        this.moving = false;
        return true;
      }
    }
    if (this.route.length === 0) this.moving = false;
    return this.route.length === 0;
  }

  // ---- fazy -------------------------------------------------------------------------------------------------------

  private approach(dt: number, hero: Point) {
    if (!this.walk(hero, TOUR.approachSpeed, dt, TOUR.approachStop)) return;
    this.face(hero);
    this.say(...this.plan.hello);
    this.phase = "intro";
    this.entered = false;
  }

  private intro(hero: Point) {
    this.face(hero);
    if (!this.entered) {
      this.entered = true;
      this.say(this.plan.rules);
    }
    if (this.speaking) return;
    this.enterStop();
  }

  private enterStop() {
    this.phase = "announce";
    this.entered = false;
  }

  /**
   * Gracz został daleko: przewodniczka staje i nie zaczyna nowej kwestii. Po chwili raz woła, potem co jakiś czas, a gdy
   * gracz wróci w pobliże, mówi, że ruszają dalej. Po bardzo długiej nieobecności kończy oprowadzanie.
   */
  private heroTooFar(dt: number, hero: Point): boolean {
    if (!this.position) return false;
    const d = distance(this.position, hero);
    if (d <= (this.waiting ? TOUR.near : TOUR.far)) {
      if (this.waiting && this.nagCount > 0) this.say(this.plan.resume);
      this.waiting = false;
      this.waited = 0;
      this.nagCount = 0;
      return false;
    }
    if (!this.waiting) {
      this.waiting = true;
      this.waited = 0;
      this.nextNag = TOUR.nagAfterMs;
    }
    this.moving = false;
    this.face(hero);
    this.waited += dt;
    this.waitTotal += dt;
    if (this.waitTotal >= TOUR.giveUpMs) {
      this.skip();
      return true;
    }
    if (!this.speaking && this.waited >= this.nextNag) {
      this.say(this.plan.nag[this.nagCount % this.plan.nag.length]!);
      this.nagCount++;
      this.nextNag = this.waited + TOUR.nagEveryMs;
    }
    return true;
  }

  private announce(dt: number, hero: Point) {
    const stop = this.plan.stops[this.stop]!;
    if (!this.entered) {
      if (this.heroTooFar(dt, hero)) return;
      this.entered = true;
      this.marker = { x: stop.point.x, y: stop.point.y, label: stop.label };
      this.face(stop.point);
      this.say(...stop.announce(this.position!));
      return;
    }
    if (this.speaking) return;
    this.say(this.plan.follow[this.followIndex++ % this.plan.follow.length]!);
    this.phase = "lead";
    this.entered = false;
    this.route = [];
    this.routeFor = null;
  }

  private lead(dt: number, hero: Point) {
    const stop = this.plan.stops[this.stop]!;
    if (this.heroTooFar(dt, hero)) return;
    if (!this.walk(stop.point, TOUR.leadSpeed, dt, TOUR.arrive)) return;
    this.moving = false;
    this.face(stop.point);
    this.phase = "explain";
    this.entered = false;
  }

  private explain(dt: number, hero: Point) {
    const stop = this.plan.stops[this.stop]!;
    if (!this.entered) {
      if (this.heroTooFar(dt, hero)) return;
      this.entered = true;
      this.say(...stop.explain);
      return;
    }
    if (this.speaking) return;
    this.marker = null;
    this.stop++;
    if (this.stop < this.plan.stops.length) {
      this.enterStop();
      return;
    }
    this.say(...this.plan.outro);
    this.phase = "outro";
    this.entered = true;
  }

  private outro() {
    if (this.speaking) return;
    this.say(this.skippedByUser ? "" : this.plan.back);
    this.phase = "return";
    this.route = [];
    this.routeFor = null;
  }

  private back(dt: number) {
    if (!this.position) {
      this.phase = "done";
      return;
    }
    const arrived = this.walk(this.post, TOUR.returnSpeed, dt, EPS);
    if (arrived && !this.speaking) {
      this.position = null;
      this.moving = false;
      this.marker = null;
      this.phase = "done";
    }
  }
}
