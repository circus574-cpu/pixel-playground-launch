import { z } from "zod";
import {
  PlayerSchema,
  SaveStore,
  stats,
  xpNeeded,
  type Player,
  type StoragePort,
} from "../../session";
import { validLearned } from "../../kit";
import { isMaterial } from "../../monsters/materials";
import { RACES, type WorldId } from "../races";

export const FEATURE_IDS = [
  "verdant",
  "aether",
  "nexus",
  "pyra",
  "island-1",
  "island-2",
  "island-3",
  "island-4",
  "island-5",
  "island-6",
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];
export type FeatureInfo = {
  id: FeatureId;
  name: string;
  affinity: WorldId;
  width: number;
  height: number;
  arrival: { x: number; y: number };
  worldSha256: string;
};
export type SuperiorIndex = {
  format: "superior-runtime-1";
  revision: string;
  features: FeatureInfo[];
};
const coordinate = z.number().finite().min(0).max(131072);
const player = PlayerSchema.extend({ x: coordinate, y: coordinate });
const spawnRecord = z.object({
  hp: z.number().finite().min(0).max(1000000),
  deadUntil: z.number().finite().min(0),
  kind: z.string().max(120),
  revived: z.boolean().optional(),
});
const envelope = z.object({
  format: z.literal("superior-expedition"),
  version: z.literal(1),
  revision: z.string(),
  geometry: z.string(),
  feature: z.enum(FEATURE_IDS),
  town: z.string().max(120).nullable(),
  player,
  spawns: z.record(z.string().max(180), spawnRecord).default({}),
});
export type SpawnRecord = z.infer<typeof spawnRecord>;

/** Separate CAS-protected expedition save. Never reads or migrates the accepted character slot. */
export class SuperiorSaveStore extends SaveStore {
  private previous: string | null = null;
  private allowed = true;
  private travelling = false;
  feature: FeatureId;
  town: string | null = null;
  spawns: Record<string, SpawnRecord> = {};
  beforeSave: (() => void) | undefined;
  constructor(
    private readonly port: StoragePort | null,
    private readonly expeditionKey: string,
    private readonly index: SuperiorIndex,
    initial: FeatureId,
  ) {
    super(null);
    this.feature = initial;
  }
  override load(): Player | undefined {
    try {
      if (!this.port) throw Error("Storage unavailable");
      const raw = this.port.getItem(this.expeditionKey);
      this.previous = raw;
      if (raw === null) return undefined;
      if (raw.length > 4_000_000) throw Error("Oversized expedition");
      const value = envelope.parse(JSON.parse(raw));
      if (Object.keys(value.spawns).length > 10000) throw Error("Oversized spawn ledger");
      const info = this.index.features.find((f) => f.id === value.feature);
      const p = value.player;
      if (
        !info ||
        value.geometry !== this.index.revision ||
        p.continent !== info.affinity ||
        p.startContinent !== RACES[p.race].world ||
        p.x > info.width ||
        p.y > info.height ||
        p.xp >= xpNeeded(p.level) ||
        (p.weapon && !p.items.sword) ||
        (p.armor && !p.items.vest) ||
        !validLearned(p.race, p.level, p.skills) ||
        !p.skills.includes("R") ||
        Object.keys(p.materials).some((k) => !isMaterial(k)) ||
        Object.keys(p.depot.materials).some((k) => !isMaterial(k)) ||
        Object.keys(p.materials).length > 30 ||
        Object.keys(p.depot.materials).length > 30 ||
        (p.depot.upgrade > 0 && !p.depot.items.sword) ||
        (p.interior && (p.x > 960 || p.y > 760 || !value.town)) ||
        (p.quests.boars !== "locked" && p.quests.steps !== "done") ||
        (p.quests.gear !== "locked" && p.quests.boars !== "done")
      )
        throw Error("Inconsistent expedition");
      this.feature = value.feature;
      this.town = value.town;
      this.spawns = value.spawns;
      const s = stats(p);
      p.hp = Math.min(p.hp, s.maxHp);
      p.ki = Math.min(p.ki, s.maxKi);
      return structuredClone(p);
    } catch {
      this.allowed = false;
      this.warning =
        "Nie można odczytać zapisu wyprawy. Oryginał zachowano; zapisywanie tej sesji jest wyłączone.";
      return undefined;
    }
  }
  override save(p: Player): boolean {
    if (this.travelling || !this.allowed || !this.port) return false;
    try {
      this.beforeSave?.();
      if (this.port.getItem(this.expeditionKey) !== this.previous) {
        this.allowed = false;
        this.warning = "Wyprawa zmieniła się w innej karcie. Ta karta nie nadpisze postępu.";
        return false;
      }
      const value = envelope.parse({
        format: "superior-expedition",
        version: 1,
        revision: crypto.randomUUID(),
        geometry: this.index.revision,
        feature: this.feature,
        town: this.town,
        player: p,
        spawns: this.spawns,
      });
      const raw = JSON.stringify(value);
      this.port.setItem(this.expeditionKey, raw);
      this.previous = raw;
      return true;
    } catch {
      this.warning = "Nie udało się zapisać wyprawy. Sprawdź dostępną pamięć przeglądarki.";
      return false;
    }
  }
  travel(p: Player, destination: FeatureInfo): boolean {
    const old = this.feature,
      town = this.town;
    this.feature = destination.id;
    this.town = null;
    const next = {
      ...structuredClone(p),
      continent: destination.affinity,
      interior: null,
      x: destination.arrival.x,
      y: destination.arrival.y,
    };
    if (!this.save(next)) {
      this.feature = old;
      this.town = town;
      return false;
    }
    // Cleanup of the outgoing Phaser scene must not write its previous position back.
    this.travelling = true;
    return true;
  }
}
