import type { Sql } from "postgres";

export type FriendEntry = {
  accountId: string;
  nick: string;
};

export type FriendsSnapshot = {
  accepted: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
};

export type GuildRole = "leader" | "officer" | "member";

export type GuildMemberEntry = {
  accountId: string;
  nick: string;
  role: GuildRole;
  joinedAt: string;
};

export type GuildSnapshot = {
  id: string;
  name: string;
  tag: string;
  role: GuildRole;
  leaderAccountId: string;
  members: GuildMemberEntry[];
};

export class SocialError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const MAX_FRIENDS = 60;
const MAX_GUILD_MEMBERS = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function cleanGuildName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanGuildTag(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 5);
}

/**
 * Persistent social graph for the Android game: mutual friendships (with pending requests)
 * and guilds/clans with unique short tags, stored in `godot_android.*`.
 */
export class GodotSocialStore {
  private available: boolean | null = null;

  constructor(private readonly sql: Sql) {}

  async isReady(): Promise<boolean> {
    if (this.available !== null) return this.available;
    try {
      const [row] = await this.sql<{ ok: boolean }[]>`
        SELECT (
          to_regclass('godot_android.friendships') IS NOT NULL
          AND to_regclass('godot_android.guilds') IS NOT NULL
          AND to_regclass('godot_android.guild_members') IS NOT NULL
        ) AS ok`;
      this.available = Boolean(row?.ok);
    } catch {
      this.available = false;
    }
    return this.available;
  }

  resetCache(): void {
    this.available = null;
  }

  private async requireReady(): Promise<void> {
    if (!(await this.isReady())) {
      throw new SocialError(
        "SOCIAL_UNAVAILABLE",
        "Funkcje społecznościowe czekają na migrację bazy danych.",
      );
    }
  }

