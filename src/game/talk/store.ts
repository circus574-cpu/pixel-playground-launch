import type { SpokenLine } from "./speech";

/**
 * Wspólny stan mowy w świecie dla sceny Phasera (rysuje dymki, przewodniczkę i znacznik) i interfejsu Reacta
 * (napisy dla czytników ekranu, przycisk „Pomiń oprowadzanie”). Silnik rozmów zapisuje, widoki czytają;
 * HUD wywołuje polecenia przez `requestTour`, `skipTour` i `say`, a silnik je odbiera.
 */
export type TalkSnapshot = {
  /** Kto mówi w tej chwili (identyfikator roli NPC w mieście) i co. */
  speech: Readonly<Record<string, SpokenLine>>;
  tour: {
    active: boolean;
    step: number;
    steps: number;
    /** Przewodniczka stoi w tej chwili poza posterunkiem: rozmowa z nią idzie osobną ścieżką. */
    displaced: boolean;
  };
};

export type TalkHandlers = {
  startTour?: () => void;
  skipTour?: () => void;
  say?: (npcId: string, lines: string[], append: boolean) => void;
};

const EMPTY: TalkSnapshot = {
  speech: {},
  tour: { active: false, step: 0, steps: 0, displaced: false },
};

class TalkStore {
  private snapshot: TalkSnapshot = EMPTY;
  private readonly listeners = new Set<() => void>();
  handlers: TalkHandlers = {};

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };
  readonly getSnapshot = () => this.snapshot;

  /** Zapis z silnika. Powiadamia widoki tylko wtedy, gdy coś się faktycznie zmieniło. */
  publish(next: TalkSnapshot) {
    const a = this.snapshot;
    const speechSame =
      Object.keys(next.speech).length === Object.keys(a.speech).length &&
      Object.entries(next.speech).every(([k, v]) => a.speech[k]?.id === v.id);
    const tourSame =
      a.tour.active === next.tour.active &&
      a.tour.step === next.tour.step &&
      a.tour.steps === next.tour.steps &&
      a.tour.displaced === next.tour.displaced;
    if (speechSame && tourSame) return;
    this.snapshot = next;
    for (const l of this.listeners) l();
  }
  reset() {
    this.handlers = {};
    this.publish(EMPTY);
  }

  requestTour() {
    this.handlers.startTour?.();
  }
  skipTour() {
    this.handlers.skipTour?.();
  }
  /** Postać mówi podane kwestie zamiast tego, co jeszcze miała powiedzieć; kolejne dymki następują po sobie same. */
  say(npcId: string, ...lines: string[]) {
    this.handlers.say?.(npcId, lines, false);
  }
  /** Dokłada kwestie na koniec tego, co postać jeszcze mówi (np. opis zadania po powitaniu). */
  append(npcId: string, ...lines: string[]) {
    this.handlers.say?.(npcId, lines, true);
  }
}

export const talkStore = new TalkStore();
