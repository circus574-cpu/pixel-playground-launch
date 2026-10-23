import type { GameSession } from "../../session";
import type { SuperiorSaveStore } from "./superiorSave";
import { distance } from "../../navigation";

export type AuthoredSpawn = {
  id: string;
  kind: string;
  x: number;
  y: number;
  homeLeash: number;
  respawnMs: number;
};
const ACTIVE = 24,
  ROOTS = 16,
  RADIUS = 1400,
  SLEEP = 1900;

/** Activates authored slots, never unvalidated pack offsets. The save owns the ledger. */
export function streamSpawns(
  session: GameSession,
  save: SuperiorSaveStore,
  slots: readonly AuthoredSpawn[],
  assets: {
    canAcquire?: (slot: AuthoredSpawn) => boolean;
    acquire: (slot: AuthoredSpawn) => Promise<void>;
    release: (slot: AuthoredSpawn) => void;
  },
  clock = Date.now,
) {
  const byId = new Map(slots.map((s) => [s.id, s]));
  const grid = new Map<string, AuthoredSpawn[]>();
  for (const slot of slots) {
    const key = Math.floor(slot.x / 2048) + ":" + Math.floor(slot.y / 2048);
    const list = grid.get(key) ?? [];
    list.push(slot);
    grid.set(key, list);
  }
  const held = new Map<string, AuthoredSpawn>(),
    pending = new Set<string>();
  let disposed = false;
  const capture = () => {
    for (const e of session.enemies) {
      const slot = byId.get(e.id);
      if (!slot) continue;
      const previous = save.spawns[e.id];
      save.spawns[e.id] = {
        kind: e.kind,
        hp: e.hp,
        deadUntil: e.mode === "dead" ? previous?.deadUntil || clock() + slot.respawnMs : 0,
        revived: e.m.revived,
      };
    }
  };
  const family = (id: string) => {
    const ids = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const child of session.enemies)
        if (child.m.parent && ids.has(child.m.parent) && !ids.has(child.id)) {
          ids.add(child.id);
          changed = true;
        }
    }
    return ids;
  };
  const retire = (id: string) => {
    const slot = held.get(id);
    if (!slot) return;
    const ids = family(id);
    session.enemies.splice(
      0,
      session.enemies.length,
      ...session.enemies.filter((x) => !ids.has(x.id)),
    );
    session.monsters.forget(ids);
    if (session.targetId && ids.has(session.targetId)) session.command({ type: "cancel" });
    held.delete(id);
    assets.release(slot);
  };
  const normalize = () => {
    for (const e of session.enemies)
      if (e.m.def.respawn !== 0) {
        e.m.def = { ...e.m.def, respawn: 0 };
        if (e.mode === "dead") e.timer = 0;
      }
  };
  const update = () => {
    if (disposed) return;
    normalize();
    capture();
    for (const [id, slot] of held)
      if (!session.enemies.some((e) => e.id === id)) {
        const ids = family(id);
        const children = session.enemies.filter((e) => ids.has(e.id));
        if (children.length) {
          if (
            children.every(
              (e) => e.hp === e.maxHp && !e.m.engaged && distance(e.home, session.player) > SLEEP,
            )
          )
            retire(id);
          continue;
        }
        held.delete(id);
        assets.release(slot);
      }
    if (session.paused || session.player.interior || session.player.dead) return;
    for (const e of [...session.enemies])
      // A damaged or engaged enemy keeps its live state, including split parts.
      if (
        byId.has(e.id) &&
        e.mode !== "dead" &&
        e.hp === e.maxHp &&
        !e.m.engaged &&
        !session.enemies.some((x) => x.m.parent === e.id) &&
        distance(e.home, session.player) > SLEEP
      )
        retire(e.id);
    const x = Math.floor(session.player.x / 2048),
      y = Math.floor(session.player.y / 2048);
    const nearby: AuthoredSpawn[] = [];
    for (let yy = y - 1; yy <= y + 1; yy++)
      for (let xx = x - 1; xx <= x + 1; xx++) nearby.push(...(grid.get(xx + ":" + yy) ?? []));
    nearby.sort((a, b) => distance(a, session.player) - distance(b, session.player));
    let starts = 0;
    for (const slot of nearby) {
      if (
        starts >= 2 ||
        held.size + pending.size >= ROOTS ||
        session.enemies.length + pending.size >= ACTIVE
      )
        break;
      if (
        held.has(slot.id) ||
        pending.has(slot.id) ||
        distance(slot, session.player) > RADIUS ||
        (save.spawns[slot.id]?.deadUntil ?? 0) > clock()
      )
        continue;
      if (assets.canAcquire && !assets.canAcquire(slot)) {
        const farther = session.enemies
          .filter(
            (e) =>
              held.has(e.id) &&
              e.hp === e.maxHp &&
              !e.m.engaged &&
              !session.enemies.some((child) => child.m.parent === e.id) &&
              distance(e.home, session.player) > distance(slot, session.player) + 256,
          )
          .sort((a, b) => distance(b.home, session.player) - distance(a.home, session.player))[0];
        if (farther) retire(farther.id);
        if (!assets.canAcquire(slot)) continue;
      }
      starts++;
      pending.add(slot.id);
      void assets
        .acquire(slot)
        .then(() => {
          if (
            disposed ||
            session.player.interior ||
            distance(slot, session.player) > SLEEP ||
            session.enemies.length >= ACTIVE
          ) {
            assets.release(slot);
            return;
          }
          const e = session.monsters.spawn(slot.kind, slot, slot.id);
          e.m.def = {
            ...e.m.def,
            respawn: 0,
            traits: {
              ...e.m.def.traits,
              leash: Math.min(e.m.def.traits.leash ?? slot.homeLeash, slot.homeLeash),
            },
          };
          const record = save.spawns[slot.id];
          if (record?.kind === slot.kind && record.hp > 0 && record.deadUntil === 0) {
            e.hp = Math.min(record.hp, e.maxHp);
            e.m.revived = record.revived ?? false;
          }
          held.set(slot.id, slot);
          capture();
        })
        .catch(() => {
          assets.release(slot);
        })
        .finally(() => pending.delete(slot.id));
    }
  };
  return {
    update,
    capture,
    dispose() {
      capture();
      disposed = true;
      for (const slot of held.values()) assets.release(slot);
      held.clear();
    },
  };
}
