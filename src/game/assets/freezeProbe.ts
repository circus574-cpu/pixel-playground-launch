/** Przyczyny zamrożeń do raportu diagnostyki: czas pieczenia chunków w ostatniej sekundzie (czyta telemetria, zeruje po odczycie). */
let bakeMaxMs = 0;
let bakes = 0;
let slowBakeResolution = 0;
export function recordBake(ms: number, resolution: number) {
  bakes++;
  if (ms > bakeMaxMs) {
    bakeMaxMs = ms;
    slowBakeResolution = resolution;
  }
}
export function takeBakeStats() {
  const out = { bakes, bakeMaxMs: Math.round(bakeMaxMs), bakeResolution: slowBakeResolution };
  bakes = 0;
  bakeMaxMs = 0;
  return out;
}
