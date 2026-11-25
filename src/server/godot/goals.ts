import type { AndroidHeroState, AndroidLand, AndroidRace } from "./economy";
import {
  ANDROID_GOALS_CATALOG,
  ANDROID_GOALS_MAP,
  type AndroidGoalDef,
  type GoalKind,
} from "../../game/world/superiorGoalsCatalog";

export { ANDROID_GOALS_CATALOG, ANDROID_GOALS_MAP, type AndroidGoalDef, type GoalKind };

export type AndroidGoalStatus = "claimed" | "ready" | "in_progress" | "locked";

export type AndroidGoalProgressView = AndroidGoalDef & {
  status: AndroidGoalStatus;
  progressText: string;
};

export function evaluateGoalForCharacter(
  goal: AndroidGoalDef,
  char: { race: AndroidRace; land: AndroidLand; level: number; state: AndroidHeroState },
): { status: AndroidGoalStatus; progressText: string } {
  if (char.state.completedQuests[goal.id]) {
    return { status: "claimed", progressText: "Ukończone ✓" };
  }
  if (goal.race !== char.race) {
    return { status: "locked", progressText: "Cel innej rasy" };
  }
  if (goal.prereqId && !char.state.completedQuests[goal.prereqId]) {
    return { status: "locked", progressText: `Wymaga ukończenia ${goal.prereqId}` };
  }
  if (char.level < goal.minLevel) {
    return {
      status: "locked",
      progressText: `Wymagany poziom ${goal.minLevel} (masz ${char.level})`,
    };
  }

  if (goal.kind === "heritage") {
    return { status: "ready", progressText: "Gotowe do ukończenia i odbioru nagrody!" };
  }

  const prog = char.state.progress ?? {
    visitedLands: [char.land],
    craftedCount: 0,
    arenaCount: 0,
    trainingCount: 0,
    shopCount: 0,
    monsterKills: 0,
    eliteKills: 0,
    gatherCount: 0,
    gatheredNodes: {},
    discoveredWaystones: [],
    openedTreasures: [],
    clearedLabyrinths: [],
    lastKillAt: 0,
    recentKillTimes: [],
  };
  const suffix = goal.id.slice(-2);

  if (goal.kind === "adventure") {
    const kills = prog.monsterKills ?? 0;
    const chests = (prog.openedTreasures ?? []).length;
    const labs = (prog.clearedLabyrinths ?? []).length;
    const elites = prog.eliteKills ?? 0;
    const gathers = prog.gatherCount ?? 0;
    switch (suffix) {
      case "01":
        return kills >= 5
          ? { status: "ready", progressText: `Pokonano ${kills}/5 potworów — odbierz nagrodę!` }
          : { status: "in_progress", progressText: `Pokonane potwory: ${kills}/5` };
      case "02":
        return chests >= 3
          ? { status: "ready", progressText: `Otwarto ${chests}/3 skarby — odbierz nagrodę!` }
          : { status: "in_progress", progressText: `Ukryte skarby: ${chests}/3` };
      case "03":
        return labs >= 1
          ? { status: "ready", progressText: `Ukończono ${labs}/1 labirynt — odbierz nagrodę!` }
          : { status: "in_progress", progressText: `Ukończone labirynty: ${labs}/1` };
      case "04":
        return labs >= 2 && chests >= 10 && kills >= 20
          ? { status: "ready", progressText: "Wszystkie cele wypraw ukończone — odbierz nagrodę!" }
          : {
              status: "in_progress",
              progressText: `Labirynty: ${labs}/2 • Skarby: ${chests}/10 • Potwory: ${kills}/20`,
            };
      case "05":
        return kills >= 12 && gathers >= 5 && elites >= 1
          ? {
              status: "ready",
              progressText: "Ciężki Kontrakt I ukończony — odbierz unikalną nagrodę!",
            }
          : {
              status: "in_progress",
              progressText: `Potwory: ${kills}/12 • Surowce: ${gathers}/5 • Elity: ${elites}/1`,
            };
      case "06":
        return kills >= 35 && elites >= 3 && gathers >= 12
          ? {
              status: "ready",
              progressText: "Ciężki Kontrakt II ukończony — odbierz Zbroję Czempiona!",
            }
          : {
              status: "in_progress",
              progressText: `Potwory: ${kills}/35 • Elity: ${elites}/3 • Surowce: ${gathers}/12`,
            };
      default:
        return { status: "ready", progressText: "Gotowe" };
    }
  }

  const equippedCount = Object.values(char.state.equipment).filter(Boolean).length;
  const totalBonus = Object.values(char.state.bonusStats).reduce((a, b) => a + b, 0);
  const bankItemCount = char.state.bankItems.filter(Boolean).length;
  const npcQuestCount = Object.keys(char.state.completedQuests).filter(
    (k) =>
      k.startsWith("npc:") ||
      k.startsWith("pyra:") ||
      k.startsWith("verdant:") ||
      k.startsWith("aether:") ||
      k.startsWith("nexus:"),
  ).length;

  switch (suffix) {
    case "01": {
      const done = prog.shopCount >= 1 || npcQuestCount >= 1;
      return done
        ? { status: "ready", progressText: "Warunek spełniony — odbierz nagrodę!" }
        : {
            status: "in_progress",
            progressText: `Zakupy: ${prog.shopCount}/1 lub Zlecenia NPC: ${npcQuestCount}/1`,
          };
    }
    case "02": {
      const done = prog.craftedCount >= 1 || equippedCount >= 1;
      return done
        ? { status: "ready", progressText: "Warunek spełniony — odbierz nagrodę!" }
        : {
            status: "in_progress",
            progressText: `Wykute: ${prog.craftedCount}/1 lub Założone: ${equippedCount}/1`,
          };
    }
    case "03": {
      const nodes = char.state.unlockedNodes.length;
      const done = nodes >= 2 && totalBonus >= 1;
      return done
        ? { status: "ready", progressText: "Warunek spełniony — odbierz nagrodę!" }
        : {
            status: "in_progress",
            progressText: `Talenty: ${nodes}/2 • Przydzielone statystyki: ${totalBonus}/1`,
          };
    }
    case "04": {
      const trained = prog.trainingCount ?? prog.arenaCount ?? 0;
      const done = trained >= 3;
      return done
        ? { status: "ready", progressText: "Warunek spełniony — odbierz nagrodę!" }
        : { status: "in_progress", progressText: `Sesje treningu w mieście: ${trained}/3` };
    }
    case "05": {
      const done = char.state.bankGold > 0 || bankItemCount >= 1;
      return done
        ? { status: "ready", progressText: "Warunek spełniony — odbierz nagrodę!" }
        : {
            status: "in_progress",
            progressText: `Bank: ${char.state.bankGold} zł, ${bankItemCount} przedmiotów`,
          };
    }
    case "06": {
      const lands = new Set<string>([...prog.visitedLands, char.land]);
      const done = lands.size >= 2;
      return done
        ? {
            status: "ready",
            progressText: `Odwiedzono ${lands.size}/2 kontynenty — odbierz nagrodę!`,
          }
        : { status: "in_progress", progressText: `Odwiedzone kontynenty: ${lands.size}/2` };
    }
    default:
      return { status: "ready", progressText: "Gotowe" };
  }
}

export function listGoalsForCharacter(char: {
  race: AndroidRace;
  land: AndroidLand;
  level: number;
  state: AndroidHeroState;
}): AndroidGoalProgressView[] {
  return ANDROID_GOALS_CATALOG.filter((g) => g.race === char.race).map((g) => ({
    ...g,
    ...evaluateGoalForCharacter(g, char),
  }));
}
