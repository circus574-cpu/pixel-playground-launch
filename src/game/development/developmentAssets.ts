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
  endurance: "/game/development-v1/icons/ui.training.endurance.webp",
  kiCapacity: "/game/development-v1/icons/ui.training.ki-capacity.webp",
  defense: "/game/development-v1/icons/ui.training.defense.webp",
  kiControl: "/game/development-v1/icons/ui.training.ki-control.webp",
  dodge: "/game/development-v1/icons/ui.training.dodge.webp",
  attackSpeed: "/game/development-v1/icons/ui.training.attack-speed.webp",
  technique: "/game/development-v1/icons/ui.training.technique.webp",
};

export function examTierIconUrl(tier: number): string | undefined {
  if (!Number.isInteger(tier) || tier < 1 || tier > 6) return undefined;
  return `/game/development-v1/icons/ui.exam.tier-${tier}.webp`;
}

export type TrainingObjectKind =
  | "dummy"
  | "target"
  | "ki-node"
  | "defense"
  | "ki-source"
  | "checkpoint"
  | "obstacle"
  | "surrender";

export const VERDANTIA_TRAINING_OBJECTS: Record<
  `training.planetary.${TrainingObjectKind}`,
  string
> = {
  "training.planetary.dummy": "/game/development-v1/objects/training.planetary.dummy.webp",
  "training.planetary.target": "/game/development-v1/objects/training.planetary.target.webp",
  "training.planetary.ki-node": "/game/development-v1/objects/training.planetary.ki-node.webp",
  "training.planetary.defense": "/game/development-v1/objects/training.planetary.defense.webp",
  "training.planetary.ki-source": "/game/development-v1/objects/training.planetary.ki-source.webp",
  "training.planetary.checkpoint":
    "/game/development-v1/objects/training.planetary.checkpoint.webp",
  "training.planetary.obstacle": "/game/development-v1/objects/training.planetary.obstacle.webp",
  "training.planetary.surrender": "/game/development-v1/objects/training.planetary.surrender.webp",
};

export const AETHERIA_TRAINING_OBJECTS: Record<`training.sage.${TrainingObjectKind}`, string> = {
  "training.sage.dummy": "/game/development-v1/objects/training.sage.dummy.webp",
  "training.sage.target": "/game/development-v1/objects/training.sage.target.webp",
  "training.sage.ki-node": "/game/development-v1/objects/training.sage.ki-node.webp",
  "training.sage.defense": "/game/development-v1/objects/training.sage.defense.webp",
  "training.sage.ki-source": "/game/development-v1/objects/training.sage.ki-source.webp",
  "training.sage.checkpoint": "/game/development-v1/objects/training.sage.checkpoint.webp",
  "training.sage.obstacle": "/game/development-v1/objects/training.sage.obstacle.webp",
  "training.sage.surrender": "/game/development-v1/objects/training.sage.surrender.webp",
};

export const NEXUS_TRAINING_OBJECTS: Record<`training.android.${TrainingObjectKind}`, string> = {
  "training.android.dummy": "/game/development-v1/objects/training.android.dummy.webp",
  "training.android.target": "/game/development-v1/objects/training.android.target.webp",
  "training.android.ki-node": "/game/development-v1/objects/training.android.ki-node.webp",
  "training.android.defense": "/game/development-v1/objects/training.android.defense.webp",
  "training.android.ki-source": "/game/development-v1/objects/training.android.ki-source.webp",
  "training.android.checkpoint": "/game/development-v1/objects/training.android.checkpoint.webp",
  "training.android.obstacle": "/game/development-v1/objects/training.android.obstacle.webp",
  "training.android.surrender": "/game/development-v1/objects/training.android.surrender.webp",
};

export const PYRA_TRAINING_OBJECTS: Record<`training.legend.${TrainingObjectKind}`, string> = {
  "training.legend.dummy": "/game/development-v1/objects/training.legend.dummy.webp",
  "training.legend.target": "/game/development-v1/objects/training.legend.target.webp",
  "training.legend.ki-node": "/game/development-v1/objects/training.legend.ki-node.webp",
  "training.legend.defense": "/game/development-v1/objects/training.legend.defense.webp",
  "training.legend.ki-source": "/game/development-v1/objects/training.legend.ki-source.webp",
  "training.legend.checkpoint": "/game/development-v1/objects/training.legend.checkpoint.webp",
  "training.legend.obstacle": "/game/development-v1/objects/training.legend.obstacle.webp",
  "training.legend.surrender": "/game/development-v1/objects/training.legend.surrender.webp",
};

export function trainingObjectUrl(world: WorldId, kind: TrainingObjectKind): string | undefined {
  if (world === "verdant") return VERDANTIA_TRAINING_OBJECTS[`training.planetary.${kind}`];
  if (world === "aether") return AETHERIA_TRAINING_OBJECTS[`training.sage.${kind}`];
  if (world === "nexus") return NEXUS_TRAINING_OBJECTS[`training.android.${kind}`];
  if (world === "pyra") return PYRA_TRAINING_OBJECTS[`training.legend.${kind}`];
  return undefined;
}
