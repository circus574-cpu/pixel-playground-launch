/** Renderer-independent clock. Overload drops whole steps, never fractional time. */
export class CombatClock {
  readonly stepMs = 1000 / 60;
  readonly maximumSteps = 8;
  private accumulator = 0;
  droppedMs = 0;
  ticks = 0;
  advance(elapsed: number, step: (dt: number) => void): number {
    if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
    this.accumulator += elapsed;
    const available = Math.floor((this.accumulator + 1e-7) / this.stepMs);
    const count = Math.min(available, this.maximumSteps);
    this.accumulator = Math.max(0, this.accumulator - available * this.stepMs);
    this.droppedMs += (available - count) * this.stepMs;
    for (let i = 0; i < count; i++) {
      this.ticks++;
      step(this.stepMs);
    }
    return count * this.stepMs;
  }
  reset() {
    this.accumulator = 0;
  }
}
