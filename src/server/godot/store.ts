import type { Sql } from "postgres";
import { z } from "zod";
import { checkSave, type GodotSave } from "./saveRules";
import { ContentError, ContentFiles, VERSION_PATTERN, type ContentManifest } from "./contentFiles";

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
  constructor(
    private readonly sql: Sql,
    readonly files: ContentFiles,
  ) {}

  async ready() {
    await this.sql`SELECT version FROM godot_android.schema_version LIMIT 1`;
    // The single settings row is part of the schema, but a restore or a manual clean-up must never leave the API without it.
    await this.sql`INSERT INTO godot_android.settings (id) VALUES (1) ON CONFLICT DO NOTHING`;
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
