import type { Sql } from "postgres";
import { z } from "zod";
import { checkSave, type GodotSave } from "./saveRules";
import { ContentError, ContentFiles, VERSION_PATTERN, type ContentManifest } from "./contentFiles";
import {
  ANDROID_LANDS,
  ANDROID_RACES,
  AndroidEconomyError,
  applyAdminCharacterPatch,
  applyAndroidAction,
  characterNameSchema,
  computeAndroidStats,
  createInitialAndroidState,
  MAX_PLAYER_ANDROID_CHARACTERS,
  normalizeAndroidState,
  type AndroidCharacterView,
  type AndroidLootDrop,
  type AndroidHeroState,
  type AndroidLand,
  type AndroidRace,
} from "./economy";
import { listGoalsForCharacter } from "./goals";
import { GodotSocialStore } from "./social";

export type Settings = {
  activeVersion: string | null;
  minClientCode: number;
  maintenance: boolean;
  maintenanceMessage: string | null;
  news: string | null;
  updatedAt: string;
};

export type SaveRow = {
  slot: number;
  revision: number;
  race: string;
  land: string;
  level: number;
  bytes: number;
  contentVersion: string | null;
  updatedAt: string;
};

export class RevisionConflict extends Error {
  constructor(readonly serverRevision: number) {
    super("REVISION_CONFLICT");
  }
}

const settingsPatch = z
  .object({
    minClientCode: z.number().int().min(0).max(1_000_000).optional(),
    maintenance: z.boolean().optional(),
    maintenanceMessage: z.string().max(300).nullable().optional(),
    news: z.string().max(300).nullable().optional(),
  })
  .strict();

const manifestSchema = z.object({
  format: z.literal("ki-godot-content-1"),
  version: z.string().regex(VERSION_PATTERN),
  engine: z.string().max(20).optional(),
  createdAt: z.string().max(40).optional(),
  packs: z.record(
    z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(40),
    z.object({
      file: z.string().max(80),
      bytes: z.number().int().min(1),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      files: z.number().int().optional(),
    }),
  ),
  lands: z.record(z.string().max(20), z.array(z.string().max(40)).max(30)),
});

type SettingsRow = {
  active_version: string | null;
  min_client_code: number;
  maintenance: boolean;
  maintenance_message: string | null;
  news: string | null;
  updated_at: Date;
};

/** Cloud saves, content releases and client gating of the Android game, on the VPS database. */
export class GodotStore {
  readonly social: GodotSocialStore;

  constructor(
    private readonly sql: Sql,
    readonly files: ContentFiles,
  ) {
    this.social = new GodotSocialStore(sql);
  }

  async ready() {
    await this.sql`SELECT version FROM godot_android.schema_version LIMIT 1`;
    // The single settings row is part of the schema, but a restore or a manual clean-up must never leave the API without it.
    await this.sql`INSERT INTO godot_android.settings (id) VALUES (1) ON CONFLICT DO NOTHING`;
    this.social.resetCache();
    await this.social.isReady();
  }

  /* -------------------------------- settings -------------------------------- */

