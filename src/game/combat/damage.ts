/** Deduplicate within a logical action; completed actions are retired by their owner. */
export class DamageLedger {
  private hits = new Map<string, Set<string>>();
  resolve(action: string, source: string, target: string, apply: () => number): number {
    const key = `${source}:${action}`;
    let targets = this.hits.get(key);
    if (!targets) {
      targets = new Set();
      this.hits.set(key, targets);
    }
    if (targets.has(target)) return 0;
    targets.add(target); // Reserve before applying: reflected/reentrant events cannot duplicate it.
    return apply();
  }
  retire(action: string, source: string) {
    this.hits.delete(`${source}:${action}`);
  }
}
