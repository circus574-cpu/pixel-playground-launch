import type { TrainableStat } from "../combatTraining";
import type { Discipline } from "./training";
import type { WorldId } from "../world/races";

/**
 * Etap 1 (Partia 1 + Partia 2 P0) development asset lookup.
 * Guarded by the opt-in `?ki-dev-art=1` review switch (`START-TUTAJ.txt`) so
 * candidate v001 assets never overwrite default presentation before owner acceptance.
 */
export function devArtEnabled(
  search = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  return new URLSearchParams(search).get("ki-dev-art") === "1";
}

export const TRAINING_DISCIPLINE_ICONS: Record<Discipline | TrainableStat, string> = {
  strength: "/game/development-v1/icons/ui.training.strength.webp",
  endurance: "/game/icons-v3/legend-B5.webp",
  kiCapacity: "/game/icons-v3/material-rdzen-energii.webp",
  defense: "/game/icons-v3/status-armor.webp",
  kiControl: "/game/icons-v3/sage-C8.webp",
  dodge: "/game/icons-v3/planetary-A2.webp",
  attackSpeed: "/game/icons-v3/legend-A3.webp",
  technique: "/game/icons-v3/sage-A6.webp",
};

export function examTierIconUrl(tier: number): string | undefined {
  if (!Number.isInteger(tier) || tier < 1 || tier > 6) return undefined;
  return `/game/development-v1/icons/ui.exam.tier-${tier}.webp`;
}

export const VERDANTIA_TRAINING_OBJECTS = {
  "training.planetary.dummy": "/game/development-v1/objects/training.planetary.dummy.webp",
  "training.planetary.target": "/game/development-v1/objects/training.planetary.target.webp",
  "training.planetary.ki-node": "/game/development-v1/objects/training.planetary.ki-node.webp",
  "training.planetary.defense": "/game/development-v1/objects/training.planetary.defense.webp",
} as const;

export function trainingObjectUrl(
  world: WorldId,
  kind: "dummy" | "target" | "ki-node" | "defense",
): string | undefined {
  if (world !== "verdant") return undefined;
  return VERDANTIA_TRAINING_OBJECTS[`training.planetary.${kind}`];
}
