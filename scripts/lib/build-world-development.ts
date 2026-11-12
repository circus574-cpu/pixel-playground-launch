/** Derive admin contacts from isolated production sessions, without save ports, ticks or commands. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { GameSession } from "../../src/game/session";
import { browserNavigation } from "../../src/game/world/generated/browserTerrain";
import {
  buildSuperiorSimulationWorld,
  type SuperiorSimulationSource,
} from "../../src/game/world/generated/simulationWorld";
import { v2Places } from "../../src/game/worlds/v2Places";
import { WORLDS } from "../../src/game/world/worlds";
import type { FeatureInfo } from "../../src/game/world/generated/superiorSave";
import { emptyDevelopment } from "../../src/game/development/state";
import { emptyHeritageProgress } from "../../src/game/development/heritage/types";
import { HERITAGE_QUESTS, WORLD_PROJECTS } from "../../src/game/development/heritage/catalog";
import { FIELDWORK } from "../../src/game/development/fieldwork/catalog";
import {
  EXPEDITIONS,
  DEVELOPMENT_ENCOUNTERS,
  developmentMonster,
} from "../../src/game/development/expeditions/catalog";
import { EXPEDITION_RULES } from "../../src/game/development/expeditions/runtime";
import { TRIALS } from "../../src/game/development/trials/catalog";
import { cityRoom } from "../../src/game/city/room";
import type { HeritageTarget } from "../../src/game/development/heritage/bindings";
import type { Entry } from "../../src/components/admin/world-overview/model";
const read = (path: string) =>
  JSON.parse(readFileSync("public/game/worlds/superior-v2/" + path, "utf8"));
const index = read("index.json") as { features: FeatureInfo[] };
const entries: Omit<Entry, "search">[] = [],
  unmapped: { id: string; reason: string }[] = [];
const worldHashes: Record<string, string> = {};
for (const info of index.features) {
  if (info.id !== info.affinity) continue;
  const source = read(info.id + "/world.json") as SuperiorSimulationSource;
  const places = v2Places(info.affinity);
  for (const town of source.settlements) town.name = places?.townNames[town.id] ?? town.name;
  const navData = read(info.id + "/navigation.json"),
    terrain = read(info.id + "/terrain.json"),
    collision = read(info.id + "/collision.json");
  const nav = browserNavigation(info.width, info.height, navData, terrain, collision);
  const sim = buildSuperiorSimulationWorld({
    source,
    info,
    navigation: nav,
    town: null,
    basePath: "/game/worlds/superior-v2",
    places,
  });
  const enemyNav = browserNavigation(
    info.width,
    info.height,
    navData,
    terrain,
    collision,
    sim.world.safeAreas ?? [],
  );
  const session = new GameSession(undefined, WORLDS[info.affinity].race, {
    world: sim.world,
    featureId: info.id,
    heritageHome: sim.heritageHome,
    navigation: nav,
    enemyNavigation: enemyNav,
    enemyPositionAllowed: sim.outsideCities,
  });
  session.player.level = 40;
  session.player.development = emptyDevelopment();
  const town = [...sim.cities].find(([, v]) => v === sim.heritageHome)![0];
  worldHashes[info.id] = info.worldSha256;
  const add = (
    id: string,
    name: string,
    target: HeritageTarget | null | undefined,
    details: unknown,
    step = 0,
    radius?: number,
  ) => {
    if (!target) {
      unmapped.push({ id, reason: "Runtime did not provide a contact" });
      return;
    }
    entries.push({
      id: `development:${info.id}:${id}:${step}:${target.id}`,
      sourceId: id,
      land: info.id,
      x: target.point.x,
      y: target.point.y,
      name,
      layer: "development",
      status: "runtime",
      source: "Isolated GameSession public snapshots; no save, ticks or gameplay commands",
      town,
      ...(target.interior ? { room: town + ":" + target.interior, building: target.interior } : {}),
      ...(radius ? { radius } : {}),
      details: {
        ...target,
        definition: details,
        step,
        conditional: true,
        note: "Punkt etapu/aktywacji. Widoczność i pojawienie się aktorów zależą od osobistego postępu; nie jest to stan żywej sesji.",
      },
    });
  };
  for (const def of [...HERITAGE_QUESTS, ...WORLD_PROJECTS].filter(
    (d) => d.race === session.player.race,
  )) {
    for (let step = 0; step < def.goals.length; step++) {
      const table = def.id.startsWith("H-")
        ? session.player.development.heritage.quests
        : session.player.development.heritage.projects;
      table[def.id] = { ...emptyHeritageProgress(), step };
      const state = session.heritage.snapshot().find((x) => x.id === def.id)!;
      for (const target of state.targets)
        add(
          def.id,
          def.name + " · etap " + (step + 1),
          target,
          {
            kind: def.id.startsWith("H-") ? "heritage" : "project",
            content: def,
            goal: state.goal,
          },
          step,
        );
    }
  }
  // A chapter may physically visit another continent (e.g. Android H-N04 in Verdantia).
  for (const def of [...HERITAGE_QUESTS, ...WORLD_PROJECTS].filter(
    (d) => d.race !== session.player.race && d.goals.some((g) => g.world === info.id),
  )) {
    const visitor = new GameSession(undefined, def.race, {
      world: sim.world,
      featureId: info.id,
      heritageHome: sim.heritageHome,
      navigation: nav,
      enemyNavigation: enemyNav,
      enemyPositionAllowed: sim.outsideCities,
    });
    visitor.player.development = emptyDevelopment();
    for (const [step, goal] of def.goals.entries())
      if (goal.world === info.id) {
        const table = def.id.startsWith("H-")
          ? visitor.player.development.heritage.quests
          : visitor.player.development.heritage.projects;
        table[def.id] = { ...emptyHeritageProgress(), step };
        const view = visitor.heritage.snapshot().find((v) => v.id === def.id)!;
        for (const target of view.targets)
          add(
            def.id,
            def.name + " · etap " + (step + 1),
            target,
            { kind: "heritage", content: def, goal: view.goal },
            step,
          );
      }
  }
  for (const def of FIELDWORK.filter((d) => d.race === session.player.race))
    for (let step = 0; step < def.steps; step++) {
      session.player.development.fieldwork[def.id] = { step, done: false };
      const state = session.fieldwork.snapshot().entries.find((x) => x.id === def.id)!;
      add(
        def.id,
        def.name + " · punkt " + (step + 1),
        state.target,
        { kind: "fieldwork", content: def },
        step,
      );
    }
  for (const def of EXPEDITIONS.filter((d) => d.race === session.player.race)) {
    const state = session.expeditions.snapshot().entries.find((x) => x.id === def.id)!;
    add(
      def.id,
      def.name,
      state.target,
      {
        kind: "expedition",
        content: def,
        rules: EXPEDITION_RULES,
        spawnPolicy:
          "Aktorzy powstają dopiero po starcie wyprawy; dokładne punkty wybiera bieżąca nawigacja w obszarze kontaktu.",
        variants: DEVELOPMENT_ENCOUNTERS.filter(
          (d) => d.race === def.race && d.level === def.level,
        ).map((d) => ({ ...developmentMonster(d), encounterId: d.id, baseSpecies: d.species })),
      },
      0,
      EXPEDITION_RULES.spawnRadius,
    );
  }
  const trainer = sim.heritageHome.npcs.find((n) => n.id === "trainer");
  if (trainer) {
    const point = trainer.building
      ? cityRoom(trainer.building, info.affinity).npc
      : nav.safe(trainer);
    for (const def of TRIALS.filter((d) => d.race === session.player.race))
      add(
        def.id,
        def.name + " · wejście przez trenera",
        {
          id: trainer.id,
          label: trainer.name,
          point,
          feature: info.affinity,
          interior: trainer.building ?? null,
          npc: trainer.id,
          witness: false,
          entrance: trainer.building
            ? sim.heritageHome.city!.buildings.find((b) => b.id === trainer.building)!.door
            : null,
        },
        {
          kind: "trial",
          content: def,
          note: "Wejście do osobnej sali próby. Położenia przeciwników w aktywnej instancji nie są stałymi spawnami planety.",
        },
      );
  }
  if (session.enemies.length) throw Error("Read-only planner unexpectedly created combat actors");
}
const files = [
  "src/game/development/heritage/bindings.ts",
  "src/game/development/heritage/runtime.ts",
  "src/game/development/heritage/catalog.ts",
  "src/game/development/fieldwork/runtime.ts",
  "src/game/development/fieldwork/catalog.ts",
  "src/game/development/expeditions/runtime.ts",
  "src/game/development/expeditions/catalog.ts",
  "src/game/development/trials/catalog.ts",
];
writeFileSync(
  "src/game/admin/worldDevelopment.generated.json",
  JSON.stringify({
    worldHashes,
    sourceHashes: Object.fromEntries(
      files.map((p) => [p, createHash("sha256").update(readFileSync(p)).digest("hex")]),
    ),
    entries,
    unmapped,
  }) + "\n",
);
console.log(
  JSON.stringify({
    entries: entries.length,
    activities: new Set(entries.map((e) => e.sourceId)).size,
    unmapped,
  }),
);
