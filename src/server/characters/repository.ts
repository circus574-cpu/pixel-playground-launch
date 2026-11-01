import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { z } from "zod";
import { newPlayer, PlayerSchema, type Player } from "../../game/session";
import { isValidNick } from "../../game/nickname";
import { RACE_IDS } from "../../game/world/races";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValue),
    z.record(jsonValue),
  ]),
);

export const StoredCharacter = z
  .object({
    format: z.literal("server-character-1"),
    player: PlayerSchema.extend({
      x: z.number().finite().min(0).max(131072),
      y: z.number().finite().min(0).max(131072),
    }),
    // The simulation adapter supplies map, enemies and cooldown state here. Never accept this
    // envelope from a browser. A player-only checkpoint is not a complete online simulation.
    runtime: z.record(jsonValue),
  })
  .strict();
export type CharacterState = z.infer<typeof StoredCharacter>;
export type CharacterRecord = { id: string; revision: number; state: CharacterState };
export type Principal = { project: string; subject: string };
const principalSchema = z
  .object({ project: z.string().url(), subject: z.string().uuid() })
  .strict();
const raceSchema = z.enum(RACE_IDS);
const nickSchema = z.string().refine(isValidNick);
const MAX_BYTES = 4_000_000;

export class CharacterStoreError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "CONFLICT"
      | "OPERATION_REUSED"
      | "INVALID_STATE"
      | "SESSION_BUSY"
      | "LEASE_LOST"
      | "CHARACTER_LIMIT",
  ) {
    super(code);
  }
}

function checkedState(input: unknown): CharacterState {
  const parsed = StoredCharacter.parse(input);
  if (Buffer.byteLength(JSON.stringify(parsed)) > MAX_BYTES)
    throw new CharacterStoreError("INVALID_STATE");
  return parsed;
}

/** Server-private durable repository. No browser-supplied account ID or raw-save endpoint. */
export class PgCharacterRepository {
  constructor(private readonly sql: Sql) {}

  async ready(): Promise<void> {
    // SELECT 1 alone is insufficient: a missing schema must prevent online readiness.
    await this
      .sql`SELECT character_id,lease_id,lease_until FROM game.online_character_state LIMIT 0`;
    await this.sql`SELECT operation_id FROM game.online_character_operations LIMIT 0`;
  }