  async resolveAccount(query: string): Promise<{ id: string; nick: string } | null> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length > 40) return null;
    const [row] = UUID_RE.test(trimmed)
      ? await this.sql<{ id: string; nick: string }[]>`
          SELECT id, nick FROM accounts.users
          WHERE id = ${trimmed} AND disabled_at IS NULL LIMIT 1`
      : await this.sql<{ id: string; nick: string }[]>`
          SELECT id, nick FROM accounts.users
          WHERE lower(nick) = lower(${trimmed}) AND disabled_at IS NULL LIMIT 1`;
    return row ?? null;
  }

  /* -------------------------------- friends -------------------------------- */

  async listFriends(accountId: string): Promise<FriendsSnapshot> {
    if (!(await this.isReady())) return { accepted: [], incoming: [], outgoing: [] };
    const rows = await this.sql<
      { other_id: string; nick: string; status: string; requested_by: string }[]
    >`
      SELECT
        CASE WHEN f.account_a = ${accountId} THEN f.account_b ELSE f.account_a END AS other_id,
        u.nick,
        f.status,
        f.requested_by
      FROM godot_android.friendships f
      JOIN accounts.users u
        ON u.id = CASE WHEN f.account_a = ${accountId} THEN f.account_b ELSE f.account_a END
      WHERE (f.account_a = ${accountId} OR f.account_b = ${accountId})
        AND u.disabled_at IS NULL
      ORDER BY u.nick ASC`;
    const accepted: FriendEntry[] = [];
    const incoming: FriendEntry[] = [];
    const outgoing: FriendEntry[] = [];
    for (const r of rows) {
      const entry = { accountId: r.other_id, nick: r.nick };
      if (r.status === "accepted") accepted.push(entry);
      else if (r.requested_by === accountId) outgoing.push(entry);
      else incoming.push(entry);
    }
    return { accepted, incoming, outgoing };
  }

  async areFriends(accountA: string, accountB: string): Promise<boolean> {
    if (accountA === accountB || !(await this.isReady())) return false;
    const [a, b] = orderedPair(accountA, accountB);
    const [row] = await this.sql<{ ok: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM godot_android.friendships
        WHERE account_a = ${a} AND account_b = ${b} AND status = 'accepted'
      ) AS ok`;
    return Boolean(row?.ok);
  }

  async requestFriend(
    fromAccountId: string,
    targetQuery: string,
  ): Promise<{ targetId: string; targetNick: string; status: "pending" | "accepted" }> {
    await this.requireReady();
    const target = await this.resolveAccount(targetQuery);
    if (!target) throw new SocialError("NOT_FOUND", "Nie znaleziono gracza o takim nicku.");
    if (target.id === fromAccountId)
      throw new SocialError("INVALID_TARGET", "Nie możesz dodać samego siebie.");
    const [countRow] = await this.sql<{ c: string }[]>`
      SELECT count(*) AS c FROM godot_android.friendships
      WHERE account_a = ${fromAccountId} OR account_b = ${fromAccountId}`;
    if (Number(countRow?.c ?? 0) >= MAX_FRIENDS)
      throw new SocialError("LIMIT_REACHED", `Limit znajomych (${MAX_FRIENDS}) został osiągnięty.`);

    const [a, b] = orderedPair(fromAccountId, target.id);
    const [existing] = await this.sql<{ status: string; requested_by: string }[]>`
      SELECT status, requested_by FROM godot_android.friendships
      WHERE account_a = ${a} AND account_b = ${b}`;
    if (existing) {
      if (existing.status === "accepted")
        throw new SocialError("ALREADY_FRIENDS", `${target.nick} jest już na liście znajomych.`);
      if (existing.requested_by === fromAccountId)
        throw new SocialError("ALREADY_PENDING", `Zaproszenie dla ${target.nick} już oczekuje.`);
      // Mutual invitation -> accept immediately
      await this.sql`
        UPDATE godot_android.friendships
        SET status = 'accepted', updated_at = now()
        WHERE account_a = ${a} AND account_b = ${b}`;
      return { targetId: target.id, targetNick: target.nick, status: "accepted" };
    }
    await this.sql`
      INSERT INTO godot_android.friendships (account_a, account_b, status, requested_by)
      VALUES (${a}, ${b}, 'pending', ${fromAccountId})`;
    return { targetId: target.id, targetNick: target.nick, status: "pending" };
  }

  async acceptFriend(
    accountId: string,
    otherQuery: string,
  ): Promise<{ otherId: string; otherNick: string }> {
    await this.requireReady();
    const other = await this.resolveAccount(otherQuery);
    if (!other) throw new SocialError("NOT_FOUND", "Nie znaleziono gracza.");
    const [a, b] = orderedPair(accountId, other.id);
    const updated = await this.sql`
      UPDATE godot_android.friendships
      SET status = 'accepted', updated_at = now()
      WHERE account_a = ${a} AND account_b = ${b}
        AND status = 'pending' AND requested_by = ${other.id}
      RETURNING status`;
    if (updated.length === 0)
      throw new SocialError("NOT_FOUND", "Brak oczekującego zaproszenia od tego gracza.");
    return { otherId: other.id, otherNick: other.nick };
  }

  async removeFriend(
    accountId: string,
    otherQuery: string,
  ): Promise<{ otherId: string; otherNick: string }> {
    await this.requireReady();
    const other = await this.resolveAccount(otherQuery);
    if (!other) throw new SocialError("NOT_FOUND", "Nie znaleziono gracza.");
    const [a, b] = orderedPair(accountId, other.id);
    const deleted = await this.sql`
      DELETE FROM godot_android.friendships
      WHERE account_a = ${a} AND account_b = ${b}
      RETURNING status`;
    if (deleted.length === 0)
      throw new SocialError("NOT_FOUND", "Ten gracz nie znajduje się na liście znajomych.");
    return { otherId: other.id, otherNick: other.nick };
  }

  /* -------------------------------- guilds -------------------------------- */

  async getGuildMeta(
    accountId: string,
  ): Promise<{ id: string; name: string; tag: string; role: GuildRole } | null> {
    if (!(await this.isReady())) return null;
    const [row] = await this.sql<{ id: string; name: string; tag: string; role: GuildRole }[]>`
      SELECT g.id, g.name, g.tag, gm.role
      FROM godot_android.guild_members gm
      JOIN godot_android.guilds g ON g.id = gm.guild_id
      WHERE gm.account_id = ${accountId}
      LIMIT 1`;
    return row ?? null;
  }

  async getGuildSnapshot(accountId: string): Promise<GuildSnapshot | null> {
    if (!(await this.isReady())) return null;
    const [mine] = await this.sql<
      { id: string; name: string; tag: string; role: GuildRole; leader_account_id: string }[]
    >`
      SELECT g.id, g.name, g.tag, gm.role, g.leader_account_id
      FROM godot_android.guild_members gm
      JOIN godot_android.guilds g ON g.id = gm.guild_id
      WHERE gm.account_id = ${accountId}
      LIMIT 1`;
    if (!mine) return null;
    const members = await this.sql<
      { account_id: string; nick: string; role: GuildRole; joined_at: Date }[]
    >`
      SELECT gm.account_id, u.nick, gm.role, gm.joined_at
      FROM godot_android.guild_members gm
      JOIN accounts.users u ON u.id = gm.account_id
      WHERE gm.guild_id = ${mine.id} AND u.disabled_at IS NULL
      ORDER BY
        CASE gm.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,
        gm.joined_at ASC`;
    return {
      id: mine.id,
      name: mine.name,
      tag: mine.tag,
      role: mine.role,
      leaderAccountId: mine.leader_account_id,
      members: members.map((m) => ({
        accountId: m.account_id,
        nick: m.nick,
        role: m.role,
        joinedAt: m.joined_at.toISOString(),
      })),
    };
  }

  async createGuild(accountId: string, rawName: unknown, rawTag: unknown): Promise<GuildSnapshot> {
    await this.requireReady();
    const name = cleanGuildName(rawName);
    const tag = cleanGuildTag(rawTag);
    if (name.length < 3 || name.length > 24)
      throw new SocialError("INVALID_NAME", "Nazwa gildii musi mieć 3–24 znaki.");
    if (tag.length < 2 || tag.length > 5 || !/^[A-Z0-9]+$/.test(tag))
      throw new SocialError("INVALID_TAG", "Tag gildii musi mieć 2–5 liter lub cyfr (A–Z, 0–9).");
    const existing = await this.getGuildMeta(accountId);
    if (existing)
      throw new SocialError("ALREADY_IN_GUILD", `Należysz już do gildii <${existing.tag}>.`);
    try {
      await this.sql.begin(async (tx) => {
        const q = tx as unknown as Sql;
        const [created] = await q<{ id: string }[]>`
          INSERT INTO godot_android.guilds (name, tag, leader_account_id)
          VALUES (${name}, ${tag}, ${accountId})
          RETURNING id`;
        await q`
          INSERT INTO godot_android.guild_members (account_id, guild_id, role)
          VALUES (${accountId}, ${created!.id}, 'leader')`;
      });
    } catch (e: unknown) {
      const code = (e as { code?: string } | null)?.code;
      if (code === "23505")
        throw new SocialError("DUPLICATE_GUILD", "Gildia o tej nazwie lub tagu już istnieje.");
      throw e;
    }
    const snap = await this.getGuildSnapshot(accountId);
    if (!snap) throw new SocialError("GUILD_ERROR", "Nie udało się utworzyć gildii.");
    return snap;
  }

  async joinGuild(accountId: string, guildId: string): Promise<GuildSnapshot> {
    await this.requireReady();
    if (!UUID_RE.test(guildId)) throw new SocialError("NOT_FOUND", "Nie znaleziono gildii.");
    const existing = await this.getGuildMeta(accountId);
    if (existing)
      throw new SocialError("ALREADY_IN_GUILD", `Należysz już do gildii <${existing.tag}>.`);
    await this.sql.begin(async (tx) => {
      const q = tx as unknown as Sql;
      const [g] = await q<{ id: string }[]>`
        SELECT id FROM godot_android.guilds WHERE id = ${guildId} FOR UPDATE`;
      if (!g) throw new SocialError("NOT_FOUND", "Ta gildia już nie istnieje.");
      const [cnt] = await q<{ c: string }[]>`
        SELECT count(*) AS c FROM godot_android.guild_members WHERE guild_id = ${guildId}`;
      if (Number(cnt?.c ?? 0) >= MAX_GUILD_MEMBERS)
        throw new SocialError(
          "GUILD_FULL",
          `Gildia osiągnęła limit ${MAX_GUILD_MEMBERS} członków.`,
        );
      await q`
        INSERT INTO godot_android.guild_members (account_id, guild_id, role)
        VALUES (${accountId}, ${guildId}, 'member')`;
    });
    const snap = await this.getGuildSnapshot(accountId);
    if (!snap) throw new SocialError("GUILD_ERROR", "Nie udało się dołączyć do gildii.");
    return snap;
  }

  async leaveGuild(accountId: string): Promise<{ guildId: string; disbanded: boolean }> {
    await this.requireReady();
    const mine = await this.getGuildMeta(accountId);
    if (!mine) throw new SocialError("NOT_IN_GUILD", "Nie należysz do żadnej gildii.");
    let disbanded = false;
    await this.sql.begin(async (tx) => {
      const q = tx as unknown as Sql;
      await q`SELECT id FROM godot_android.guilds WHERE id = ${mine.id} FOR UPDATE`;
      await q`DELETE FROM godot_android.guild_members WHERE account_id = ${accountId}`;
      const remaining = await q<{ account_id: string }[]>`
        SELECT account_id FROM godot_android.guild_members
        WHERE guild_id = ${mine.id}
        ORDER BY CASE role WHEN 'officer' THEN 0 ELSE 1 END, joined_at ASC
        LIMIT 1`;
      if (remaining.length === 0) {
        await q`DELETE FROM godot_android.guilds WHERE id = ${mine.id}`;
        disbanded = true;
      } else if (mine.role === "leader") {
        const nextLeader = remaining[0]!.account_id;
        await q`UPDATE godot_android.guild_members SET role = 'leader' WHERE account_id = ${nextLeader}`;
        await q`UPDATE godot_android.guilds SET leader_account_id = ${nextLeader} WHERE id = ${mine.id}`;
      }
    });
    return { guildId: mine.id, disbanded };
  }

  async kickGuildMember(
    actorAccountId: string,
    targetQuery: string,
  ): Promise<{ guildId: string; targetId: string; targetNick: string }> {
    await this.requireReady();
    const mine = await this.getGuildMeta(actorAccountId);
    if (!mine) throw new SocialError("NOT_IN_GUILD", "Nie należysz do żadnej gildii.");
    if (mine.role !== "leader" && mine.role !== "officer")
      throw new SocialError("FORBIDDEN", "Tylko lider lub oficer może usuwać członków.");
    const target = await this.resolveAccount(targetQuery);
    if (!target) throw new SocialError("NOT_FOUND", "Nie znaleziono gracza.");
    if (target.id === actorAccountId)
      throw new SocialError("INVALID_TARGET", "Użyj opcji Opuść gildię.");
    const [member] = await this.sql<{ role: GuildRole }[]>`
      SELECT role FROM godot_android.guild_members
      WHERE guild_id = ${mine.id} AND account_id = ${target.id}`;
    if (!member) throw new SocialError("NOT_FOUND", "Ten gracz nie należy do Twojej gildii.");
    if (member.role === "leader" || (mine.role === "officer" && member.role === "officer"))
      throw new SocialError("FORBIDDEN", "Nie możesz wyrzucić gracza o równej lub wyższej randze.");
    await this.sql`
      DELETE FROM godot_android.guild_members
      WHERE guild_id = ${mine.id} AND account_id = ${target.id}`;
    return { guildId: mine.id, targetId: target.id, targetNick: target.nick };
  }
}
