import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RACES, RACE_IDS, type WorldId } from "../game/world/races";
import { browserNavigation, type GridData } from "../game/world/generated/browserTerrain";
import {
  buildSuperiorSimulationWorld,
  type SuperiorSimulationSource,
} from "../game/world/generated/simulationWorld";
import type { SuperiorIndex } from "../game/world/generated/superiorSave";
import type { Obstacle } from "../game/movement";
import { distance, type Navigation, type Point } from "../game/navigation";
import { BUILDING_IDS } from "../game/city/types";
import { compass, walkTime, whereIs } from "../game/talk/compass";
import {
  BUBBLE_MAX_CHARS,
  READING_MAX_MS,
  READING_MIN_MS,
  readingMs,
  splitBubbles,
} from "../game/talk/timing";
import { SERVICE_FACTS, TOUR_VOICES } from "../game/talk/voices";
import { TOUR, TourDirector, planTour, type TourPlan } from "../game/talk/tour";

const root = "public/game/worlds/superior-v2";
const index = JSON.parse(readFileSync(root + "/index.json", "utf8")) as SuperiorIndex;

type Land = {
  id: WorldId;
  nav: Navigation;
  cities: ReturnType<typeof buildSuperiorSimulationWorld>["cities"];
  arrival: Point;
};
function loadLand(id: WorldId): Land {
  const info = index.features.find((f) => f.id === id)!;
  const read = <T>(name: string) =>
    JSON.parse(readFileSync(`${root}/${id}/${name}.json`, "utf8")) as T;
  const nav = browserNavigation(
    info.width,
    info.height,
    read<GridData>("navigation"),
    read<GridData>("terrain"),
    read<Obstacle[]>("collision"),
  );
  const built = buildSuperiorSimulationWorld({
    source: read<SuperiorSimulationSource>("world"),
    info,
    navigation: nav,
    town: null,
    basePath: "/game/worlds/superior-v2",
  });
  return { id, nav, cities: built.cities, arrival: built.world.spawn };
}
const LANDS = Object.fromEntries(
  RACE_IDS.map((r) => [RACES[r].world, loadLand(RACES[r].world)]),
) as Record<WorldId, Land>;

const straight = { path: (_from: Point, to: Point): Point[] => [to] };

function planFor(
  land: Land,
  town: string,
  hero: Point,
): { plan: TourPlan; post: Point; origin: Point } {
  const c = land.cities.get(town)!;
  const guide = c.npcs.find((n) => n.id === "guide")!;
  const hall = c.city.buildings.find((b) => b.id === "hall")!;
  return {
    plan: planTour({
      worldId: land.id,
      city: c.city,
      market: c.market,
      guideName: guide.name,
      hero,
    }),
    post: { x: guide.x, y: guide.y },
    origin: hall.door,
  };
}

/** Bohater idzie za przewodniczką (zostaje ~250 jedn. z tyłu) i przy każdym kroku zbiera kwestie. */
function run(
  director: TourDirector,
  hero: Point,
  opts: { follow?: boolean; maxMs?: number; dt?: number } = {},
) {
  const { follow = true, maxMs = 600_000, dt = 50 } = opts;
  const lines: string[] = [];
  const markers: string[] = [];
  let t = 0;
  let lastId = -1;
  let maxSpeed = 0;
  let prev: Point | null = null;
  while (!director.finished && t < maxMs) {
    director.tick(dt, hero);
    const v = director.view;
    if (v.line && v.line.id !== lastId) {
      lastId = v.line.id;
      lines.push(v.line.text);
    }
    if (v.marker && markers[markers.length - 1] !== v.marker.label) markers.push(v.marker.label);
    if (v.position && prev) maxSpeed = Math.max(maxSpeed, (distance(prev, v.position) / dt) * 1000);
    prev = v.position ? { ...v.position } : null;
    if (follow && v.position && distance(v.position, hero) > 250) {
      const d = distance(v.position, hero);
      const step = Math.min(d - 250, (175 * dt) / 1000);
      hero.x += ((v.position.x - hero.x) / d) * step;
      hero.y += ((v.position.y - hero.y) / d) * step;
    }
    t += dt;
  }
  return { lines, markers, t, maxSpeed };
}

