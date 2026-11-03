import { COMBAT_BUDGET } from "../../combatBudget";
import type { GameSession } from "../../session";
import { distance, type Point } from "../../navigation";
import { inSafeCity } from "../../city/types";
import { MONSTER_BASE } from "../../monsters/base.generated";
import type { Enemy } from "../../monsters/types";
import { ProtectedActor } from "./protectedActor";

const CHAPTER_ENCOUNTER_LEVELS = [1, 4, 8, 12, 16, 20] as const;
const PROTECTED_HEALTH_MULTIPLIER = 4;

export const HERITAGE_ENEMY_PREFIX = "heritage-encounter:";
/** Explicit quest-owned opponents, including their summons. Never claim ordinary world spawns. */
export function heritageEnemy(enemy: Enemy, enemies: readonly Enemy[]): boolean {
  if (enemy.encounterOwner) return true;
  let current: Enemy | undefined = enemy;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    if (current.id.startsWith(HERITAGE_ENEMY_PREFIX)) return true;
    seen.add(current.id);
    current = current.m.parent ? enemies.find((e) => e.id === current!.m.parent) : undefined;
  }
  return false;
}
export function combatGround(session: GameSession, point: Point) {
  return (
    (session.enemyNavigation ?? session.nav).walkable(point) &&
    !inSafeCity(session.world, point, null) &&
    (session.enemyPositionAllowed?.(point) ?? true)
  );
}
/** A bounded quest encounter on existing geometry and AI; no loot/XP on repeatable attempts. */
export class HeritageEncounter {
  readonly actor: ProtectedActor;
  private readonly prefix = HERITAGE_ENEMY_PREFIX + crypto.randomUUID() + ":";
  private opponents: Enemy[] = [];
  private stage = -1;
  private disposed = false;
  private readonly kind: string;
  constructor(
    private readonly session: GameSession,
    goalId: string,
    name: string,
    point: Point,
    mobile: boolean,
  ) {
    if (session.player.interior || !combatGround(session, point))
      throw Error("Próba bojowa wymaga osiągalnego terenu poza miastem.");
    // Fixed chapter profile, independent of character level/equipment and of global spawns.
    const match = goalId.match(/^H-[VANP]0([1-6]):/);
    if (!match) throw Error("Nieznany profil bojowy rozdziału.");
    const chapter = Number(match[1]);
    const level = CHAPTER_ENCOUNTER_LEVELS[chapter - 1]!;
    const definition = MONSTER_BASE.filter(
      (m) => m.world === session.world.id && m.level <= level,
    ).sort((a, b) => b.level - a.level || a.id.localeCompare(b.id))[0];
    if (!definition) throw Error("Brak lokalnego profilu przeciwnika próby.");
    this.kind = definition.id;
    this.actor = new ProtectedActor(
      session,
      name,
      point,
      definition.hp * PROTECTED_HEALTH_MULTIPLIER,
      definition.def,
      mobile,
    );
  }
  update(dt: number) {
    this.actor.tick(dt);
  }
  get healthFraction() {
    return this.actor.body.hp / this.actor.maxHp;
  }
  startWave(stage: number) {
    if (this.disposed) throw Error("Próba została zamknięta.");
    if (stage === this.stage) return;
    if (this.opponents.some((e) => e.mode !== "dead")) throw Error("Poprzednia fala nadal trwa.");
    this.clearWave();
    const s = this.session,
      body = this.actor.body;
    let spawn: Point | undefined;
    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI) / 12;
      const point = (s.enemyNavigation ?? s.nav).safe({
        x: body.x + Math.cos(angle) * 170,
        y: body.y + Math.sin(angle) * 170,
      });
      const path = (s.enemyNavigation ?? s.nav).path(point, body);
      if (
        combatGround(s, point) &&
        distance(point, body) >= 100 &&
        distance(point, body) <= 240 &&
        path.length &&
        (s.enemyNavigation ?? s.nav).visible(point, body)
      ) {
        spawn = point;
        break;
      }
    }
    if (!spawn || s.enemies.length >= COMBAT_BUDGET.activeEnemies)
      throw Error("Brak miejsca na bezpieczne rozpoczęcie fali. Ponów próbę.");
    this.stage = stage;
    const enemy = s.monsters.spawn(this.kind, spawn, this.prefix + stage);
    enemy.encounterOwner = this.prefix;
    enemy.m.def = { ...enemy.m.def, respawn: 0 };
    this.opponents = [enemy];
    if (!s.monsters.setCombatTarget(enemy, this.actor.id)) {
      this.clearWave();
      throw Error("Nie udało się przypisać celu fali.");
    }
  }
  get cleared() {
    return (
      this.stage >= 0 &&
      this.opponents.length > 0 &&
      this.opponents.every((e) => e.mode === "dead" && e.hp <= 0) &&
      !this.session.enemies.some((e) => e.encounterOwner === this.prefix && e.mode !== "dead")
    );
  }
  get remaining() {
    return this.opponents.filter((e) => e.mode !== "dead").length;
  }
  private clearWave() {
    const s = this.session,
      ids = new Set([
        ...this.opponents.map((e) => e.id),
        ...s.enemies.filter((e) => e.encounterOwner === this.prefix).map((e) => e.id),
      ]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of s.enemies)
        if (e.m.parent && ids.has(e.m.parent) && !ids.has(e.id)) {
          ids.add(e.id);
          changed = true;
        }
    }
    s.monsters.forget(ids);
    s.enemies.splice(0, s.enemies.length, ...s.enemies.filter((e) => !ids.has(e.id)));
    if (s.targetId && ids.has(s.targetId)) {
      s.targetId = null;
      s.autoAttack = false;
    }
    this.opponents = [];
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearWave();
    this.actor.dispose();
  }
}
