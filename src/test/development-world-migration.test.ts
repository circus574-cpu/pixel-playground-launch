import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SaveStore, newPlayer } from "../game/session";
import { SuperiorSaveStore, type SuperiorIndex } from "../game/world/generated/superiorSave";
import { DevelopmentSchema, emptyDevelopment } from "../game/development/state";
import { developmentWorld } from "./helpers/developmentWorld";
const index = JSON.parse(
  readFileSync("public/game/worlds/superior-v2/index.json", "utf8"),
) as SuperiorIndex;
function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
}
function legacyDevelopment() {
  const {
    fieldwork: _f,
    encounterKnowledge: _e,
    completedExpeditions: _c,
    ...old
  } = emptyDevelopment();
  return { ...old, version: 3 };
}
describe("development v4 extends owned saves without rewriting old bytes", () => {
  it("reads a real previous v3 development payload, creates empty field data and keeps the original until the first write", () => {
    const port = memory(),
      p = { ...newPlayer(), development: legacyDevelopment() };
    const old = JSON.stringify({ version: 10, revision: "old-code", player: p });
    port.setItem("slot", old);
    const save = new SaveStore(port, "slot"),
      loaded = save.load()!;
    expect(loaded.development).toEqual({
      ...p.development,
      version: 4,
      fieldwork: {},
      encounterKnowledge: {},
      completedExpeditions: {},
    });
    expect(port.getItem("slot")).toBe(old);
    expect(save.save(loaded)).toBe(true);
    expect(port.getItem("ki-legends:recovery:before-v11:slot")).toBe(old);
    expect(JSON.parse(port.getItem("slot")!).version).toBe(11);
    expect(new SaveStore(port, "slot").load()).toEqual(loaded);
  });
  it("preserves exact Superior v6 bytes before v7, including spawns, inventory, skills, quests and the original geometry", () => {
    const port = memory(),
      save = new SuperiorSaveStore(port, "owned", index, "verdant");
    save.load();
    const p = newPlayer();
    Object.assign(p, index.features.find((f) => f.id === "verdant")!.arrival);
    p.development = emptyDevelopment();
    expect(save.save(p)).toBe(true);
    const raw = JSON.parse(port.getItem("owned")!);
    raw.version = 6;
    raw.player.development = legacyDevelopment();
    raw.spawns = { "fixture-spawn": { hp: 42, deadUntil: 10, kind: "verdant-mchowy-szlamak" } };
    const old = JSON.stringify(raw);
    port.setItem("owned", old);
    const migrated = new SuperiorSaveStore(port, "owned", index, "verdant"),
      loaded = migrated.load()!;
    expect(loaded).toBeDefined();
    expect(port.getItem("owned")).toBe(old);
    expect(migrated.save(loaded)).toBe(true);
    expect(port.getItem("ki-legends:recovery:before-superior-v7:owned")).toBe(old);
    const after = JSON.parse(port.getItem("owned")!);
    expect(after.version).toBe(7);
    expect(after.geometry).toBe(raw.geometry);
    expect(after.spawns).toEqual(raw.spawns);
    expect(after.player.items).toEqual(raw.player.items);
    expect(after.player.skills).toEqual(raw.player.skills);
    expect(after.player.quests).toEqual(raw.player.quests);
  });
  it("blocks unknown versions and fields, cross-tab writes and proof-free field progress", () => {
    const { s } = developmentWorld("android"),
      d = s.player.development!;
    expect(DevelopmentSchema.safeParse({ ...d, version: 5 }).success).toBe(false);
    expect(
      DevelopmentSchema.safeParse({ ...d, fieldwork: { unknown: { step: 1, done: true } } })
        .success,
    ).toBe(false);
    expect(
      DevelopmentSchema.safeParse({
        ...emptyDevelopment(),
        fieldwork: { "F-N-construction-1": { step: 2, done: true } },
      }).success,
    ).toBe(false);
    expect(
      DevelopmentSchema.safeParse({
        ...d,
        fieldwork: { "F-N-construction-3": { step: 4, done: true } },
      }).success,
    ).toBe(false);
    const port = memory();
    port.setItem(
      "slot",
      JSON.stringify({
        version: 10,
        revision: "first",
        player: { ...newPlayer(), development: legacyDevelopment() },
      }),
    );
    const a = new SaveStore(port, "slot"),
      b = new SaveStore(port, "slot");
    const pa = a.load()!,
      pb = b.load()!;
    expect(a.save(pa)).toBe(true);
    const kept = port.getItem("slot");
    expect(b.save(pb)).toBe(false);
    expect(port.getItem("slot")).toBe(kept);
    const raw = JSON.parse(kept!);
    raw.player.development.future = 1;
    port.setItem("slot", JSON.stringify(raw));
    const future = new SaveStore(port, "slot");
    expect(future.load()).toBeUndefined();
    expect(future.save(pa)).toBe(false);
  });
});

it("normal online frames expose technical targets without callbacks or authority to award client progress", async () => {
  const { mirrorDevelopmentTargets } = await import("../game/online/development");
  const { s: owner } = developmentWorld("android"),
    { s: client } = developmentWorld("android");
  const e = owner.fieldwork.snapshot().entries.find((e) => e.id === "F-N-calibration-1")!;
  owner.command({ type: "fieldwork", action: "go", id: e.id });
  for (
    let n = 0;
    n < 2000 && !owner.fieldwork.snapshot().entries.find((t) => t.id === e.id)!.near;
    n++
  ) {
    owner.command({ type: "dialogue", action: "close" });
    owner.tick(50);
  }
  owner.command({ type: "fieldwork", action: "start", id: e.id });
  const frame = JSON.parse(JSON.stringify(owner.snapshot()));
  expect(frame.practiceTargets.length).toBeGreaterThan(0);
  expect(frame.practiceTargets.every((t: object) => !("onHit" in t))).toBe(true);
  client.player = structuredClone(frame.player);
  mirrorDevelopmentTargets(client, frame);
  const t = client.practiceTargets.list(client.player.interior)[0]!;
  client.practiceTargets.hit(t, 99, { ability: "R", tags: ["physical"] }, client.nowMs);
  expect(owner.player.development!.fieldwork[e.id]).toBeUndefined();
  expect(client.player.development!.fieldwork[e.id]).toBeUndefined();
  owner.fieldwork.cancel();
  mirrorDevelopmentTargets(client, JSON.parse(JSON.stringify(owner.snapshot())));
  expect(client.practiceTargets.list(client.player.interior)).toHaveLength(0);
});
