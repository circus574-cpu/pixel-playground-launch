import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { RACES, RACE_IDS, type WorldId } from "../game/world/races";
import { browserNavigation, type GridData } from "../game/world/generated/browserTerrain";
import {
  buildSuperiorSimulationWorld,
  type SuperiorSimulationSource,
} from "../game/world/generated/simulationWorld";
import type { SuperiorIndex } from "../game/world/generated/superiorSave";
import type { Obstacle } from "../game/movement";
import { distance, type Point } from "../game/navigation";
import { TOUR_START_DELAY_MS, TalkEngine, type TalkContext } from "../game/talk/engine";
import { talkStore } from "../game/talk/store";
import { FAREWELL } from "../game/talk/lines";
import { readingMs } from "../game/talk/timing";

const root = "public/game/worlds/superior-v2";
const index = JSON.parse(readFileSync(root + "/index.json", "utf8")) as SuperiorIndex;

function land(id: WorldId) {
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
  const capital = built.cities.get(id + "-capital")!;
  return { id, nav, capital, spawn: built.world.spawn };
}
const LANDS = Object.fromEntries(
  RACE_IDS.map((r) => [RACES[r].world, land(RACES[r].world)]),
) as Record<WorldId, ReturnType<typeof land>>;

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

function ctxFor(id: WorldId, over: Partial<TalkContext> = {}, hero?: Point): TalkContext {
  const l = LANDS[id];
  return {
    hero: { ...(hero ?? l.spawn) },
    inside: false,
    dead: false,
    paused: false,
    dialogue: null,
    dialogueTurn: 0,
    npcs: l.capital.npcs,
    world: { id, market: l.capital.market, city: l.capital.city },
    nav: l.nav,
    newcomer: true,
    ...over,
  };
}

/** Silnik w grze: bohater idzie za przewodniczką, jak gracz, który słucha. */
function play(engine: TalkEngine, id: WorldId, over: Partial<TalkContext> = {}, maxMs = 400_000) {
  const ctx = ctxFor(id, over);
  const spoken: string[] = [];
  let t = 0;
  let last = -1;
  /** Odległość przewodniczki od gracza w chwili jej pierwszej kwestii: dowodzi, że podeszła, a nie mówiła z daleka. */
  let firstLineDistance: number | null = null;
  let startedAt: Point | null = null;
  while (t < maxMs) {
    engine.tick(50, ctx);
    const snap = talkStore.getSnapshot();
    const g = snap.speech["guide"];
    if (g && g.id !== last) {
      last = g.id;
      spoken.push(g.text);
      if (firstLineDistance === null) {
        const here = engine.placement("guide")!;
        firstLineDistance = distance(here, ctx.hero);
      }
    }
    if (startedAt === null && engine.tourActive) startedAt = engine.placement("guide");
    const place = engine.placement("guide");
    if (place && distance(place, ctx.hero) > 250) {
      const d = distance(place, ctx.hero);
      const step = Math.min(d - 250, 175 * 0.05);
      ctx.hero.x += ((place.x - ctx.hero.x) / d) * step;
      ctx.hero.y += ((place.y - ctx.hero.y) / d) * step;
    }
    t += 50;
    if (!engine.tourActive && t > TOUR_START_DELAY_MS + 2000 && !engine.placement("guide")) break;
  }
  return { ctx, spoken, t, firstLineDistance, startedAt };
}

beforeEach(() => talkStore.reset());

