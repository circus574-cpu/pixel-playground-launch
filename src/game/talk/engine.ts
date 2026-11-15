import type { CityDefinition } from "../city/types";
import { distance, type Point } from "../navigation";
import type { WorldId } from "../world/races";
import type { WorldNpc } from "../world/types";
import { FAREWELL, greetingLines } from "./lines";
import { SpeechQueue } from "./speech";
import { talkStore } from "./store";
import { splitBubbles } from "./timing";
import { TourDirector, planTour, type TourNav, type TourPlan, type TourView } from "./tour";

/**
 * Silnik rozmów w świecie. Zastępuje okno rozmowy: postacie mówią dymkami nad głową, kwestie następują same, a gra
 * biegnie dalej. Ten sam silnik prowadzi oprowadzanie nowej postaci po mieście. Czysta logika prezentacji: nie
 * zmienia stanu gry ani nie wysyła poleceń do serwera, więc działa tak samo w grze lokalnej i online.
 */

export type TalkContext = {
  hero: Point;
  /** Bohater jest we wnętrzu budynku (inne współrzędne niż miasto). */
  inside: boolean;
  dead: boolean;
  /** Gra wstrzymana panelem (ekwipunek, mapa): mowa i trasa czekają razem z nią. */
  paused: boolean;
  /** Identyfikator roli rozmówcy albo null. */
  dialogue: string | null;
  dialogueTurn: number;
  npcs: readonly WorldNpc[];
  world: {
    id: WorldId;
    market: { x: number; y: number; label: string; instruction: string };
    city?: CityDefinition | undefined;
  };
  nav: TourNav;
  /** Zadanie „Pierwsze kroki” przewodniczki jeszcze nie przyjęte: nowa postać, której należy się oprowadzanie. */
  newcomer: boolean;
};

/** Przed pierwszą trasą daje chwilę na wczytanie świata i pierwsze spojrzenie na ekran. */
export const TOUR_START_DELAY_MS = 1800;
const GUIDE = "guide";

export class TalkEngine {
  private readonly queues = new Map<string, SpeechQueue>();
  private director: TourDirector | null = null;
  private plan: TourPlan | null = null;
  private previousDialogue: string | null = null;
  private idle = 0;
  private lastCtx: TalkContext | null = null;

  constructor(
    /** Klucz zapisu „trasa ukończona”: postać i miasto, żeby powtórka była możliwa w każdym mieście osobno. */
    private readonly doneKey: (ctx: TalkContext) => string,
    private readonly authoritative = false,
    private readonly storage: Pick<Storage, "getItem" | "setItem"> | null = safeStorage(),
  ) {
    talkStore.handlers = {
      startTour: () => this.startTour(),
      skipTour: () => this.skipTour(),
      say: (npc, lines, append) => this.sayLines(npc, lines, append),
    };
  }

  dispose() {
    this.director = null;
    talkStore.reset();
  }

  // ---- stan zapamiętany ------------------------------------------------------------------------------------------

  private tourDone(ctx: TalkContext): boolean {
    try {
      return this.storage?.getItem(this.doneKey(ctx)) === "done";
    } catch {
      return false;
    }
  }
  private markDone(ctx: TalkContext) {
    try {
      this.storage?.setItem(this.doneKey(ctx), "done");
    } catch {
      /* pamięć przeglądarki bywa niedostępna (tryb prywatny): oprowadzanie powtórzy się następnym razem */
    }
  }

  // ---- polecenia z HUD i sceny -----------------------------------------------------------------------------------

  get tourActive(): boolean {
    return this.director?.view.active ?? false;
  }

  /**
   * Przygotowuje trasę. `from` to miejsce, z którego przewodniczka wychodzi do gracza: drzwi sali zgromadzeń (nowa
   * postać, żeby naprawdę „podeszła”) albo jej posterunek (powtórka na żądanie, gdy gracz stoi przy niej).
   */
  private build(ctx: TalkContext, from: "hall" | "post"): TourDirector | null {
    const guide = ctx.npcs.find((n) => n.id === GUIDE);
    const city = ctx.world.city;
    if (!guide || !city || city.buildings.length === 0) return null;
    this.plan = planTour({
      worldId: ctx.world.id,
      city,
      market: ctx.world.market,
      guideName: guide.name,
      hero: ctx.hero,
    });
    const hall = city.buildings.find((b) => b.id === "hall");
    const post = { x: guide.x, y: guide.y };
    return new TourDirector(
      this.plan,
      post,
      from === "hall" && hall ? { x: hall.door.x, y: hall.door.y } : post,
      ctx.nav,
    );
  }

  /** Rozpoczyna oprowadzanie (na żądanie albo automatycznie). Zwraca false, gdy miasto nie ma przewodniczki. */
  startTour(): boolean {
    const ctx = this.lastCtx;
    if (!ctx || this.tourActive) return false;
    if (!this.director?.staged) {
      const guide = ctx.npcs.find((n) => n.id === GUIDE);
      const nearPost = !!guide && distance(guide, ctx.hero) < 600;
      this.director = this.build(ctx, nearPost ? "post" : "hall");
    }
    if (!this.director) return false;
    this.queues.get(GUIDE)?.clear();
    this.director.start(ctx.hero);
    return true;
  }
  skipTour() {
    this.director?.skip();
  }

