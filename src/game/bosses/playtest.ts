import { bossDefinition } from "./runtime";
import { GameSession } from "../session";
import { Navigation } from "../navigation";
import { WORLDS } from "../world/worlds";
import { RACES, type RaceId } from "../world/races";
/** Temporary arena only: no authored world files, slots, quests or spawn ledgers are changed. */
export function createBossPlaytest(race: RaceId, bossId: string) {
  const world = {
    ...WORLDS[RACES[race].world],
    width: 4096,
    height: 4096,
    spawn: { x: 2048, y: 2048 },
    enemies: [],
    monsters: [],
    npcs: [],
    objects: [],
    obstacles: [],
    safeAreas: [],
  };
  delete world.city;
  delete world.terrain;
  const session = new GameSession(undefined, race, {
    world,
    navigation: new Navigation(4096, 4096, []),
  });
  // A solo trial uses the catalog level and existing gear/skills, never a saved character.
  session.player.level = bossDefinition(bossId).level;
  session.player.items.sword = 1;
  session.player.items.vest = 1;
  session.player.weapon = "sword";
  session.player.armor = "vest";
  session.player.upgrade = 1;
  for (const node of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A9", "B1", "B2", "B4", "T"])
    session.command({ type: "learn", node });
  session.player.hp = session.kit.stats.maxHp;
  session.player.ki = session.kit.stats.maxKi;
  session.summonBoss(bossId, { x: 2248, y: 2048 });
  session.say("Próba bossa — tymczasowa arena, bez zapisu postaci. " + bossId);
  return session;
}