describe("przewodniczka podchodzi do nowej postaci w stolicy każdej z czterech ras", () => {
  it.each(RACE_IDS.map((r) => RACES[r].world))(
    "%s: czeka przy sali zgromadzeń, podchodzi, prowadzi i wraca",
    (id) => {
      const storage = memory();
      const engine = new TalkEngine((c) => "tour:" + c.world.city?.name, false, storage);
      const first = ctxFor(id);
      engine.tick(50, first);
      // od pierwszej klatki nie stoi obok gracza na posterunku, tylko przy drzwiach sali zgromadzeń
      const hall = LANDS[id].capital.city.buildings.find((b) => b.id === "hall")!;
      const placed = engine.placement("guide")!;
      expect(placed).not.toBeNull();
      expect(distance(placed, hall.door)).toBeLessThan(2);
      expect(engine.tourActive).toBe(false);
      expect(talkStore.getSnapshot().tour.displaced).toBe(true);

      const out = play(engine, id);
      expect(out.spoken.length).toBeGreaterThan(20);
      // przed startem nie mówi nic; pierwsza kwestia pada dopiero, gdy podeszła do gracza (z drzwi sali zgromadzeń)
      expect(out.spoken[0]).toContain(LANDS[id].capital.city.name);
      expect(distance(out.startedAt!, hall.door)).toBeLessThan(15); // pierwszy krok trasy (230 jedn./s)
      expect(distance(hall.door, LANDS[id].spawn)).toBeGreaterThan(400); // miała kawałek do przejścia
      expect(out.firstLineDistance!).toBeLessThanOrEqual(200);
      for (const b of LANDS[id].capital.city.buildings)
        expect(out.spoken.join("\n")).toContain(b.name);
      expect(engine.placement("guide")).toBeNull(); // wróciła na posterunek
      expect(talkStore.getSnapshot().tour.active).toBe(false);
      expect([...storage.data.values()]).toEqual(["done"]);

      // po ukończeniu trasa się nie powtarza sama
      const again = new TalkEngine((c) => "tour:" + c.world.city?.name, false, storage);
      again.tick(50, ctxFor(id));
      expect(again.placement("guide")).toBeNull();
    },
  );

  it("trasa startuje dopiero po chwili od pierwszej klatki, nie od razu", () => {
    const engine = new TalkEngine(() => "k", false, memory());
    const ctx = ctxFor("verdant");
    let started = -1;
    for (let t = 0; t < TOUR_START_DELAY_MS + 1000; t += 50) {
      engine.tick(50, ctx);
      if (engine.tourActive && started < 0) started = t;
    }
    expect(started).toBeGreaterThanOrEqual(TOUR_START_DELAY_MS - 100);
  });

  it("postać, która już gra (zadanie przyjęte), nie dostaje trasy sama, ale może ją zamówić", () => {
    const engine = new TalkEngine(() => "k", false, memory());
    const ctx = ctxFor("verdant", { newcomer: false });
    for (let t = 0; t < TOUR_START_DELAY_MS + 3000; t += 50) engine.tick(50, ctx);
    expect(engine.tourActive).toBe(false);
    expect(engine.placement("guide")).toBeNull();
    expect(talkStore.getSnapshot().tour.displaced).toBe(false);
    talkStore.requestTour(); // przycisk „Oprowadź mnie po mieście”
    engine.tick(50, ctx);
    expect(engine.tourActive).toBe(true);
    expect(talkStore.getSnapshot().tour.active).toBe(true);
    expect(talkStore.getSnapshot().tour.steps).toBe(7);
  });

  it("przerwanie przyciskiem „Pomiń oprowadzanie” kończy trasę i zapamiętuje ją jako ukończoną", () => {
    const storage = memory();
    const engine = new TalkEngine(() => "k", false, storage);
    const ctx = ctxFor("pyra");
    for (let t = 0; t < TOUR_START_DELAY_MS + 8000; t += 50) engine.tick(50, ctx);
    expect(engine.tourActive).toBe(true);
    talkStore.skipTour();
    for (let t = 0; t < 120_000 && engine.tourActive; t += 50) engine.tick(50, ctx);
    for (let t = 0; t < 60_000 && engine.placement("guide"); t += 50) engine.tick(50, ctx);
    expect(engine.placement("guide")).toBeNull();
    expect(storage.data.get("k")).toBe("done");
  });

  it("wnętrze budynku lub pauza wstrzymują trasę razem z grą", () => {
    const engine = new TalkEngine(() => "k", false, memory());
    const ctx = ctxFor("aether");
    for (let t = 0; t < TOUR_START_DELAY_MS + 6000; t += 50) engine.tick(50, ctx);
    const before = JSON.stringify(engine.placement("guide"));
    const lineBefore = talkStore.getSnapshot().speech["guide"]?.id;
    for (let t = 0; t < 5000; t += 50) engine.tick(50, { ...ctx, paused: true });
    for (let t = 0; t < 5000; t += 50) engine.tick(50, { ...ctx, inside: true });
    expect(JSON.stringify(engine.placement("guide"))).toBe(before);
    expect(talkStore.getSnapshot().speech["guide"]?.id).toBe(lineBefore);
  });
});