  async acquire(principal: Principal, characterId: string, leaseId: string): Promise<void> {
    const owner = principalSchema.parse(principal);
    z.string().uuid().parse(characterId);
    z.string().uuid().parse(leaseId);
    await this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${characterId},1))`;
      const rows = await tx`UPDATE game.online_character_state s
      SET lease_id=${leaseId},lease_until=now()+interval '15 seconds'
      FROM game.characters c,game.accounts a
      WHERE s.character_id=${characterId} AND c.id=s.character_id AND a.id=c.account_id
      AND a.auth_subject=${owner.subject} AND a.auth_project=${owner.project} AND c.retired_at IS NULL
      AND (s.lease_id IS NULL OR s.lease_until<=now() OR s.lease_id=${leaseId}) RETURNING s.character_id`;
      if (!rows.length) throw new CharacterStoreError("SESSION_BUSY");
    });
  }

  async release(characterId: string, leaseId: string): Promise<void> {
    await this.sql`UPDATE game.online_character_state SET lease_id=NULL,lease_until=NULL
      WHERE character_id=${characterId} AND lease_id=${leaseId}`;
  }

  /** Reversible retirement: retain every checkpoint, never delete player data. */
  async retire(principal: Principal, characterId: string): Promise<void> {
    const owner = principalSchema.parse(principal);
    z.string().uuid().parse(characterId);
    await this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${characterId},1))`;
      const rows =
        await tx`SELECT s.character_id,(s.lease_id IS NOT NULL AND s.lease_until>now()) AS busy
        FROM game.online_character_state s JOIN game.characters c ON c.id=s.character_id
        JOIN game.accounts a ON a.id=c.account_id
        WHERE c.id=${characterId} AND a.auth_project=${owner.project} AND a.auth_subject=${owner.subject}
        AND c.retired_at IS NULL FOR UPDATE OF s`;
      if (!rows[0]) throw new CharacterStoreError("NOT_FOUND");
      if (rows[0]["busy"]) throw new CharacterStoreError("SESSION_BUSY");
      await tx`UPDATE game.characters SET retired_at=now() WHERE id=${characterId}`;
    });
  }

  async receipt(
    principal: Principal,
    characterId: string,
    operationId: string,
    digest: string,
  ): Promise<number | null> {
    await this.read(principal, characterId);
    const rows = await this
      .sql`SELECT command_digest,result_revision FROM game.online_character_operations
      WHERE character_id=${characterId} AND operation_id=${operationId}`;
    if (!rows[0]) return null;
    if (rows[0]["command_digest"] !== digest) throw new CharacterStoreError("OPERATION_REUSED");
    return Number(rows[0]["result_revision"]);
  }

  async create(principal: Principal, race: unknown, name: unknown): Promise<CharacterRecord> {
    const owner = principalSchema.parse(principal);
    const player = newPlayer(raceSchema.parse(race));
    player.name = nickSchema.parse(name);
    const id = randomUUID();
    const state = checkedState({ format: "server-character-1", player, runtime: {} });
    await this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${owner.project + ":" + owner.subject},0))`;
      const accounts = await tx`
        INSERT INTO game.accounts(auth_project,auth_subject) VALUES(${owner.project},${owner.subject})
        ON CONFLICT(auth_project,auth_subject) DO NOTHING
        RETURNING id`;
      const accountId = (accounts[0] ??
        (
          await tx`SELECT id FROM game.accounts
        WHERE auth_project=${owner.project} AND auth_subject=${owner.subject}`
        )[0])!["id"] as string;
      const count =
        await tx`SELECT count(*) AS n FROM game.characters WHERE account_id=${accountId} AND retired_at IS NULL`;
      if (Number(count[0]!["n"]) >= 12) throw new CharacterStoreError("CHARACTER_LIMIT");
      await tx`INSERT INTO game.characters(id,account_id,race) VALUES(${id},${accountId},${player.race})`;
      await tx`INSERT INTO game.online_character_state(character_id,revision,state)
        VALUES(${id},1,${tx.json(state)})`;
    });
    return { id, revision: 1, state };
  }

  async list(principal: Principal): Promise<CharacterRecord[]> {
    const owner = principalSchema.parse(principal);
    const rows = await this.sql`
      SELECT s.character_id,s.revision,s.state FROM game.online_character_state s
      JOIN game.characters c ON c.id=s.character_id JOIN game.accounts a ON a.id=c.account_id
      WHERE a.auth_project=${owner.project} AND a.auth_subject=${owner.subject} AND c.retired_at IS NULL
      ORDER BY c.created_at,c.id`;
    return rows.map((r) => ({
      id: r["character_id"] as string,
      revision: Number(r["revision"]),
      state: checkedState(r["state"]),
    }));
  }

  async read(principal: Principal, characterId: string): Promise<CharacterRecord> {
    const owner = principalSchema.parse(principal);
    z.string().uuid().parse(characterId);
    const rows = await this.sql`
      SELECT s.revision,s.state FROM game.online_character_state s
      JOIN game.characters c ON c.id=s.character_id JOIN game.accounts a ON a.id=c.account_id
      WHERE c.id=${characterId} AND a.auth_project=${owner.project}
      AND a.auth_subject=${owner.subject} AND c.retired_at IS NULL`;
    if (!rows[0]) throw new CharacterStoreError("NOT_FOUND");
    return {
      id: characterId,
      revision: Number(rows[0]["revision"]),
      state: checkedState(rows[0]["state"]),
    };
  }

  /** Only the trusted simulation calls commit. State, revision and operation result are atomic.
   * Retried operations return the original acknowledgement; reusing an ID for a different
   * command fails. Ownership is checked before the operation lookup, even on retries.
   */
  async commit(input: {
    principal: Principal;
    characterId: string;
    expectedRevision: number;
    operationId: string;
    commandDigest: string;
    state: CharacterState;
    leaseId?: string;
    checkpointOnly?: boolean;
  }): Promise<{ revision: number; duplicate: boolean }> {
    const owner = principalSchema.parse(input.principal);
    z.string().uuid().parse(input.characterId);
    z.string().uuid().parse(input.operationId);
    z.number().int().positive().safe().parse(input.expectedRevision);
    z.string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(input.commandDigest);
    const next = checkedState(input.state);
    return this.sql.begin(async (tx) => {
      const rows = await tx`
        SELECT s.revision,s.state,c.race,s.lease_id,(s.lease_until>now()) AS lease_valid FROM game.online_character_state s
        JOIN game.characters c ON c.id=s.character_id JOIN game.accounts a ON a.id=c.account_id
        WHERE c.id=${input.characterId} AND a.auth_project=${owner.project}
        AND a.auth_subject=${owner.subject} AND c.retired_at IS NULL FOR UPDATE OF s`;
      if (!rows[0]) throw new CharacterStoreError("NOT_FOUND");
      if (
        (rows[0]["lease_id"] || input.leaseId) &&
        (rows[0]["lease_id"] !== input.leaseId || rows[0]["lease_valid"] !== true)
      )
        throw new CharacterStoreError("LEASE_LOST");
      const previous = input.checkpointOnly
        ? []
        : await tx`
        SELECT command_digest,result_revision FROM game.online_character_operations
        WHERE character_id=${input.characterId} AND operation_id=${input.operationId}`;
      if (previous[0]) {
        if (previous[0]["command_digest"] !== input.commandDigest)
          throw new CharacterStoreError("OPERATION_REUSED");
        return { revision: Number(previous[0]["result_revision"]), duplicate: true };
      }
      const current = Number(rows[0]["revision"]);
      if (current !== input.expectedRevision) throw new CharacterStoreError("CONFLICT");
      if (rows[0]["race"] !== next.player.race) throw new CharacterStoreError("INVALID_STATE");
      const old = checkedState(rows[0]["state"]);
      if (
        (old.player.development && !next.player.development) ||
        (old.player.combatTraining && !next.player.combatTraining)
      )
        throw new CharacterStoreError("INVALID_STATE");
      const revision = current + 1;
      await tx`UPDATE game.online_character_state SET revision=${revision},
        state=${tx.json(next)},updated_at=now(),
        lease_until=CASE WHEN lease_id IS NOT NULL THEN now()+interval '15 seconds' ELSE NULL END
        WHERE character_id=${input.characterId}`;
      if (!input.checkpointOnly)
        await tx`INSERT INTO game.online_character_operations
        (character_id,operation_id,command_digest,result_revision)
        VALUES(${input.characterId},${input.operationId},${input.commandDigest},${revision})`;
      return { revision, duplicate: false };
    });
  }
}

/** Use the normalized, schema-validated command, not JSON supplied verbatim by the client. */
export function commandDigest(command: unknown): string {
  return createHash("sha256").update(JSON.stringify(command)).digest("hex");
}
export type ServerPlayer = Player;
