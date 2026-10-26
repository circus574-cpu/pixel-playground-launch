/** CPU/visual limits, independent of canonical balance. */
export const COMBAT_BUDGET = Object.freeze({
  activeEnemies: 32,
  aiRadius: 1800,
  zones: 64,
  visuals: 96,
});
/** Bounded lifetime registry. Dispose the oldest decoration, preserving warnings first. */
export class CombatVisualBudget {
  private entries: { dispose: () => void; critical: boolean }[] = [];
  constructor(readonly limit: number = COMBAT_BUDGET.visuals) {}
  add(dispose: () => void, critical = false) {
    if (this.entries.length >= this.limit) {
      const index = this.entries.findIndex((e) => !e.critical);
      if (index < 0 && !critical) {
        dispose();
        return () => {};
      }
      const [old] = this.entries.splice(index < 0 ? 0 : index, 1);
      old?.dispose();
    }
    const entry = { dispose, critical };
    this.entries.push(entry);
    return () => {
      const i = this.entries.indexOf(entry);
      if (i >= 0) this.entries.splice(i, 1);
    };
  }
  get size() {
    return this.entries.length;
  }
  clear() {
    const entries = this.entries.splice(0);
    for (const e of entries) e.dispose();
  }
}
