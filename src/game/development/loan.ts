import { GameSession } from "../session";
import { Navigation } from "../navigation";
import { WORLDS } from "../world/worlds";
import { RACES, type RaceId } from "../world/races";
/** Shared in-memory room. No save port, world spawns, borrowed player state or persistent rewards. */
export function loanSession(race: RaceId) {
  const world = {
    ...WORLDS[RACES[race].world],
    settlement: "Sala egzaminacyjna",
    width: 960,
    height: 760,
    spawn: { x: 480, y: 550 },
    npcs: [],
    enemies: [],
    monsters: [],
    objects: [],
    landmarks: [],
    obstacles: [
      { x: 0, y: 0, width: 960, height: 55 },
      { x: 0, y: 0, width: 55, height: 760 },
      { x: 905, y: 0, width: 55, height: 760 },
      { x: 0, y: 705, width: 960, height: 55 },
      { x: 340, y: 190, width: 40, height: 260 },
      { x: 700, y: 360, width: 40, height: 210 },
    ],
    city: { name: "Sala egzaminacyjna", buildings: [], roads: [] },
    safeAreas: [],
  };
  delete world.terrain;
  return new GameSession(undefined, race, {
    world,
    navigation: new Navigation(960, 760, world.obstacles),
    practiceOnly: true,
    random: () => 0.99,
  });
}
