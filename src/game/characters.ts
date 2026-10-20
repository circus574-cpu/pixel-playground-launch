import { GameSession, SaveStore, type Player } from "./session";
import { RACES, type RaceId } from "./world/races";

export type CharacterSlot = {
  id: string;
  key: string;
  player?: Player | undefined;
  warning: string;
};
/** No shared mutable slot index: each UUID key is independent, including across tabs. */
export class CharacterStore {
  readonly prefix: string;
  warning = "";
  constructor(
    private storage: Storage,
    readonly base: string,
  ) {
    this.prefix = base + ":character:";
  }
  list(): CharacterSlot[] {
    const slots: CharacterSlot[] = [];
    try {
      // Copy once, byte-for-byte. The old key remains untouched and recoverable.
      const legacy = this.storage.getItem(this.base);
      if (legacy !== null && this.storage.getItem(this.prefix + "legacy") === null)
        this.storage.setItem(this.prefix + "legacy", legacy);
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (!key?.startsWith(this.prefix)) continue;
        const save = new SaveStore(this.storage, key);
        const player = save.load();
        slots.push({ id: key.slice(this.prefix.length), key, player, warning: save.warning });
      }
    } catch {
      this.warning =
        "Pamięć urządzenia jest niedostępna. Nie można bezpiecznie otworzyć listy postaci.";
    }
    return slots.sort((a, b) =>
      a.id === "legacy" ? -1 : b.id === "legacy" ? 1 : a.id.localeCompare(b.id),
    );
  }
  create(race: RaceId): CharacterSlot | undefined {
    try {
      const id = crypto.randomUUID(),
        key = this.prefix + id;
      if (this.storage.getItem(key) !== null) throw new Error("slot collision");
      const game = new GameSession(new SaveStore(this.storage, key), race);
      game.flush();
      if (game.saves?.warning || !this.storage.getItem(key)) throw new Error("save failed");
      return { id, key, player: game.player, warning: "" };
    } catch {
      this.warning = "Nie udało się utworzyć zapisu. Zwolnij miejsce lub zezwól na pamięć lokalną.";
      return undefined;
    }
  }
  active(): CharacterSlot | undefined {
    try {
      const id = this.storage.getItem(this.base + ":active-character");
      return this.list().find((s) => s.id === id && s.player);
    } catch {
      return undefined;
    }
  }
  select(slot: CharacterSlot | null) {
    try {
      this.storage.setItem(this.base + ":active-character", slot?.id ?? "");
    } catch {
      this.warning = "Nie udało się zapamiętać wybranej postaci.";
    }
  }
}
export const slotTitle = (slot: CharacterSlot) =>
  slot.player
    ? `${RACES[slot.player.race].name} · poziom ${slot.player.level}`
    : "Zapis wymagający odzyskania";
