import { GameSession, SaveStore, type Player } from "./session";
import { RACES, type RaceId } from "./world/races";
import { normalizeNick, nickError } from "./nickname";

export type CharacterSlot = {
  id: string;
  key: string;
  player?: Player | undefined;
  warning: string;
};
const LEGACY_REMOVED = ":legacy-removed";
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
      if (
        legacy !== null &&
        this.storage.getItem(this.base + LEGACY_REMOVED) === null &&
        this.storage.getItem(this.prefix + "legacy") === null
      )
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
  create(race: RaceId, nick = ""): CharacterSlot | undefined {
    try {
      if (nickError(nick)) throw new Error("invalid nickname");
      const id = crypto.randomUUID(),
        key = this.prefix + id;
      if (this.storage.getItem(key) !== null) throw new Error("slot collision");
      const game = new GameSession(new SaveStore(this.storage, key), race);
      if (normalizeNick(nick)) game.player.name = normalizeNick(nick);
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
  /**
   * Deletes one valid character. Slots that failed validation (damaged or newer saves) are
   * never removed. The Stage 2 original under `base` is left untouched; removing its copy leaves
   * a marker so the copy is not recreated.
   */
  remove(slot: CharacterSlot): boolean {
    if (!slot.player || !slot.key.startsWith(this.prefix)) return false;
    try {
      if (slot.id === "legacy") this.storage.setItem(this.base + LEGACY_REMOVED, "1");
      this.storage.removeItem(slot.key);
      if (this.storage.getItem(this.base + ":active-character") === slot.id)
        this.storage.setItem(this.base + ":active-character", "");
      return true;
    } catch {
      this.warning = "Nie udało się usunąć postaci. Zapis pozostał bez zmian.";
      return false;
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
    ? `${slot.player.name ? slot.player.name + " · " : ""}${RACES[slot.player.race].name} · poziom ${slot.player.level}`
    : "Zapis wymagający odzyskania";
