/**
 * Czas, przez który kwestia mówiona w świecie (dymek nad postacią) zostaje na ekranie, zanim przejdzie następna.
 * Rozmowa nigdy nie zatrzymuje gry, więc zamiast „kliknij, aby dalej” kwestie następują same, w tempie czytania.
 * Czysta funkcja: bez zegara, DOM i Phasera.
 */
export const READING_MIN_MS = 2400;
export const READING_MAX_MS = 9000;
/** Około 15 znaków na sekundę (wolniejsze niż średnie czytanie, bo gracz jednocześnie steruje postacią). */
export const READING_MS_PER_CHAR = 62;

export function readingMs(text: string): number {
  const n = [...text.trim()].length;
  return Math.min(READING_MAX_MS, Math.max(READING_MIN_MS, 900 + n * READING_MS_PER_CHAR));
}

/** Najdłuższy dymek (znaki): dłuższy tekst dzieli się na kolejne dymki na granicy zdań. */
export const BUBBLE_MAX_CHARS = 130;

/**
 * Dzieli tekst na dymki na granicy zdań. Skrót „ok. 15 s” nie kończy zdania, bo po kropce nie następuje wielka litera
 * ani cudzysłów. Zdania łączy się, dopóki dymek mieści się w `BUBBLE_MAX_CHARS`.
 */
export function splitBubbles(text: string, max = BUBBLE_MAX_CHARS): string[] {
  const sentences = text
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ„"])/u)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const sentence of sentences) {
    const last = out[out.length - 1];
    if (last !== undefined && [...last].length + 1 + [...sentence].length <= max)
      out[out.length - 1] = last + " " + sentence;
    else out.push(sentence);
  }
  return out;
}
