import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RACES, RACE_IDS } from "../game/world/races";
import { browserNavigation, type GridData } from "../game/world/generated/browserTerrain";
import {
  buildSuperiorSimulationWorld,
  type SuperiorSimulationSource,
} from "../game/world/generated/simulationWorld";
import { SuperiorSaveStore, type SuperiorIndex } from "../game/world/generated/superiorSave";
import { developmentWorld } from "./helpers/developmentWorld";
import { GameSession } from "../game/session";
import { FIELDWORK } from "../game/development/fieldwork/catalog";
import { combatGround } from "../game/development/heritage/encounter";
import type { Obstacle } from "../game/movement";
import { distance } from "../game/navigation";
const root = "public/game/worlds/superior-v2";
const index = JSON.parse(readFileSync(root + "/index.json", "utf8")) as SuperiorIndex;
describe("new contacts use the actual four Superior v2 continents, without changing world generation", () => {
  it.each(RACE_IDS)(
    "finds reachable physical contacts and room entrances on %s",
    (race) => {
      const id = RACES[race].world,
        info = index.features.find((f) => f.id === id)!;
      const read = <T>(name: string) =>
        JSON.parse(readFileSync(`${root}/${id}/${name}.json`, "utf8")) as T;
      const source = read<SuperiorSimulationSource>("world"),
        grid = read<GridData>("navigation"),
        terrain = read<GridData>("terrain"),
        collisions = read<Obstacle[]>("collision");
      const nav = browserNavigation(info.width, info.height, grid, terrain, collisions);
      const { port, s: fixture } = developmentWorld(race);
      const p = structuredClone(fixture.player);
      Object.assign(p, info.arrival);
      p.interior = null;
      const save = new SuperiorSaveStore(port, "superior-owned", index, id);
      save.load();
      p.development!.heritage.weapon!.owner = save.identity;
      const built = buildSuperiorSimulationWorld({
        source,
        info,
        navigation: nav,
        restored: p,
        town: null,
        basePath: "/game/worlds/superior-v2",
      });
      save.town = built.initialTown;
      expect(save.save(p)).toBe(true);
      const enemyNav = browserNavigation(
        info.width,
        info.height,
        grid,
        terrain,
        collisions,
        built.world.safeAreas ?? [],
      );
      const s = new GameSession(new SuperiorSaveStore(port, "superior-owned", index, id), race, {
        world: built.world,
        featureId: id,
        heritageHome: built.heritageHome,
        navigation: nav,
        enemyNavigation: enemyNav,
        enemyPositionAllowed: built.outsideCities,
      });
      for (const e of s.expeditions.snapshot().entries) {
        expect(e.locked, e.id).toBe("");
        expect(e.target, e.id).not.toBeNull();
        expect(combatGround(s, e.target!.point), e.id).toBe(true);
        expect(nav.path(info.arrival, e.target!.point).length, e.id).toBeGreaterThan(0);
      }
      for (const d of FIELDWORK.filter((d) => d.race === race)) {
        const e = s.fieldwork.snapshot().entries.find((e) => e.id === d.id)!;
        expect(e.target, d.id).not.toBeNull();
        if (e.target!.interior) {
          expect(e.target!.entrance, d.id).not.toBeNull();
          expect(nav.walkable(e.target!.entrance!), d.id).toBe(true);
        } else expect(nav.walkable(e.target!.point), d.id).toBe(true);
        if (d.mode === "escort" || d.mode === "protect")
          expect(combatGround(s, e.target!.point), d.id).toBe(true);
      }
      // Exercise actual room/outdoor routing and one physical circuit on the generated world.
      const d = FIELDWORK.find((f) => f.race === race && f.tier === 1)!,
        target = s.fieldwork.snapshot().entries.find((e) => e.id === d.id)!.target!;
      s.command({ type: "fieldwork", action: "go", id: d.id });
      for (
        let tick = 0;
        tick < 5000 &&
        (!s.player.interior !== !target.interior || distance(s.player, target.point) > 30);
        tick++
      ) {
        s.command({ type: "dialogue", action: "close" });
        s.tick(50);
      }
      expect(s.player.interior, d.id + ": " + s.notice).toBe(target.interior);
      expect(distance(s.player, target.point), d.id).toBeLessThan(40);
      // Reach and start every real formation, then cancel it; this is a geometry/startup audit,
      // not evidence of defeating these opponents or earning the declared prerequisites.
      for (const e of s.expeditions.snapshot().entries) {
        s.command({ type: "expedition", action: "go", id: e.id });
        for (
          let tick = 0;
          tick < 5000 && !s.expeditions.snapshot().entries.find((x) => x.id === e.id)!.near;
          tick++
        ) {
          s.command({ type: "dialogue", action: "close" });
          s.tick(50);
        }
        s.command({ type: "cancel" });
        s.command({ type: "expedition", action: "start", id: e.id });
        expect(s.expeditions.snapshot().active?.phase, e.id + ": " + s.notice).toBe("running");
        const enemies = s.enemies.filter((e) => e.developmentVariant);
        expect(enemies.length, e.id).toBe(e.layout === "pair" ? 2 : 1);
        expect(
          enemies.every((e) => combatGround(s, e)),
          e.id,
        ).toBe(true);
        s.command({ type: "expedition", action: "leave", id: e.id });
        expect(
          s.enemies.filter((e) => e.encounterOwner),
          e.id,
        ).toHaveLength(0);
      }
      for (const d of FIELDWORK.filter((d) => d.race === race)) {
        s.fieldwork.refresh();
        s.command({ type: "fieldwork", action: "go", id: d.id });
        for (
          let tick = 0;
          tick < 5000 && !s.fieldwork.snapshot().entries.find((e) => e.id === d.id)!.near;
          tick++
        ) {
          s.command({ type: "dialogue", action: "close" });
          s.tick(50);
        }
        s.command({ type: "cancel" });
        s.command({ type: "fieldwork", action: "start", id: d.id });
        expect(s.fieldwork.snapshot().active?.id, d.id + ": " + s.notice).toBe(d.id);
        s.command({ type: "fieldwork", action: "leave", id: d.id });
        // Only prepare the next tier's declared prerequisite. Positive outcomes are tested separately.
        s.player.development!.fieldwork[d.id] = { step: d.steps, done: true };
        expect(s.saves!.save(s.player)).toBe(true);
      }
      s.fieldwork.dispose();
      s.expeditions.cancel();
    },
    60000,
  );
});
