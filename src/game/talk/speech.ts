import { readingMs } from "./timing";

export type SpokenLine = { id: number; text: string };

/**
 * Kolejka kwestii jednej postaci. Każda kwestia zostaje widoczna tyle, ile zajmuje jej przeczytanie, potem następuje
 * krótka przerwa i kolejna. Nic nie czeka na kliknięcie: rozmowa toczy się w tle, a gracz steruje postacią.
 */
export class SpeechQueue {
  private queue: string[] = [];
  private line: SpokenLine | null = null;
  private left = 0;
  private gap = 0;
  private seq = 0;
  /** `idBase` rozdziela numery kwestii różnych kolejek, żeby widok mógł je porównywać bez nazwy postaci. */
  constructor(
    private readonly gapMs = 350,
    idBase = 0,
  ) {
    this.seq = idBase;
  }

  say(...lines: string[]) {
    for (const l of lines) if (l.trim()) this.queue.push(l);
  }
  /** Zastępuje wszystko, co postać jeszcze miała powiedzieć. */
  sayNow(...lines: string[]) {
    this.clear();
    this.say(...lines);
  }
  clear() {
    this.queue = [];
    this.line = null;
    this.left = 0;
    this.gap = 0;
  }
  /** Czy postać mówi albo ma jeszcze coś do powiedzenia. */
  get busy() {
    return this.line !== null || this.queue.length > 0;
  }
  get current(): SpokenLine | null {
    return this.line ? { ...this.line } : null;
  }
  /** Czy bieżąca kwestia jest ostatnią (po niej cisza). */
  get onLast() {
    return this.line !== null && this.queue.length === 0;
  }
  tick(dtMs: number) {
    if (!(dtMs > 0)) return;
    if (this.line) {
      this.left -= dtMs;
      if (this.left <= 0) {
        this.line = null;
        this.gap = this.gapMs;
      }
      return;
    }
    if (this.gap > 0) {
      this.gap -= dtMs;
      return;
    }
    const next = this.queue.shift();
    if (next !== undefined) {
      this.line = { id: ++this.seq, text: next };
      this.left = readingMs(next);
    }
  }
}
