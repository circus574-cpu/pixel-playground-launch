import type { Navigation } from "../../navigation";
import { distance } from "../../navigation";
import { blockedAt, type Obstacle } from "../../movement";
import type { Player } from "../../session";
import type { HeritageBindings, HeritageTarget } from "./bindings";
import { WORLD_PROJECTS } from "./catalog";
import type { ProjectEffect, WorldProjectId, Site } from "./types";

export type ProjectView = {
  id: WorldProjectId;
  name: string;
  target: HeritageTarget;
  effect: ProjectEffect;
  done: boolean;
  obstacles: Obstacle[];
  testimony: { name: string; mode: "named" | "anonymous" }[];
};
const effectSite = (kind: ProjectEffect["kind"]): Site =>
  ({
    flow: "river",
    bridge: "river",
    garden: "garden",
    witnesses: "memorial",
    route: "trail",
    archive: "archive",
    "reading-room": "archive",
    barrier: "gate",
    registries: "archive",
    power: "workshop",
    workbench: "workshop",
    signatures: "archive",
    regeneration: "market",
    metrics: "trainer",
    workshop: "workshop",
    training: "trainer",
    forge: "smith",
    memorial: "memorial",
    shelter: "trail",
    school: "trainer",
  })[kind] as Site;
/** Per-character additions. They never write geometry JSON, generated nav fields, or another slot. */
export class HeritageProjects {
  private signature = "";
  private views: ProjectView[] = [];
  constructor(
    private readonly bindings: HeritageBindings,
    private readonly outside: Navigation,
    private readonly enemyNav: Navigation | undefined,
  ) {}
  refresh(p: Player, feature: string) {
    const projects = p.development?.heritage.projects ?? {};
    const key = Object.entries(projects)
      .map(([id, v]) => id + ":" + v.status + ":" + v.step + ":" + v.goal.sequence)
      .join("|");
    if (key === this.signature) return;
    this.signature = key;
    const views: ProjectView[] = [];
    for (const def of WORLD_PROJECTS) {
      const progress = projects[def.id];
      if (!progress || def.race !== p.race || def.world !== feature) continue;
      const target = this.bindings.resolve(
        {
          id: def.id + ":site",
          label: def.name,
          site: effectSite(def.effect.kind),
          documents: [],
          kind: "inspect",
          targets: [def.name],
          observations: [def.effect.description],
        },
        def.world,
      )[0];
      if (!target) continue;
      const done = progress.status === "done";
      const recovered =
        progress.completedGoals.reduce(
          (sum, g, i) => sum + (def.goals[i]?.kind === "recover" ? g.completedTargetIds.length : 0),
          0,
        ) +
        (def.goals[progress.step]?.kind === "recover"
          ? progress.goal.completedTargetIds.length
          : 0);
      const obstacles: Obstacle[] =
        !done && def.effect.opensPassage && !target.interior
          ? Array.from({ length: Math.max(0, 3 - recovered) }, (_, i) => ({
              x: target.point.x - 75 + i * 50,
              y: target.point.y - 120,
              width: 42,
              height: 32,
            })).filter(
              (o) =>
                this.outside.canonicalWalkable({ x: o.x + o.width / 2, y: o.y + o.height / 2 }) &&
                (p.interior !== null || !blockedAt(p.x, p.y, [o], 18)),
            )
          : [];
      const testimony: ProjectView["testimony"] = [];
      for (let i = 0; i < progress.completedGoals.length; i++) {
        const goal = def.goals[i]!;
        if (goal.kind !== "consent") continue;
        const entries = Object.entries(progress.completedGoals[i]!.consent);
        for (const [id, mode] of entries) {
          const index = Number(id.split(":").at(-1));
          testimony.push({
            name:
              mode === "anonymous" ? "Świadectwo anonimowe" : (goal.witnesses[index] ?? "Świadek"),
            mode,
          });
        }
      }
      views.push({
        id: def.id,
        name: def.name,
        target,
        effect: def.effect,
        done,
        obstacles,
        testimony,
      });
    }
    const obstacles = views.flatMap((v) => v.obstacles);
    this.outside.setLocalObstacles("heritage-projects", obstacles);
    this.enemyNav?.setLocalObstacles("heritage-projects", obstacles);
    this.views = views;
  }
  visible(p: Player) {
    return this.views.filter(
      (v) => v.target.interior === p.interior && distance(v.target.point, p) < 1000,
    );
  }
  snapshot() {
    return this.views;
  }
}