describe("czas czytania i dymki", () => {
  it("czas rośnie z długością tekstu i mieści się w granicach", () => {
    expect(readingMs("Tak.")).toBe(READING_MIN_MS);
    expect(readingMs("x".repeat(40))).toBeLessThan(readingMs("x".repeat(80)));
    expect(readingMs("x".repeat(5000))).toBe(READING_MAX_MS);
  });
  it("dzieli tekst na zdaniach i nie tnie skrótu „ok. 15 s”", () => {
    const text =
      "Na północ, ok. 15 s drogi. To cel pierwszego zadania! Przyjmiesz je u mnie? Wystarczy rozmowa.";
    expect(splitBubbles(text, 30)).toEqual([
      "Na północ, ok. 15 s drogi.",
      "To cel pierwszego zadania!",
      "Przyjmiesz je u mnie?",
      "Wystarczy rozmowa.",
    ]);
    expect(splitBubbles(text)).toEqual([text]);
    for (const part of splitBubbles("Jedno zdanie. ".repeat(40))) {
      expect([...part].length).toBeLessThanOrEqual(BUBBLE_MAX_CHARS);
    }
  });
});

describe("strony świata i czas marszu", () => {
  const o = { x: 1000, y: 1000 };
  it("osiem kierunków przy osi Y skierowanej w dół (północ = mniejsze Y)", () => {
    const at = (dx: number, dy: number) => compass(o, { x: o.x + dx, y: o.y + dy });
    expect(at(500, 0)).toBe("na wschód");
    expect(at(500, 500)).toBe("na południowy wschód");
    expect(at(0, 500)).toBe("na południe");
    expect(at(-500, 500)).toBe("na południowy zachód");
    expect(at(-500, 0)).toBe("na zachód");
    expect(at(-500, -500)).toBe("na północny zachód");
    expect(at(0, -500)).toBe("na północ");
    expect(at(500, -500)).toBe("na północny wschód");
    expect(compass(o, { x: 1010, y: 1010 })).toBeNull();
  });
  it("czas drogi zaokrągla do 5 s, a bardzo blisko mówi „tuż obok”", () => {
    expect(walkTime(175 * 14)).toBe("ok. 15 s drogi");
    expect(walkTime(10)).toBe("ok. 5 s drogi");
    expect(whereIs(o, { x: 1100, y: 1000 })).toContain("tuż obok");
    expect(whereIs(o, { x: 1000, y: 1000 - 175 * 20 })).toBe("na północ, ok. 20 s drogi");
  });
});

describe("głosy przewodniczek", () => {
  it("cztery kultury mówią różnie, a każda ma kwestię na każdy z sześciu punktów trasy", () => {
    const ids = Object.keys(TOUR_VOICES) as WorldId[];
    expect(ids.sort()).toEqual(["aether", "nexus", "pyra", "verdant"]);
    for (const id of ids) {
      const v = TOUR_VOICES[id];
      expect(v.frames).toHaveLength(6);
      for (const b of BUILDING_IDS) expect(v.flavor[b].length).toBeGreaterThan(10);
      expect(new Set(v.frames.map((f) => f("X", "Y"))).size).toBe(6);
    }
    expect(new Set(ids.map((id) => TOUR_VOICES[id].hello("M", "G")[0])).size).toBe(4);
    for (const b of BUILDING_IDS) expect(SERVICE_FACTS[b].length).toBeGreaterThan(20);
  });
});

