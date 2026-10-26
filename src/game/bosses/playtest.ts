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
  session.summonBoss(bossId, { x: 2248, y: 2048 });
  session.say("Próba bossa — tymczasowa arena, bez zapisu postaci. " + bossId);
  return session;
}