  /**
   * Gracz próbuje rozmawiać z przewodniczką, gdy ta prowadzi go po mieście i stoi poza posterunkiem. Rozmowa zwykłym
   * torem nie ma sensu (serwer zna jej posterunek), więc przewodniczka odpowiada, że prowadzi. Zwraca true, gdy
   * obsłużono.
   */
  interceptInteract(npcId: string): boolean {
    if (npcId !== GUIDE || !this.director?.view.position || !this.plan) return false;
    // Przewodniczka czeka przy sali zgromadzeń: zagadnięcie jej posterunku przywołuje ją do gracza.
    if (this.director.staged) return this.startTour();
    const q = this.queue(GUIDE);
    if (!q.busy) q.say(this.plan.busy);
    return true;
  }

  /** Położenie rysowanej przewodniczki, gdy jest poza posterunkiem; dla pozostałych postaci null. */
  placement(npcId: string): { x: number; y: number; facing: Point; moving: boolean } | null {
    if (npcId !== GUIDE) return null;
    const v = this.director?.view;
    return v?.position ? { ...v.position, facing: v.facing, moving: v.moving } : null;
  }
  get marker(): TourView["marker"] {
    return this.director?.view.marker ?? null;
  }

  private queue(npc: string): SpeechQueue {
    let q = this.queues.get(npc);
    if (!q) {
      q = new SpeechQueue(350, 1_000_000 * (this.queues.size + 1));
      this.queues.set(npc, q);
    }
    return q;
  }
  private sayLines(npc: string, lines: string[], append = false) {
    const bubbles = lines.flatMap((l) => splitBubbles(l));
    if (append) this.queue(npc).say(...bubbles);
    else this.queue(npc).sayNow(...bubbles);
  }

  // ---- co klatkę -------------------------------------------------------------------------------------------------

  tick(dtMs: number, ctx: TalkContext) {
    this.lastCtx = ctx;
    if (ctx.paused || !(dtMs > 0)) {
      this.publish(ctx);
      return;
    }
    this.followDialogue(ctx);
    for (const q of this.queues.values()) q.tick(dtMs);
    this.autoStart(dtMs, ctx);
    if (this.director) {
      this.director.tick(dtMs, ctx.hero, ctx.inside);
      if (this.director.finished) {
        if (this.director.completed) this.markDone(ctx);
        this.director = null;
        this.plan = null;
      }
    }
    this.publish(ctx);
  }

  /** Zagadnięcie postaci: wita kwestiami z katalogu. Odejście: krótkie pożegnanie, jeśli gracz jeszcze jest blisko. */
  private followDialogue(ctx: TalkContext) {
    if (ctx.dialogue === this.previousDialogue) return;
    const left = this.previousDialogue;
    this.previousDialogue = ctx.dialogue;
    if (left) {
      const npc = ctx.npcs.find((n) => n.id === left);
      if (npc && !(left === GUIDE && this.director?.view.position))
        this.queue(left).sayNow(FAREWELL);
    }
    if (!ctx.dialogue) return;
    const npc = ctx.npcs.find((n) => n.id === ctx.dialogue);
    if (!npc || (npc.id === GUIDE && this.director?.view.position)) return;
    this.sayLines(npc.id, greetingLines(npc, ctx.dialogueTurn, ctx.world, this.authoritative));
  }

  private autoStart(dt: number, ctx: TalkContext) {
    const city = ctx.world.city;
    const inCity =
      !!city &&
      (!city.bounds ||
        (ctx.hero.x >= city.bounds.x &&
          ctx.hero.x <= city.bounds.x + city.bounds.width &&
          ctx.hero.y >= city.bounds.y &&
          ctx.hero.y <= city.bounds.y + city.bounds.height));
    const eligible =
      ctx.newcomer &&
      !this.tourDone(ctx) &&
      !this.tourActive &&
      inCity &&
      !ctx.inside &&
      !ctx.dead &&
      !ctx.dialogue &&
      ctx.npcs.some((n) => n.id === GUIDE);
    if (!eligible) {
      this.idle = 0;
      return;
    }
    // Od pierwszej klatki przewodniczka czeka przy sali zgromadzeń, żeby miała skąd przyjść do gracza.
    if (!this.director) {
      this.director = this.build(ctx, "hall");
      this.director?.stage(ctx.hero);
    }
    this.idle += dt;
    if (this.idle >= TOUR_START_DELAY_MS) {
      this.idle = 0;
      this.startTour();
    }
  }

  private publish(ctx: TalkContext) {
    const speech: Record<string, { id: number; text: string }> = {};
    for (const [npc, q] of this.queues) {
      const line = q.current;
      if (line) speech[npc] = line;
    }
    const v = this.director?.view;
    if (v?.line) speech[GUIDE] = v.line;
    talkStore.publish({
      speech,
      tour: {
        active: v?.active ?? false,
        step: v?.step ?? 0,
        steps: v?.steps ?? 0,
        displaced: !!v?.position,
      },
    });
    void ctx;
  }
}

function safeStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