describe.each(RACE_IDS.map((r) => RACES[r].world))(
  "plan trasy w mieście %s (prawdziwe dane świata v2)",
  (id) => {
    const land = LANDS[id];
    it.each([...land.cities.keys()])(
      "miasto %s: sześć budynków i rynek, każdy z nazwą i kierunkiem",
      (town) => {
        const c = land.cities.get(town)!;
        const hero = { x: c.market.x + 60, y: c.market.y + 60 };
        const { plan } = planFor(land, town, hero);
        expect(plan.stops).toHaveLength(7);
        expect(plan.stops.at(-1)!.id).toBe("market");
        expect(new Set(plan.stops.slice(0, 6).map((s) => s.id))).toEqual(new Set(BUILDING_IDS));
        for (const stop of plan.stops) {
          const said = stop.announce(hero).join(" ");
          expect(said).toContain(stop.label);
          expect(said).toMatch(/na (północ|południe|wschód|zachód|północny|południowy)|tuż obok/);
          expect(said).toMatch(/s drogi|tuż obok/);
          for (const l of [...stop.announce(hero), ...stop.explain, ...plan.hello])
            expect(l).not.toMatch(/undefined|NaN|\[object/);
          if (stop.id !== "market") expect(stop.explain.length).toBeGreaterThan(0);
          expect(stop.point).toEqual(
            stop.id === "market"
              ? { x: c.market.x, y: c.market.y }
              : c.city.buildings.find((b) => b.id === stop.id)!.door,
          );
        }
      },
    );
    it("kolejność: za każdym razem najbliższy budynek, rynek na końcu", () => {
      const town = [...land.cities.keys()][0]!;
      const c = land.cities.get(town)!;
      const start = { x: c.market.x + 60, y: c.market.y + 60 };
      const { plan } = planFor(land, town, start);
      let at = start;
      const remaining = new Set(plan.stops.slice(0, 6).map((s) => s.id));
      for (const stop of plan.stops.slice(0, 6)) {
        const nearest = Math.min(
          ...[...remaining].map((rid) => distance(at, plan.stops.find((s) => s.id === rid)!.point)),
        );
        expect(distance(at, stop.point)).toBeCloseTo(nearest, 6);
        remaining.delete(stop.id);
        at = stop.point;
      }
    });
  },
);

describe("przewodniczka prowadzi po mieście", () => {
  const land = LANDS.verdant;
  const town = "verdant-capital";
  function director(hero: Point, nav: { path(a: Point, b: Point): Point[] } = straight) {
    const { plan, post, origin } = planFor(land, town, hero);
    return { d: new TourDirector(plan, post, origin, nav), plan, post, origin };
  }

  it("podchodzi, wita, prowadzi do każdego z siedmiu punktów i wraca na posterunek", () => {
    const hero = { ...land.arrival };
    const { d, plan, post } = director(hero);
    expect(d.view.active).toBe(false);
    d.start(hero);
    expect(d.view.active).toBe(true);
    expect(d.view.position).not.toBeNull();
    const out = run(d, hero);
    expect(d.finished).toBe(true);
    expect(d.completed).toBe(true);
    expect(d.view.active).toBe(false);
    expect(d.view.position).toBeNull(); // wróciła na posterunek z danych świata
    expect(out.markers).toEqual(plan.stops.map((s) => s.label));
    expect(out.lines[0]).toBe(plan.hello[0]);
    for (const s of plan.stops) expect(out.lines.join("\n")).toContain(s.label);
    expect(out.lines.join("\n")).toContain(plan.outro[0]);
    expect(out.maxSpeed).toBeLessThanOrEqual(TOUR.approachSpeed * 1.05);
    expect(out.t).toBeLessThan(400_000);
    expect(post).toBeDefined();
  });

  it("używa nawigacji świata: idzie po ścieżce, nie po prostej przez budynki", () => {
    const hero = { ...land.arrival };
    const calls: [Point, Point][] = [];
    const real = {
      path: (a: Point, b: Point) => {
        calls.push([{ ...a }, { ...b }]);
        return land.nav.path(a, b);
      },
    };
    const { d } = director(hero, real);
    d.start(hero);
    const out = run(d, hero);
    expect(d.completed).toBe(true);
    expect(calls.length).toBeGreaterThanOrEqual(8); // podejście + 7 punktów + powrót
    expect(out.maxSpeed).toBeLessThanOrEqual(TOUR.approachSpeed * 1.05);
  });

  it("ogłasza budynek zanim ruszy, a opisuje go dopiero po dojściu do drzwi", () => {
    const hero = { ...land.arrival };
    const { d, plan } = director(hero);
    d.start(hero);
    const first = plan.stops[0]!;
    let announcedAt = -1;
    let explainedAt = -1;
    let arrived = false;
    let t = 0;
    while (!d.finished && t < 200_000) {
      d.tick(50, hero);
      const v = d.view;
      if (v.line?.text.includes(first.label) && announcedAt < 0) announcedAt = t;
      if (v.line && first.explain.includes(v.line.text) && explainedAt < 0) {
        explainedAt = t;
        arrived = distance(v.position!, first.point) <= TOUR.arrive + 5;
      }
      if (v.position && distance(v.position, hero) > 250) {
        const dd = distance(v.position, hero);
        const step = Math.min(dd - 250, 175 * 0.05);
        hero.x += ((v.position.x - hero.x) / dd) * step;
        hero.y += ((v.position.y - hero.y) / dd) * step;
      }
      t += 50;
      if (explainedAt >= 0) break;
    }
    expect(announcedAt).toBeGreaterThanOrEqual(0);
    expect(explainedAt).toBeGreaterThan(announcedAt);
    expect(arrived).toBe(true);
  });

  it("czeka, gdy gracz zostaje daleko, woła i rusza dalej, gdy ten wróci", () => {
    const hero = { ...land.arrival };
    const { d, plan } = director(hero);
    d.start(hero);
    // przejdź wstęp i ogłoszenie pierwszego punktu, potem „zgub” gracza
    let t = 0;
    while (d.view.phase !== "lead" && t < 120_000) {
      d.tick(50, hero);
      t += 50;
    }
    expect(d.view.phase).toBe("lead");
    const far = { x: hero.x + 5000, y: hero.y };
    const frozen = { ...d.view.position! };
    const said: string[] = [];
    for (let i = 0; i < 400; i++) {
      d.tick(50, far);
      if (d.view.line) said.push(d.view.line.text);
    }
    expect(d.view.moving).toBe(false);
    expect(distance(d.view.position!, frozen)).toBeLessThan(260);
    expect(said.some((s) => plan.nag.includes(s))).toBe(true);
    // gracz wraca: pada „ruszamy dalej” i trasa idzie naprzód
    const near = { x: d.view.position!.x + 100, y: d.view.position!.y };
    const seen: string[] = [];
    for (let i = 0; i < 100; i++) {
      d.tick(50, near);
      if (d.view.line) seen.push(d.view.line.text);
    }
    expect(seen).toContain(plan.resume);
  });

  it("pominięcie żegna się jednym zdaniem i wraca na posterunek bez opisywania reszty", () => {
    const hero = { ...land.arrival };
    const { d, plan } = director(hero);
    d.start(hero);
    for (let i = 0; i < 400; i++) d.tick(50, hero);
    expect(d.view.active).toBe(true);
    d.skip();
    expect(d.view.marker).toBeNull();
    const out = run(d, hero, { maxMs: 120_000 });
    expect(d.completed).toBe(true);
    expect(out.lines).toContain(plan.skipped);
    expect(out.lines).not.toContain(plan.outro[0]);
    expect(d.view.position).toBeNull();
  });

  it("w budynku trasa czeka (inne współrzędne), a po wyjściu idzie dalej", () => {
    const hero = { ...land.arrival };
    const { d } = director(hero);
    d.start(hero);
    for (let i = 0; i < 100; i++) d.tick(50, hero);
    const before = JSON.stringify(d.view);
    for (let i = 0; i < 200; i++) d.tick(50, { x: 10, y: 10 }, true);
    expect(JSON.stringify(d.view)).toBe(before);
    expect(d.view.active).toBe(true);
  });

  it("teleport bohatera daleko przerywa trasę bez uznania jej za ukończoną", () => {
    const hero = { ...land.arrival };
    const { d } = director(hero);
    d.start(hero);
    for (let i = 0; i < 200; i++) d.tick(50, hero);
    d.tick(50, { x: hero.x + TOUR.abortDistance + 100, y: hero.y });
    expect(d.finished).toBe(true);
    expect(d.wasAborted).toBe(true);
    expect(d.completed).toBe(false);
    expect(d.view.position).toBeNull();
    expect(d.view.line).toBeNull();
  });

  it("po długiej nieobecności gracza sama kończy oprowadzanie", () => {
    const hero = { ...land.arrival };
    const { d } = director(hero);
    d.start(hero);
    const out = run(d, hero, { follow: false, maxMs: 400_000 });
    // gracz stoi w miejscu: po krótkiej trasie przewodniczka zostaje daleko, czeka i się poddaje
    expect(d.finished).toBe(true);
    expect(d.completed).toBe(true);
    expect(out.lines.length).toBeGreaterThan(2);
  });

  it("można rozpocząć trasę ponownie po zakończeniu (powtórka na żądanie)", () => {
    const hero = { ...land.arrival };
    const { d } = director(hero);
    d.start(hero);
    run(d, hero);
    expect(d.finished).toBe(true);
    d.start(hero);
    expect(d.view.active).toBe(true);
    expect(d.view.phase).toBe("approach");
    const again = run(d, hero);
    expect(d.completed).toBe(true);
    expect(again.markers).toHaveLength(7);
  });
});
