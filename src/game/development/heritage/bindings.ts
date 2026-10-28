import { Navigation, distance, type Point } from "../../navigation";
import { cityRoom } from "../../city/room";
import type { BuildingId, CityDefinition } from "../../city/types";
import type { WorldDefinition, WorldNpc } from "../../world/types";
import type { WorldId } from "../../world/races";
import { goalTargetIds } from "./reducer";
import type { HeritageGoal } from "./types";

export type HeritageHome = {
  city?: CityDefinition;
  npcs: readonly WorldNpc[];
  market: WorldDefinition["market"];
};
export type HeritageTarget = {
  id: string;
  label: string;
  point: Point;
  feature: WorldId;
  interior: BuildingId | null;
  npc: string | null;
  witness: boolean;
  entrance: Point | null;
};
const siteBuilding: Partial<Record<HeritageGoal["site"], BuildingId>> = {
  smith: "smithy",
  trainer: "arena",
  archive: "hall",
  workshop: "smithy",
};
const labelAt = (goal: HeritageGoal, i: number): string => {
  switch (goal.kind) {
    case "talk":
    case "inspect":
    case "solve":
    case "recover":
      return goal.targets[i]!;
    case "consent":
      return goal.witnesses[i]!;
    default:
      return goal.label;
  }
};
const hash = (id: string) => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
/** Stable local bindings on the current planet, never coordinates from the historical village. */
export class HeritageBindings {
  private readonly cache = new Map<string, HeritageTarget[]>();
  constructor(
    private readonly world: WorldDefinition,
    private readonly home: HeritageHome,
    private readonly outside: Navigation,
  ) {}
  resolve(goal: HeritageGoal, world: WorldId): HeritageTarget[] {
    if (goal.world && goal.world !== this.world.id) return [];
    if (world !== this.world.id) return [];
    const cached = this.cache.get(goal.id);
    if (cached) return cached;
    const role = goal.kind === "talk" ? goal.existingRole : undefined;
    const npc = role ? this.home.npcs.find((n) => n.id === role) : undefined;
    const interior = npc?.building ?? (role ? null : (siteBuilding[goal.site] ?? null));
    let anchor: Point = npc ?? this.home.market;
    let nav = this.outside;
    if (interior) {
      const room = cityRoom(interior, world);
      nav = new Navigation(room.width, room.height, room.obstacles);
      anchor = npc ? room.npc : { x: room.entry.x, y: room.entry.y - 130 };
    } else if (!npc) {
      const b = this.home.city?.bounds;
      const offsets: Partial<Record<HeritageGoal["site"], Point>> = {
        river: { x: -380, y: 190 },
        garden: { x: 320, y: 180 },
        memorial: { x: -270, y: -220 },
        market: { x: 180, y: 120 },
        gate: { x: 0, y: 400 },
        trail: { x: 280, y: 480 },
      };
      const offset = offsets[goal.site] ?? { x: 0, y: 180 };
      anchor = { x: anchor.x + offset.x, y: anchor.y + offset.y };
      if ((goal.site === "trail" || goal.site === "gate") && b)
        anchor = {
          x: b.x + b.width / 2 + (goal.site === "trail" ? 160 : -160),
          y: b.y + b.height + 180,
        };
    }
    const ids = goalTargetIds(goal);
    const bindings = ids.map((id, i): HeritageTarget => {
      // Existing NPCs are never cloned. Several witnesses/props get distinct, walkable contacts.
      const angle = ((hash(goal.id) % 360) * Math.PI) / 180 + i * 2.39996;
      const radius = npc ? 0 : 50 + i * 90;
      const requested = {
        x: anchor.x + Math.cos(angle) * radius,
        y: anchor.y + Math.sin(angle) * radius,
      };
      let point = nav.safe(requested);
      if (npc) point = interior ? { ...anchor } : this.outside.safe(anchor);
      // safe() must not collapse two separate evidence markers onto the same blocked cell.
      for (
        let attempt = 0;
        attempt < 24 &&
        i > 0 &&
        ids.slice(0, i).some((_, j) => {
          const a = angle - j * 2.39996;
          return (
            distance(
              point,
              nav.safe({
                x: anchor.x + Math.cos(a) * (50 + j * 90),
                y: anchor.y + Math.sin(a) * (50 + j * 90),
              }),
            ) < 38
          );
        });
        attempt++
      )
        point = nav.safe({ x: requested.x + 48 * (attempt + 1), y: requested.y + 48 });
      return {
        id,
        label: labelAt(goal, i),
        point,
        feature: world,
        interior,
        npc: npc?.id ?? null,
        entrance: interior
          ? (this.home.city?.buildings.find((b) => b.id === interior)?.door ?? null)
          : null,
        witness: !npc && (goal.kind === "talk" || goal.kind === "consent"),
      };
    });
    this.cache.set(goal.id, bindings);
    return bindings;
  }
}
