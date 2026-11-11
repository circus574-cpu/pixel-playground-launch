import { xpNeeded, type Player } from "../../game/session";

/** Limits of the world a stored player is about to be opened in. */
export interface RepairWorld {
  width: number;
  height: number;
}

/**
 * Brings an administrator-edited stored player back inside the invariants the checkpoint loader
 * (`SuperiorSaveStore.load`) enforces, keeping the editor's intent: an equipped sword or vest the
 * character does not own is granted, quest prerequisites are completed, experience is clamped below
 * the next level. Returns the names of the fields that were changed (empty when nothing was).
 */
export function repairPlayerForLoad(
  player: Player,
  world: RepairWorld,
  options: { town: string | null },
): string[] {
  const changed: string[] = [];
  const note = (name: string) => {
    if (!changed.includes(name)) changed.push(name);
  };
  const cap = xpNeeded(player.level) - 1;
  if (player.xp > cap) {
    player.xp = cap;
    note("xp");
  }
  if (player.weapon === "sword" && player.items.sword < 1) {
    player.items.sword = 1;
    note("items.sword");
  }
  if (player.armor && !player.items.vest) {
    player.items.vest = 1;
    note("items.vest");
  }
  if (player.depot.upgrade > 0 && !player.depot.items.sword) {
    player.depot.items.sword = 1;
    note("depot.items.sword");
  }
  if (player.quests.gear !== "locked" && player.quests.boars !== "done") {
    player.quests.boars = "done";
    note("quests.boars");
  }
  if (player.quests.boars !== "locked" && player.quests.steps !== "done") {
    player.quests.steps = "done";
    note("quests.steps");
  }
  if (player.interior && !options.town) {
    player.interior = null;
    note("interior");
  }
  const x = Math.min(Math.max(player.x, 0), world.width);
  const y = Math.min(Math.max(player.y, 0), world.height);
  if (x !== player.x || y !== player.y) {
    player.x = x;
    player.y = y;
    note("position");
  }
  return changed;
}
