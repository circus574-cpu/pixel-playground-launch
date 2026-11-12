/** Isolated rescue terminal. It has no authority over the owner's character or memory. */
export class RecoveryUnit {
  private stage = 0;
  private readonly original = "training-memory:read-only:archive-42";
  private memory = this.original;
  private isolated = false;
  private backup = false;
  private powered = false;
  private linked = false;
  readonly steps: readonly string[];
  constructor(tier: 1 | 2 | 3) {
    this.steps = [
      "Odłącz uszkodzony obwód",
      ...(tier >= 2 ? ["Zabezpiecz kopię pamięci"] : []),
      "Przełącz bezpieczne zasilanie bez resetu",
      ...(tier === 3 ? ["Przywróć bezpieczne połączenie"] : []),
    ];
  }
  execute(action: string) {
    if (action !== this.steps[this.stage] || this.memory !== this.original) return false;
    if (action === "Odłącz uszkodzony obwód") this.isolated = true;
    else if (action === "Zabezpiecz kopię pamięci" && this.isolated) this.backup = true;
    else if (
      action === "Przełącz bezpieczne zasilanie bez resetu" &&
      this.isolated &&
      (this.steps.length === 2 || this.backup)
    )
      this.powered = true;
    else if (action === "Przywróć bezpieczne połączenie" && this.powered && this.backup)
      this.linked = true;
    else return false;
    this.stage++;
    return true;
  }
  snapshot() {
    return {
      stage: this.stage,
      isolated: this.isolated,
      backup: this.backup,
      powered: this.powered,
      linked: this.linked,
      memoryIntact: this.memory === this.original,
      complete: this.stage === this.steps.length && this.powered && this.memory === this.original,
    };
  }
}
