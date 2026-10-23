import type { RaceId } from "../world/races";
import { AndroidKit } from "./android";
import type { Kit } from "./base";
import { LegendKit } from "./legend";
import { PlanetaryKit } from "./planetary";
import { SageKit } from "./sage";
import type { KitPort } from "./types";

export { Kit } from "./base";
export { RACE_BASE, KIT_NODES, BRANCH_NAMES } from "./nodes.generated";
export * from "./progression";
export type * from "./types";

export function createKit(race: RaceId, port: KitPort, learned: Iterable<string>): Kit {
  switch (race) {
    case "planetary":
      return new PlanetaryKit(port, learned);
    case "sage":
      return new SageKit(port, learned);
    case "android":
      return new AndroidKit(port, learned);
    case "legend":
      return new LegendKit(port, learned);
  }
}