  async settings(): Promise<Settings> {
    const [r] = await this.sql<SettingsRow[]>`SELECT * FROM godot_android.settings WHERE id = 1`;
    if (!r) throw new Error("settings row missing");
    return {
      activeVersion: r.active_version,
      minClientCode: r.min_client_code,
      maintenance: r.maintenance,
      maintenanceMessage: r.maintenance_message,
      news: r.news,
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async updateSettings(actor: string, patch: unknown): Promise<Settings> {
    const p = settingsPatch.parse(patch);
    const current = await this.settings();
    await this.sql`UPDATE godot_android.settings SET
      min_client_code = ${p.minClientCode ?? current.minClientCode},
      maintenance = ${p.maintenance ?? current.maintenance},
      maintenance_message = ${p.maintenanceMessage === undefined ? current.maintenanceMessage : p.maintenanceMessage},
      news = ${p.news === undefined ? current.news : p.news},
      updated_by = ${actor}, updated_at = now() WHERE id = 1`;
    return this.settings();
  }

  /* -------------------------------- releases -------------------------------- */

  async releases() {
    const rows = await this.sql<
      { version: string; manifest: ContentManifest; note: string | null; created_at: Date }[]
    >`SELECT version, manifest, note, created_at FROM godot_android.releases ORDER BY created_at DESC LIMIT 100`;
    return rows.map((r) => ({
      version: r.version,
      note: r.note,
      createdAt: r.created_at.toISOString(),
      packs: Object.keys(r.manifest.packs).length,
      bytes: Object.values(r.manifest.packs).reduce((sum, p) => sum + p.bytes, 0),
    }));
  }

  async manifest(version: string): Promise<ContentManifest | null> {
    const [r] = await this.sql<{ manifest: ContentManifest }[]>`
      SELECT manifest FROM godot_android.releases WHERE version = ${version}`;
    return r?.manifest ?? null;
  }

  /** Registers a release after checking that every pack it names is on the volume with the declared size and SHA-256. */
  async createRelease(
    actor: string,
    manifest: unknown,
    note: string | null,
  ): Promise<ContentManifest> {
    const parsed = manifestSchema.parse(manifest) as ContentManifest;
    await this.files.verify(parsed);
    await this.sql`INSERT INTO godot_android.releases (version, manifest, note, created_by)
      VALUES (${parsed.version}, ${this.sql.json(parsed as never)}, ${note}, ${actor})
      ON CONFLICT (version) DO UPDATE SET manifest = EXCLUDED.manifest, note = EXCLUDED.note`;
    return parsed;
  }

  async activate(actor: string, version: string): Promise<void> {
    if (!(await this.manifest(version))) throw new ContentError("NOT_FOUND");
    await this
      .sql`UPDATE godot_android.settings SET active_version = ${version}, updated_by = ${actor}, updated_at = now() WHERE id = 1`;
  }

  async deleteRelease(version: string): Promise<void> {
    const s = await this.settings();
    if (s.activeVersion === version) throw new ContentError("BAD_VERSION", "Wydanie jest aktywne.");
    await this.sql`DELETE FROM godot_android.releases WHERE version = ${version}`;
    await this.files.remove(version);
  }

  /* ---------------------------------- saves ---------------------------------- */

  async listSaves(account: string): Promise<SaveRow[]> {
    const rows = await this.sql<
      {
        slot: number;
        revision: string;
        race: string;
        land: string;
        level: number;
        bytes: number;
        content_version: string | null;
        updated_at: Date;
      }[]
    >`SELECT slot, revision, race, land, level, bytes, content_version, updated_at
      FROM godot_android.saves WHERE account_id = ${account} ORDER BY slot`;
    return rows.map(toRow);
  }

  async readSave(
    account: string,
    slot: number,
  ): Promise<{ revision: number; save: GodotSave } | null> {
    const [r] = await this.sql<{ revision: string; data: GodotSave }[]>`
      SELECT revision, data FROM godot_android.saves WHERE account_id = ${account} AND slot = ${slot}`;
    return r ? { revision: Number(r.revision), save: r.data } : null;
  }

  /**
   * Writes a save. `baseRevision` is the revision the device started from (0 = first save of the slot): when another device wrote in
   * between, the write is refused with the server's revision so the device can ask the player which save to keep.
   */
  async writeSave(
    account: string,
    slot: number,
    baseRevision: number,
    data: unknown,
    meta: { clientCode: number; contentVersion: string | null },
  ): Promise<{ revision: number; updatedAt: string }> {
    const { save, summary } = checkSave(data);
    return this.sql.begin(async (tx) => {
      const [current] = await tx<{ revision: string }[]>`
        SELECT revision FROM godot_android.saves WHERE account_id = ${account} AND slot = ${slot} FOR UPDATE`;
      const have = current ? Number(current.revision) : 0;
      if (have !== baseRevision) throw new RevisionConflict(have);
      const next = have + 1;
      const [row] = await tx<{ updated_at: Date }[]>`
        INSERT INTO godot_android.saves
          (account_id, slot, revision, data, race, land, level, client_code, content_version, bytes)
        VALUES (${account}, ${slot}, ${next}, ${tx.json(save as never)}, ${summary.race}, ${summary.land}, ${summary.level},
                ${meta.clientCode}, ${meta.contentVersion}, ${summary.bytes})
        ON CONFLICT (account_id, slot) DO UPDATE SET revision = EXCLUDED.revision, data = EXCLUDED.data, race = EXCLUDED.race,
          land = EXCLUDED.land, level = EXCLUDED.level, client_code = EXCLUDED.client_code,
          content_version = EXCLUDED.content_version, bytes = EXCLUDED.bytes, updated_at = now()
        RETURNING updated_at`;
      return { revision: next, updatedAt: row!.updated_at.toISOString() };
    });
  }

  async deleteSave(account: string, slot: number): Promise<boolean> {
    const rows = await this
      .sql`DELETE FROM godot_android.saves WHERE account_id = ${account} AND slot = ${slot} RETURNING 1`;
    return rows.length > 0;
  }

  /* ---------------------------------- admin ---------------------------------- */

  async adminSaves(query: string) {
    const q = "%" + query.trim().toLowerCase().replace(/[%_]/g, "") + "%";
    const rows = await this.sql<
      {
        account_id: string;
        nick: string;
        email: string;
        slot: number;
        revision: string;
        race: string;
        land: string;
        level: number;
        bytes: number;
        client_code: number;
        content_version: string | null;
        updated_at: Date;
      }[]
    >`SELECT s.account_id, u.nick, u.email, s.slot, s.revision, s.race, s.land, s.level, s.bytes, s.client_code,
             s.content_version, s.updated_at
      FROM godot_android.saves s JOIN accounts.users u ON u.id = s.account_id
      WHERE lower(u.nick) LIKE ${q} OR lower(u.email) LIKE ${q}
      ORDER BY s.updated_at DESC LIMIT 200`;
    return rows.map((r) => ({
      accountId: r.account_id,
      nick: r.nick,
      email: r.email,
      slot: r.slot,
      revision: Number(r.revision),
      race: r.race,
      land: r.land,
      level: r.level,
      bytes: r.bytes,
      clientCode: r.client_code,
      contentVersion: r.content_version,
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async stats() {
    const [r] = await this.sql<
      { saves: string; accounts: string; last: Date | null; bytes: string | null }[]
    >`
      SELECT count(*) AS saves, count(DISTINCT account_id) AS accounts, max(updated_at) AS last, sum(bytes) AS bytes
      FROM godot_android.saves`;
    return {
      saves: Number(r?.saves ?? 0),
      accounts: Number(r?.accounts ?? 0),
      bytes: Number(r?.bytes ?? 0),
      lastWriteAt: r?.last?.toISOString() ?? null,
    };
  }

  /* --------------------- authoritative Android characters --------------------- */

  /** Bridges any browser characters (game.online_character_state) of this account into godot_android.characters once. */
  private async bridgeBrowserCharacters(accountId: string): Promise<void> {
    try {
      const browserRows = await this.sql<
        { character_id: string; race: string; state: Record<string, unknown> }[]
      >`SELECT c.id AS character_id, c.race, s.state
        FROM game.online_character_state s
        JOIN game.characters c ON c.id = s.character_id
        JOIN game.accounts a ON a.id = c.account_id
        WHERE a.auth_subject = ${accountId} AND c.retired_at IS NULL
        ORDER BY c.created_at, c.id`;
      for (const b of browserRows) {
        if (!ANDROID_RACES.includes(b.race as AndroidRace)) continue;
        const race = b.race as AndroidRace;
        const player = (b.state?.["player"] ?? {}) as Record<string, unknown>;
        const rawName = typeof player["name"] === "string" ? player["name"].trim() : "";
        const baseName =
          rawName.length >= 3 ? rawName.slice(0, 16) : `Bohater_${b.character_id.slice(0, 6)}`;
        const skillsRaw = Array.isArray(player["skills"])
          ? player["skills"].filter((x): x is string => typeof x === "string")
          : ["R"];
        const potionsRaw = (player["items"] as Record<string, unknown> | undefined)?.["potion"];
        const init = createInitialAndroidState(race, {
          level: Number(player["level"] ?? 1),
          xp: Number(player["xp"] ?? 0),
          gold: Number(player["gold"] ?? 120),
          unlockedNodes: skillsRaw,
          potions: typeof potionsRaw === "number" ? potionsRaw : 3,
        });
        const [exists] = await this.sql<{ id: string }[]>`
          SELECT id FROM godot_android.characters
          WHERE account_id = ${accountId} AND browser_character_id = ${b.character_id}`;
        if (exists) continue;
        let candidateName = baseName;
        for (let attempt = 0; attempt < 5; attempt++) {
          const [taken] = await this.sql<{ id: string }[]>`
            SELECT id FROM godot_android.characters WHERE lower(name) = lower(${candidateName})`;
          if (!taken) break;
          const suffix = `_${b.character_id.slice(0, 3)}${attempt || ""}`;
          candidateName = baseName.slice(0, 16 - suffix.length) + suffix;
        }
        await this.sql`
          INSERT INTO godot_android.characters
            (account_id, name, race, land, level, gold, revision, state, browser_character_id)
          VALUES (${accountId}, ${candidateName}, ${race}, ${init.land}, ${init.level}, ${init.gold}, 1,
                  ${this.sql.json(init.state as never)}, ${b.character_id})
          ON CONFLICT DO NOTHING`;
      }
    } catch {
      // Optional bridge: if game.online_character_state is not present in a minimal DB, continue cleanly.
    }
  }

  async listCharacters(accountId: string): Promise<AndroidCharacterView[]> {
    await this.bridgeBrowserCharacters(accountId);
    const rows = await this.sql<CharacterDbRow[]>`
      SELECT c.*, u.nick AS owner_nick, u.email AS owner_email
      FROM godot_android.characters c
      LEFT JOIN accounts.users u ON u.id = c.account_id
      WHERE c.account_id = ${accountId}
      ORDER BY c.updated_at DESC, c.created_at DESC`;
    return rows.map(toCharacterView);
  }

  async getCharacter(accountId: string, characterId: string): Promise<AndroidCharacterView | null> {
    const [row] = await this.sql<CharacterDbRow[]>`
      SELECT c.*, u.nick AS owner_nick, u.email AS owner_email
      FROM godot_android.characters c
      LEFT JOIN accounts.users u ON u.id = c.account_id
      WHERE c.id = ${characterId} AND c.account_id = ${accountId}`;
    return row ? toCharacterView(row) : null;
  }

  async createCharacter(
    accountId: string,
    input: { name: unknown; race: unknown; land?: unknown; level?: unknown; gold?: unknown },
    isAdmin = false,
  ): Promise<AndroidCharacterView> {
    const name = characterNameSchema.parse(input.name);
    const race = z.enum(ANDROID_RACES).parse(input.race);
    const init = createInitialAndroidState(race, {
      level: input.level !== undefined ? Number(input.level) : 1,
      gold: input.gold !== undefined ? Number(input.gold) : 120,
    });
    const land: AndroidLand =
      input.land !== undefined ? z.enum(ANDROID_LANDS).parse(input.land) : init.land;
    return this.sql.begin(async (tx) => {
      if (!isAdmin) {
        const [cnt] = await tx<{ n: string }[]>`
          SELECT count(*) AS n FROM godot_android.characters WHERE account_id = ${accountId}`;
        if (Number(cnt?.n ?? 0) >= MAX_PLAYER_ANDROID_CHARACTERS)
          throw new AndroidEconomyError(
            "CHARACTER_LIMIT",
            `Limit postaci (${MAX_PLAYER_ANDROID_CHARACTERS}) został osiągnięty.`,
          );
      }
      const [taken] = await tx<{ id: string }[]>`
        SELECT id FROM godot_android.characters WHERE lower(name) = lower(${name})`;
      if (taken) throw new AndroidEconomyError("NAME_TAKEN", "Ten nick postaci jest już zajęty.");
      const [row] = await tx<CharacterDbRow[]>`
        INSERT INTO godot_android.characters
          (account_id, name, race, land, level, gold, revision, state)
        VALUES (${accountId}, ${name}, ${race}, ${land}, ${init.level}, ${init.gold}, 1,
                ${tx.json(init.state as never)})
        RETURNING *, NULL::text AS owner_nick, NULL::text AS owner_email`;
      return toCharacterView(row!);
    });
  }

  async deleteCharacter(accountId: string, characterId: string): Promise<boolean> {
    const rows = await this.sql`
      DELETE FROM godot_android.characters WHERE id = ${characterId} AND account_id = ${accountId} RETURNING 1`;
    return rows.length > 0;
  }

  /** Transaction-locked server-authoritative economy & progression action. */
  async executeCharacterAction(
    accountId: string,
    characterId: string,
    rawAction: unknown,
    opts: { isStaff: boolean },
  ): Promise<{
    character: AndroidCharacterView;
    notice: string;
    teleportCapital: boolean;
    lootDrop?: AndroidLootDrop;
  }> {
    return this.sql.begin(async (tx) => {
      const [row] = await tx<CharacterDbRow[]>`
        SELECT c.*, u.nick AS owner_nick, u.email AS owner_email
        FROM godot_android.characters c
        LEFT JOIN accounts.users u ON u.id = c.account_id
        WHERE c.id = ${characterId} AND c.account_id = ${accountId}
        FOR UPDATE OF c`;
      if (!row) throw new AndroidEconomyError("NOT_FOUND", "Nie znaleziono postaci.");
      const race = row.race as AndroidRace;
      const land = row.land as AndroidLand;
      const state = normalizeAndroidState(row.state, race, row.level);
      const res = applyAndroidAction(
        { race, land, level: row.level, gold: row.gold, state },
        rawAction,
        opts,
      );
      const nextRev = Number(row.revision) + 1;
      const [updated] = await tx<CharacterDbRow[]>`
        UPDATE godot_android.characters
        SET land = ${res.land}, level = ${res.level}, gold = ${res.gold},
            revision = ${nextRev}, state = ${tx.json(res.state as never)}, updated_at = now()
        WHERE id = ${characterId}
        RETURNING *, ${row.owner_nick}::text AS owner_nick, ${row.owner_email}::text AS owner_email`;
      return {
        character: toCharacterView(updated!),
        notice: res.notice,
        teleportCapital: Boolean(res.teleportCapital),
        ...(res.lootDrop ? { lootDrop: res.lootDrop } : {}),
      };
    });
  }

  /* ------------------- admin authoritative Android characters ------------------- */

  async adminListCharacters(query = "", accountId?: string): Promise<AndroidCharacterView[]> {
    const q = "%" + query.trim().toLowerCase().replace(/[%_]/g, "") + "%";
    const rows = accountId
      ? await this.sql<CharacterDbRow[]>`
          SELECT c.*, u.nick AS owner_nick, u.email AS owner_email
          FROM godot_android.characters c
          JOIN accounts.users u ON u.id = c.account_id
          WHERE c.account_id = ${accountId}
          ORDER BY c.updated_at DESC LIMIT 200`
      : await this.sql<CharacterDbRow[]>`
          SELECT c.*, u.nick AS owner_nick, u.email AS owner_email
          FROM godot_android.characters c
          JOIN accounts.users u ON u.id = c.account_id
          WHERE lower(c.name) LIKE ${q} OR lower(u.nick) LIKE ${q} OR lower(u.email) LIKE ${q}
          ORDER BY c.updated_at DESC LIMIT 200`;
    return rows.map(toCharacterView);
  }

  async adminGetCharacter(characterId: string): Promise<AndroidCharacterView | null> {
    const [row] = await this.sql<CharacterDbRow[]>`
      SELECT c.*, u.nick AS owner_nick, u.email AS owner_email
      FROM godot_android.characters c
      JOIN accounts.users u ON u.id = c.account_id
      WHERE c.id = ${characterId}`;
    return row ? toCharacterView(row) : null;
  }

  async adminUpdateCharacter(
    characterId: string,
    rawPatch: unknown,
  ): Promise<AndroidCharacterView> {
    return this.sql.begin(async (tx) => {
      const [row] = await tx<CharacterDbRow[]>`
        SELECT c.*, u.nick AS owner_nick, u.email AS owner_email
        FROM godot_android.characters c
        JOIN accounts.users u ON u.id = c.account_id
        WHERE c.id = ${characterId}
        FOR UPDATE OF c`;
      if (!row) throw new AndroidEconomyError("NOT_FOUND", "Nie znaleziono postaci.");
      const curState = normalizeAndroidState(row.state, row.race as AndroidRace, row.level);
      const next = applyAdminCharacterPatch(
        {
          name: row.name,
          race: row.race as AndroidRace,
          land: row.land as AndroidLand,
          level: row.level,
          gold: row.gold,
          state: curState,
        },
        rawPatch,
      );
      if (next.name.toLowerCase() !== row.name.toLowerCase()) {
        const [taken] = await tx<{ id: string }[]>`
          SELECT id FROM godot_android.characters
          WHERE lower(name) = lower(${next.name}) AND id <> ${characterId}`;
        if (taken) throw new AndroidEconomyError("NAME_TAKEN", "Ten nick postaci jest już zajęty.");
      }
      const nextRev = Number(row.revision) + 1;
      const [updated] = await tx<CharacterDbRow[]>`
        UPDATE godot_android.characters
        SET name = ${next.name}, race = ${next.race}, land = ${next.land},
            level = ${next.level}, gold = ${next.gold}, revision = ${nextRev},
            state = ${tx.json(next.state as never)}, updated_at = now()
        WHERE id = ${characterId}
        RETURNING *, ${row.owner_nick}::text AS owner_nick, ${row.owner_email}::text AS owner_email`;
      return toCharacterView(updated!);
    });
  }

  async adminDeleteCharacter(characterId: string): Promise<boolean> {
    const rows = await this.sql<{ browser_character_id: string | null }[]>`
      DELETE FROM godot_android.characters
      WHERE id = ${characterId}
      RETURNING browser_character_id`;
    if (rows.length === 0) return false;
    const bid = rows[0]?.browser_character_id;
    if (bid) {
      try {
        await this.sql`
          UPDATE game.characters SET retired_at = now()
          WHERE id = ${bid} AND retired_at IS NULL`;
      } catch {
        // Optional bridge table in minimal DBs.
      }
    }
    return true;
  }
}

type CharacterDbRow = {
  id: string;
  account_id: string;
  owner_nick: string | null;
  owner_email: string | null;
  name: string;
  race: string;
  land: string;
  level: number;
  gold: number;
  revision: string;
  state: AndroidHeroState;
  browser_character_id: string | null;
  created_at: Date;
  updated_at: Date;
};

function toCharacterView(r: CharacterDbRow): AndroidCharacterView {
  const race = r.race as AndroidRace;
  const land = r.land as AndroidLand;
  const normalized = normalizeAndroidState(r.state, race, r.level);
  const { pendingLoot: _pendingLoot, ...state } = normalized;
  const stats = computeAndroidStats(race, r.level, normalized);
  const goals = listGoalsForCharacter({ race, land, level: r.level, state: normalized });
  return {
    id: r.id,
    accountId: r.account_id,
    ...(r.owner_nick ? { ownerNick: r.owner_nick } : {}),
    ...(r.owner_email ? { ownerEmail: r.owner_email } : {}),
    name: r.name,
    race,
    land,
    level: r.level,
    gold: r.gold,
    revision: Number(r.revision),
    state,
    stats,
    goals,
    browserCharacterId: r.browser_character_id,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function toRow(r: {
  slot: number;
  revision: string;
  race: string;
  land: string;
  level: number;
  bytes: number;
  content_version: string | null;
  updated_at: Date;
}): SaveRow {
  return {
    slot: r.slot,
    revision: Number(r.revision),
    race: r.race,
    land: r.land,
    level: r.level,
    bytes: r.bytes,
    contentVersion: r.content_version,
    updatedAt: r.updated_at.toISOString(),
  };
}