describe("kliknięcie przewodniczki w trakcie trasy", () => {
  it("zagadnięcie jej posterunku przed startem przywołuje ją, w trakcie trasy odpowiada, że prowadzi", () => {
    const engine = new TalkEngine(() => "k", false, memory());
    const ctx = ctxFor("nexus");
    engine.tick(50, ctx);
    expect(engine.interceptInteract("hunter")).toBe(false); // inne postacie rozmawiają zwykłym torem
    expect(engine.interceptInteract("guide")).toBe(true);
    expect(engine.tourActive).toBe(true);
    for (let t = 0; t < 12_000; t += 50) engine.tick(50, ctx);
    expect(engine.interceptInteract("guide")).toBe(true);
    for (let t = 0; t < 1000; t += 50) engine.tick(50, ctx);
    expect(talkStore.getSnapshot().speech["guide"]).toBeDefined();
  });
  it("po zakończeniu trasy przewodniczka rozmawia zwykłym torem", () => {
    const engine = new TalkEngine(() => "k", false, memory());
    play(engine, "verdant");
    expect(engine.interceptInteract("guide")).toBe(false);
  });
});

describe("zwykła rozmowa: dymki bez okna i bez zatrzymania gry", () => {
  it("rozmówca wita kolejnymi dymkami w tempie czytania, a po odejściu żegna się", () => {
    const engine = new TalkEngine(() => "k", false, memory());
    const base = ctxFor("verdant", { newcomer: false });
    const merchant = base.npcs.find((n) => n.id === "merchant")!;
    engine.tick(50, base);
    expect(talkStore.getSnapshot().speech["merchant"]).toBeUndefined();
    const talking = { ...base, dialogue: "merchant", dialogueTurn: 1 };
    engine.tick(50, talking);
    engine.tick(50, talking);
    const first = talkStore.getSnapshot().speech["merchant"]!;
    expect(first.text.length).toBeGreaterThan(5);
    // następna kwestia dopiero po czasie czytania pierwszej
    let seen = [first.text];
    for (let t = 0; t < readingMs(first.text) + 1500; t += 50) {
      engine.tick(50, talking);
      const s = talkStore.getSnapshot().speech["merchant"];
      if (s && s.text !== seen.at(-1)) seen.push(s.text);
    }
    expect(seen.length).toBeGreaterThanOrEqual(1);
    engine.tick(50, { ...base, dialogue: null });
    for (let i = 0; i < 4; i++) engine.tick(50, { ...base, dialogue: null });
    expect(talkStore.getSnapshot().speech["merchant"]?.text).toBe(FAREWELL);
    expect(merchant).toBeDefined();
    seen = [];
  });

  it("HUD może dołożyć kwestię (zadanie) po powitaniu albo zastąpić resztę", () => {
    const engine = new TalkEngine(() => "k", false, memory());
    const base = ctxFor("verdant", { newcomer: false, dialogue: "hunter", dialogueTurn: 1 });
    engine.tick(50, base);
    engine.tick(50, base);
    const greeting = talkStore.getSnapshot().speech["hunter"]!.text;
    talkStore.append("hunter", "Dołożona kwestia o zadaniu.");
    // po powitaniu (i jego kolejnym zdaniu) dochodzi dołożona
    const said: string[] = [greeting];
    for (let t = 0; t < 60_000; t += 50) {
      engine.tick(50, base);
      const s = talkStore.getSnapshot().speech["hunter"];
      if (s && s.text !== said.at(-1)) said.push(s.text);
    }
    expect(said).toContain("Dołożona kwestia o zadaniu.");
    talkStore.say("hunter", "Zastępcza.");
    engine.tick(50, base);
    engine.tick(50, base);
    expect(talkStore.getSnapshot().speech["hunter"]?.text).toBe("Zastępcza.");
  });

  it("w pauzie (panel) kwestie stoją, a bieżąca zostaje widoczna", () => {
    const engine = new TalkEngine(() => "k", false, memory());
    const base = ctxFor("verdant", { newcomer: false, dialogue: "merchant", dialogueTurn: 1 });
    engine.tick(50, base);
    engine.tick(50, base);
    const id = talkStore.getSnapshot().speech["merchant"]!.id;
    for (let t = 0; t < 30_000; t += 50) engine.tick(50, { ...base, paused: true });
    expect(talkStore.getSnapshot().speech["merchant"]!.id).toBe(id);
  });
});
