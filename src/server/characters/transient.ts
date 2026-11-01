import { z } from "zod";
import type { GameSession } from "../../game/session";

const kitKeys = [
  "cooldowns",
  "buffs",
  "shields",
  "circles",
  "lockMs",
  "lastBasic",
  "combo",
  "nextDodgeAt",
  "nextBasicAt",
  "charge",
  "overheatMs",
  "lastShot",
  "ember",
  "streak",
  "lastHitAt",
  "wasInCombat",
  "series",
  "lastHealed",
] as const;
const fxKeys = [
  "slow",
  "rootMs",
  "stunMs",
  "fearMs",
  "fearFrom",
  "silenceMs",
  "blind",
  "fog",
  "jamMs",
  "mark",
  "armor",
  "weaken",
  "dots",
  "missAcc",
] as const;
const sessionKeys = ["potionIn", "combatIn", "lastTrainingCredit"] as const;
const object = z.record(z.unknown());
const schema = z
  .object({
    version: z.literal(1),
    kit: object,
    fx: object,
    session: object,
    techniqueRepeat: z.array(z.tuple([z.string().max(8), z.number().finite()])).max(32),
  })
  .strict();
const record = (v: object) => v as unknown as Record<string, unknown>;
function pick(value: object, keys: readonly string[]) {
  const source = record(value),
    out: Record<string, unknown> = {};
  for (const key of keys)
    if (
      source[key] !== undefined &&
      !(typeof source[key] === "number" && !Number.isFinite(source[key]))
    )
      out[key] = source[key];
  return JSON.parse(JSON.stringify(out));
}
function assign(target: object, source: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(source).some((k) => !keys.includes(k)))
    throw Error("Invalid combat checkpoint keys");
  for (const key of keys)
    if (Object.hasOwn(source, key)) record(target)[key] = structuredClone(source[key]);
}
/** Server-private whitelist; never restores code, ports, definitions, permissions or clocks.
 * Channels and delayed callbacks are interrupted on a process restart; their already paid
 * costs and cooldowns remain. Reconnect therefore cannot reset a cooldown or cleanse DOTs.
 */
export function captureCombat(session: GameSession) {
  const repeat = record(session.kit)["techniqueRepeatUntil"] as Map<string, number>;
  return {
    version: 1 as const,
    kit: pick(session.kit, kitKeys),
    fx: pick(session.fx, fxKeys),
    session: pick(session, sessionKeys),
    techniqueRepeat: [...repeat.entries()],
  };
}
export function restoreCombat(session: GameSession, input: unknown) {
  if (input === undefined) return;
  const data = schema.parse(input);
  assign(session.kit, data.kit, kitKeys);
  assign(session.fx, data.fx, fxKeys);
  assign(session, data.session, sessionKeys);
  record(session.kit)["techniqueRepeatUntil"] = new Map(data.techniqueRepeat);
}
