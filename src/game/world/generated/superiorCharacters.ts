import { CharacterStore, type CharacterSlot } from "../../characters";
import { newPlayer } from "../../session";
import { normalizeNick, nickError } from "../../nickname";
import { RACES, type RaceId } from "../races";
import { SuperiorSaveStore, type SuperiorIndex } from "./superiorSave";
import { WORLD_INDEX as worldIndex, WORLD_NAMESPACE } from "./worldVersion";

export const superiorIndex = worldIndex as SuperiorIndex;
/** Owner-authorized reset: old slots remain archival, never active or migrated. */
export class SuperiorCharacterStore extends CharacterStore {
  constructor(
    private readonly port: Storage,
    base: string,
  ) {
    super(port, base + WORLD_NAMESPACE);
  }
  override list(): CharacterSlot[] {
    const slots: CharacterSlot[] = [];
    try {
      for (let i = 0; i < this.port.length; i++) {
        const key = this.port.key(i);
        if (!key?.startsWith(this.prefix)) continue;
        const save = new SuperiorSaveStore(this.port, key, superiorIndex, "verdant");
        slots.push({
          id: key.slice(this.prefix.length),
          key,
          player: save.load(),
          warning: save.warning,
        });
      }
    } catch {
      this.warning = "Pamięć urządzenia jest niedostępna. Nie można odczytać postaci.";
    }
    return slots.sort((a, b) => a.id.localeCompare(b.id));
  }
  override create(race: RaceId, nick = ""): CharacterSlot | undefined {
    try {
      if (nickError(nick)) throw Error("Invalid nickname");
      const id = crypto.randomUUID(),
        key = this.prefix + id;
      if (this.port.getItem(key) !== null) throw Error("Slot collision");
      const feature = superiorIndex.features.find((f) => f.id === RACES[race].world)!;
      const save = new SuperiorSaveStore(this.port, key, superiorIndex, feature.id);
      save.load();
      const player = { ...newPlayer(race), ...feature.arrival };
      if (normalizeNick(nick)) player.name = normalizeNick(nick);
      if (!save.save(player)) throw Error(save.warning);
      return { id, key, player, warning: "" };
    } catch {
      this.warning = "Nie udało się utworzyć postaci. Sprawdź pamięć lokalną.";
      return undefined;
    }
  }
}
