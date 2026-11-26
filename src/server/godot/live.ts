import type { WebSocket } from "ws";
import type { AccountService } from "../accounts/service";
import type { AndroidCharacterView } from "./economy";
import { LANDS, RACES } from "./saveRules";
import { SocialError, type GodotSocialStore, type GuildRole } from "./social";

type CharacterReader = (account: string, id: string) => Promise<AndroidCharacterView | null>;
type SocialProvider = () => GodotSocialStore | null;
type ChatScope = "world" | "land" | "local" | "whisper" | "party" | "guild";

export type LivePlayerSummary = {
  id: string;
  nick: string;
  name: string;
  race: string;
  level: number;
  land: string;
  guildTag: string | null;
  power: number;
  ki: boolean;
};

type Peer = {
  id: string;
  account: string;
  token: string;
  accessCheckedAt: number;
  accountCheckedAt: number;
  checkingAccess: boolean;
  nick: string;
  race: string;
  level: number;
  character: AndroidCharacterView | null;
  characterReadAt: number;
  landReadAt: number;
  land: string;
  x: number;
  y: number;
  facing: number;
  pose: string;
  action: number;
  transformed: boolean;
  visible: boolean;
  guildId: string | null;
  guildTag: string | null;
  guildName: string | null;
  guildRole: GuildRole | null;
  partyId: string | null;
  socket: WebSocket;
  lastChat: number;
  lastPos: number;
  lastInspect: number;
  lastSocial: number;
};

type Party = {
  id: string;
  leaderId: string;
  memberIds: string[];
};

type PendingInvite = {
  partyId?: string;
  guildId?: string;
  guildName?: string;
  guildTag?: string;
  fromPeerId: string;
  fromNick: string;
  expiresAt: number;
};

const ISOMETRIC_RADIUS = 620;
const LEGACY_RADIUS = 2600;
const MAX_PEERS_SENT = 24;
const MAX_CONNECTIONS = 300;
const MAX_PARTY_SIZE = 4;
const INVITE_TTL_MS = 60_000;
const TICK_MS = 250;
const CHARACTER_REFRESH_MS = 10_000;
const CHAT_COOLDOWN_MS = 1200;
const SOCIAL_COOLDOWN_MS = 450;
const POSES = new Set([
  "idle",
  "walk",
  "run",
  "attack",
  "attack2",
  "attack3",
  "skill",
  "skillb",
  "skillc",
  "finisher",
  "dodge",
  "guard",
  "hit",
  "hitheavy",
  "death",
  "respawn",
  "victory",
  "channel",
  "interact",
  "transform",
  "sk_A1",
  "sk_A4",
  "sk_A9",
  "sk_B1",
  "sk_B4",
  "sk_B9",
  "sk_C1",
  "sk_C4",
  "sk_C9",
  "kiattack",
  "kiattack2",
  "kiskill",
  "kiskillb",
  "kiskillc",
  "kifinisher",
  "kidodge",
  "kiguard",
  "kihit",
  "kihitheavy",
  "kideath",
  "kirespawn",
  "kivictory",
  "kichannel",
  "kiinteract",
  "kitransform",
]);

const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;

function send(peer: Peer, frame: unknown) {
  if (peer.socket.readyState === 1 && peer.socket.bufferedAmount < 64_000)
    peer.socket.send(JSON.stringify(frame));
}

function distance(a: Peer, b: Peer) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function near(a: Peer, b: Peer, radius: number) {
  return (
    Boolean(a.character) === Boolean(b.character) &&
    a.visible &&
    b.visible &&
    a.land === b.land &&
    distance(a, b) <= radius
  );
}

function power(character: AndroidCharacterView, transformed: boolean) {
  const { attack, defense, maxHp, maxKi } = character.stats;
  const atk = transformed ? Math.round(attack * 1.25) : attack;
  const def = transformed ? Math.round(defense * 1.15) : defense;
  return Math.round(maxHp + maxKi + 10 * (atk + def));
}

function cleanMessage(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  return Array.from(raw.replace(/[\p{Cc}\p{Cf}]/gu, " ").trim())
    .slice(0, maxLen)
    .join("");
}

/** Presence and social data for the Godot clients. Combat stays in its gameplay pipeline. */
export class GodotLive {
  private connections = new Set<WebSocket>();
  private peers = new Map<WebSocket, Peer>();
  private parties = new Map<string, Party>();
  private partyInvites = new Map<string, PendingInvite>(); // key: `${targetAccount}:${partyId}`
  private guildInvites = new Map<string, PendingInvite>(); // key: `${targetAccount}:${guildId}`
  private timer: NodeJS.Timeout | null = null;
  private seq = 0;
  private partySeq = 0;

  constructor(
    private readonly accounts: () => AccountService | null,
    private readonly admission?: (token: unknown) => Promise<void>,
    private readonly readCharacter?: CharacterReader,
    private readonly socialProvider?: SocialProvider,
  ) {}

  private activePeers() {
    return [...this.peers.values()].filter((p) => p.socket.readyState === 1 && !p.checkingAccess);
  }

  private peerById(id: string): Peer | undefined {
    for (const p of this.peers.values())
      if (p.id === id && p.socket.readyState === 1 && !p.checkingAccess) return p;
    return undefined;
  }

  private peerByAccount(accountId: string): Peer | undefined {
    for (const p of this.peers.values())
      if (p.account === accountId && p.socket.readyState === 1 && !p.checkingAccess) return p;
    return undefined;
  }

  private findModernPeer(query: unknown): Peer | undefined {
    if (typeof query !== "string") return undefined;
    const trimmed = query.trim();
    if (!trimmed || trimmed.length > 40) return undefined;
    const low = trimmed.toLowerCase();
    return this.activePeers().find(
      (p) =>
        Boolean(p.character) &&
        (p.id === trimmed ||
          p.account === trimmed ||
          p.nick.toLowerCase() === low ||
          p.character!.name.toLowerCase() === low),
    );
  }

  count() {
    const byLand: Record<string, number> = {};
    const peers = [...this.peers.values()].filter((peer) => peer.socket.readyState === 1);
    for (const peer of peers) byLand[peer.land] = (byLand[peer.land] ?? 0) + 1;
    return { count: peers.length, byLand };
  }

  players(): LivePlayerSummary[] {
    return [...this.peers.values()]
      .filter((p) => p.socket.readyState === 1)
      .map((p) => ({
        id: p.id,
        nick: p.nick,
        name: p.character?.name ?? p.nick,
        race: p.race,
        level: p.level,
        land: p.land,
        guildTag: p.guildTag,
        power: p.character ? power(p.character, p.transformed) : 0,
        ki: p.transformed,
      }))
      .sort((a, b) => b.level - a.level || a.nick.localeCompare(b.nick, "pl"));
  }

  broadcastSystem(rawText: string): number {
    const text = cleanMessage(rawText, 240);
    if (!text) return 0;
    const now = Date.now();
    let delivered = 0;
    for (const peer of this.activePeers()) {
      if (!peer.character) continue;
      send(peer, { t: "system", text, at: now });
      delivered++;
    }
    return delivered;
  }

  attach(socket: WebSocket) {
    if (this.connections.size >= MAX_CONNECTIONS) {
      socket.close(1013, "Serwer pełny");
      return;
    }
    this.connections.add(socket);
    let me: Peer | null = null;
    let signingIn = false;
    const deadline = setTimeout(() => {
      if (!me) socket.close(1008, "Brak uwierzytelnienia");
    }, 8000);
    socket.on("message", async (raw) => {
      let msg: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(raw.toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
        msg = parsed as Record<string, unknown>;
      } catch {
        return;
      }
      if (!me) {
        if (msg["t"] !== "hello" || signingIn) return;
        signingIn = true;
        const accounts = this.accounts();
        const account = accounts?.subjectOf(msg["token"]);
        const modern = msg["protocol"] === 2;
        const id = msg["characterId"];
        if (
          !accounts ||
          !account ||
          typeof msg["token"] !== "string" ||
          (modern
            ? !this.readCharacter || typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)
            : !RACES.includes(msg["race"] as never) || !LANDS.includes(msg["land"] as never))
        ) {
          socket.close(1008, "Nieprawidłowe uwierzytelnienie");
          return;
        }
        let nick: string;
        let character: AndroidCharacterView | null = null;
        let guild: { id: string; name: string; tag: string; role: GuildRole } | null = null;
        try {
          await this.admission?.(msg["token"]);
          await accounts.assertActive(account);
          if (modern) {
            character = (await this.readCharacter?.(account, id as string)) ?? null;
            if (!character) throw Error("CHARACTER_NOT_OWNED");
            const social = this.socialProvider?.();
            if (social) guild = await social.getGuildMeta(account);
          }
          nick = (await accounts.view(account)).nick;
        } catch {
          socket.close(1008, "Brak dostępu do gry na żywo");
          return;
        }
        if (socket.readyState !== 1) return;
        for (const other of this.peers.values())
          if (other.account === account) other.socket.close(4000, "Zalogowano na innym urządzeniu");

        const now = Date.now();
        me = {
          id: "p" + ++this.seq,
          account,
          token: msg["token"],
          accessCheckedAt: now,
          accountCheckedAt: now,
          checkingAccess: false,
          nick,
          race: character?.race ?? (msg["race"] as string),
          level: character?.level ?? num(msg["level"], 1, 20) ?? 1,
          character,
          characterReadAt: now,
          landReadAt: 0,
          land: character?.land ?? (msg["land"] as string),
          x: num(msg["x"], modern ? 0 : -1e6, modern ? 4096 : 1e6) ?? 0,
          y: num(msg["y"], modern ? 0 : -1e6, modern ? 4096 : 1e6) ?? 0,
          facing: 0,
          pose: "idle",
          action: 0,
          transformed: false,
          visible: !modern,
          guildId: guild?.id ?? null,
          guildTag: guild?.tag ?? null,
          guildName: guild?.name ?? null,
          guildRole: guild?.role ?? null,
          partyId: null,
          socket,
          lastChat: 0,
          lastPos: now,
          lastInspect: 0,
          lastSocial: 0,
        };
        clearTimeout(deadline);
        this.peers.set(socket, me);
        send(me, {
          t: "hello_ok",
          id: me.id,
          nick,
          ...(modern ? { protocol: 2, guildTag: me.guildTag ?? "" } : {}),
        });
        if (modern) {
          void this.pushFriends(me);
          void this.pushGuild(me);
          this.pushPartyState(me);
        }
        this.start();
        return;
      }

      if (me.checkingAccess || me.socket.readyState !== 1) return;
      switch (msg["t"]) {
        case "pos":
          void this.position(me, msg);
          break;
        case "chat":
          this.chat(me, msg);
          break;
        case "inspect":
          void this.inspect(me, msg["id"]);
          break;
        case "friends_sync":
          void this.pushFriends(me);
          break;
        case "friend_request":
          void this.friendRequest(me, msg["to"]);
          break;
        case "friend_accept":
          void this.friendAccept(me, msg["target"]);
          break;
        case "friend_remove":
          void this.friendRemove(me, msg["target"]);
          break;
        case "party_invite":
          this.partyInvite(me, msg["to"]);
          break;
        case "party_respond":
          this.partyRespond(me, msg["partyId"], msg["accept"] === true);
          break;
        case "party_leave":
          this.partyLeave(me);
          break;
        case "party_kick":
          this.partyKick(me, msg["targetId"]);
          break;
        case "guild_sync":
          void this.pushGuild(me);
          break;
        case "guild_create":
          void this.guildCreate(me, msg["name"], msg["tag"]);
          break;
        case "guild_invite":
          this.guildInvite(me, msg["to"]);
          break;
        case "guild_respond":
          void this.guildRespond(me, msg["guildId"], msg["accept"] === true);
          break;
        case "guild_leave":
          void this.guildLeave(me);
          break;
        case "guild_kick":
          void this.guildKick(me, msg["target"]);
          break;
      }
    });
    const gone = () => {
      clearTimeout(deadline);
      const leaving = me;
      this.connections.delete(socket);
      this.peers.delete(socket);
      if (leaving?.partyId) this.removeFromParty(leaving);
      if (this.peers.size === 0) this.stop();
    };
    socket.on("close", gone);
    socket.on("error", gone);
  }

  private async position(me: Peer, msg: Record<string, unknown>) {
    const now = Date.now();
    if (now - me.lastPos < 150) return;
    const modern = Boolean(me.character);
    const x = num(msg["x"], modern ? 0 : -1e6, modern ? 4096 : 1e6);
    const y = num(msg["y"], modern ? 0 : -1e6, modern ? 4096 : 1e6);
    if (x === null || y === null) return;
    me.lastPos = now;
    const land = msg["land"];
    if (typeof land === "string" && LANDS.includes(land as never) && land !== me.land) {
      if (me.character) {
        me.visible = false;
        if (!this.readCharacter || now - me.landReadAt < 750) return;
        me.landReadAt = now;
        try {
          const current = await this.readCharacter(me.account, me.character.id);
          if (me.lastPos !== now || me.socket.readyState !== 1 || current?.land !== land) return;
          me.character = current;
          me.race = current.race;
          me.level = current.level;
          me.characterReadAt = now;
        } catch {
          return;
        }
      }
      me.land = land;
    }
    me.x = x;
    me.y = y;
    me.facing = Math.round(num(msg["facing"], 0, 7) ?? me.facing);
    if (modern) {
      const pose = msg["pose"];
      me.pose = typeof pose === "string" && POSES.has(pose) ? pose : "idle";
      me.action = Math.round(num(msg["action"], 0, Number.MAX_SAFE_INTEGER) ?? 0);
      me.transformed = msg["ki"] === true;
      me.visible = msg["visible"] === true;
    } else {
      me.level = num(msg["level"], 1, 20) ?? me.level;
    }
  }

  private chat(me: Peer, msg: Record<string, unknown>) {
    const now = Date.now();
    const text = cleanMessage(msg["text"], 120);
    if (!text) return;
    if (now - me.lastChat < CHAT_COOLDOWN_MS) {
      if (me.character) send(me, { t: "notice", message: "Odczekaj chwilę przed wysłaniem." });
      return;
    }
    me.lastChat = now;
    let scope: ChatScope = "local";
    if (me.character) {
      const requested = msg["scope"];
      if (
        requested === "world" ||
        requested === "land" ||
        requested === "whisper" ||
        requested === "party" ||
        requested === "guild"
      )
        scope = requested;
      else if (requested !== undefined && requested !== "local") return;
    }
    if (scope === "party" && !me.partyId) {
      send(me, { t: "notice", message: "Nie należysz obecnie do żadnej drużyny." });
      return;
    }
    if (scope === "guild" && !me.guildId) {
      send(me, { t: "notice", message: "Nie należysz do żadnej gildii." });
      return;
    }
    const peers = this.activePeers();
    const to = msg["to"];
    const recipient =
      scope === "whisper" && typeof to === "string" && to.length <= 32
        ? peers.find(
            (p) =>
              p.character &&
              (p.id === to ||
                p.nick.toLowerCase() === to.toLowerCase() ||
                p.character.name.toLowerCase() === to.toLowerCase()),
          )
        : undefined;
    if (scope === "whisper" && (!recipient || recipient === me)) {
      send(me, { t: "notice", message: "Adresat jest niedostępny." });
      return;
    }
    const frame = {
      t: "chat",
      id: me.id,
      nick: me.nick,
      text,
      at: now,
      scope,
      ...(me.guildTag ? { guildTag: me.guildTag } : {}),
      ...(recipient ? { to: recipient.id, toNick: recipient.nick } : {}),
    };
    for (const peer of peers) {
      if (
        peer === me ||
        (scope === "world" && peer.character) ||
        (scope === "land" && peer.character && peer.land === me.land) ||
        (scope === "local" &&
          near(me, peer, me.character ? ISOMETRIC_RADIUS : LEGACY_RADIUS * 1.5)) ||
        (scope === "whisper" && peer === recipient) ||
        (scope === "party" && peer.character && peer.partyId === me.partyId) ||
        (scope === "guild" && peer.character && peer.guildId === me.guildId)
      )
        send(peer, frame);
    }
  }

  private async inspect(me: Peer, id: unknown) {
    const now = Date.now();
    if (!me.character || typeof id !== "string" || now - me.lastInspect < 500) return;
    me.lastInspect = now;
    const target = this.activePeers().find((p) => p.id === id && p !== me);
    if (!target?.character || !near(me, target, ISOMETRIC_RADIUS)) {
      send(me, { t: "notice", message: "Gracz jest poza zasięgiem." });
      return;
    }
    const character = target.character;
    const social = this.socialProvider?.();
    const isFriend = social ? await social.areFriends(me.account, target.account) : false;
    const sameParty = Boolean(me.partyId && target.partyId === me.partyId);
    const partySize = me.partyId ? (this.parties.get(me.partyId)?.memberIds.length ?? 0) : 0;
    send(me, {
      t: "profile",
      id: target.id,
      nick: target.nick,
      name: character.name,
      race: character.race,
      level: character.level,
      power: power(character, target.transformed),
      ki: target.transformed,
      equipment: character.state.equipment,
      guildTag: target.guildTag ?? "",
      guildName: target.guildName ?? "",
      isFriend,
      sameParty,
      canInviteParty: !sameParty && partySize < MAX_PARTY_SIZE,
      canInviteGuild:
        !target.guildId &&
        Boolean(me.guildId && (me.guildRole === "leader" || me.guildRole === "officer")),
    });
  }

  /* -------------------------------- friends -------------------------------- */

  private allowSocial(me: Peer): boolean {
    const now = Date.now();
    if (now - me.lastSocial < SOCIAL_COOLDOWN_MS) {
      send(me, { t: "notice", message: "Odczekaj chwilę przed kolejną akcją." });
      return false;
    }
    me.lastSocial = now;
    return true;
  }

  private async pushFriends(me: Peer) {
    const social = this.socialProvider?.();
    if (!me.character || !social) return;
    try {
      const snap = await social.listFriends(me.account);
      const enrich = (entry: { accountId: string; nick: string }) => {
        const livePeer = this.peerByAccount(entry.accountId);
        return {
          accountId: entry.accountId,
          nick: entry.nick,
          online: Boolean(livePeer?.character),
          peerId: livePeer?.id ?? "",
          name: livePeer?.character?.name ?? "",
          race: livePeer?.race ?? "",
          level: livePeer?.level ?? 0,
          land: livePeer?.land ?? "",
          guildTag: livePeer?.guildTag ?? "",
        };
      };
      send(me, {
        t: "friends",
        accepted: snap.accepted.map(enrich),
        incoming: snap.incoming.map(enrich),
        outgoing: snap.outgoing.map(enrich),
      });
    } catch {
      /* ignore transient DB read error */
    }
  }

  private async friendRequest(me: Peer, toRaw: unknown) {
    const social = this.socialProvider?.();
    if (!me.character || !social || !this.allowSocial(me)) return;
    const livePeer = this.findModernPeer(toRaw);
    const query = livePeer ? livePeer.account : typeof toRaw === "string" ? toRaw.trim() : "";
    if (!query) {
      send(me, { t: "notice", message: "Podaj nick gracza." });
      return;
    }
    try {
      const res = await social.requestFriend(me.account, query);
      await this.pushFriends(me);
      const targetPeer = this.peerByAccount(res.targetId);
      if (res.status === "accepted") {
        send(me, { t: "notice", message: `${res.targetNick} dodany do znajomych!` });
        if (targetPeer) {
          await this.pushFriends(targetPeer);
          send(targetPeer, {
            t: "notice",
            message: `${me.nick} zaakceptował zaproszenie do znajomych!`,
          });
        }
      } else {
        send(me, {
          t: "notice",
          message: `Wysłano zaproszenie do znajomych dla ${res.targetNick}.`,
        });
        if (targetPeer) {
          await this.pushFriends(targetPeer);
          send(targetPeer, {
            t: "friend_invite",
            fromAccountId: me.account,
            fromNick: me.nick,
            fromName: me.character.name,
            fromLevel: me.level,
          });
        }
      }
    } catch (e) {
      send(me, {
        t: "notice",
        message: e instanceof SocialError ? e.message : "Nie udało się wysłać zaproszenia.",
      });
    }
  }

  private async friendAccept(me: Peer, targetRaw: unknown) {
    const social = this.socialProvider?.();
    if (!me.character || !social || !this.allowSocial(me) || typeof targetRaw !== "string") return;
    try {
      const res = await social.acceptFriend(me.account, targetRaw);
      await this.pushFriends(me);
      send(me, { t: "notice", message: `${res.otherNick} jest teraz Twoim znajomym.` });
      const otherPeer = this.peerByAccount(res.otherId);
      if (otherPeer) {
        await this.pushFriends(otherPeer);
        send(otherPeer, {
          t: "notice",
          message: `${me.nick} przyjął Twoje zaproszenie do znajomych!`,
        });
      }
    } catch (e) {
      send(me, {
        t: "notice",
        message: e instanceof SocialError ? e.message : "Nie udało się zaakceptować zaproszenia.",
      });
    }
  }

  private async friendRemove(me: Peer, targetRaw: unknown) {
    const social = this.socialProvider?.();
    if (!me.character || !social || !this.allowSocial(me) || typeof targetRaw !== "string") return;
    try {
      const res = await social.removeFriend(me.account, targetRaw);
      await this.pushFriends(me);
      send(me, { t: "notice", message: `Usunięto relację z ${res.otherNick}.` });
      const otherPeer = this.peerByAccount(res.otherId);
      if (otherPeer) await this.pushFriends(otherPeer);
    } catch (e) {
      send(me, {
        t: "notice",
        message: e instanceof SocialError ? e.message : "Nie udało się usunąć znajomego.",
      });
    }
  }

  /* -------------------------------- parties -------------------------------- */

  private buildPartyFrame(party: Party | null) {
    if (!party) return { t: "party", partyId: "", leaderId: "", members: [] };
    const members = party.memberIds
      .map((id) => this.peerById(id))
      .filter((p): p is Peer => Boolean(p?.character))
      .map((p) => ({
        id: p.id,
        nick: p.nick,
        name: p.character!.name,
        race: p.race,
        level: p.level,
        land: p.land,
        hp: Math.round(p.character!.state.hp),
        maxHp: Math.round(p.character!.stats.maxHp),
        ki: Math.round(p.character!.state.ki),
        maxKi: Math.round(p.character!.stats.maxKi),
        power: power(p.character!, p.transformed),
        transformed: p.transformed,
        guildTag: p.guildTag ?? "",
        isLeader: p.id === party.leaderId,
      }));
    return { t: "party", partyId: party.id, leaderId: party.leaderId, members };
  }

  private pushPartyState(me: Peer) {
    const party = me.partyId ? (this.parties.get(me.partyId) ?? null) : null;
    send(me, this.buildPartyFrame(party));
  }

  private broadcastParty(party: Party) {
    const frame = this.buildPartyFrame(party);
    for (const id of party.memberIds) {
      const m = this.peerById(id);
      if (m) send(m, frame);
    }
  }

  private removeFromParty(leaving: Peer) {
    const pid = leaving.partyId;
    leaving.partyId = null;
    if (!pid) return;
    const party = this.parties.get(pid);
    if (!party) return;
    party.memberIds = party.memberIds.filter((id) => id !== leaving.id);
    send(leaving, this.buildPartyFrame(null));
    if (party.memberIds.length <= 1) {
      for (const remId of party.memberIds) {
        const rem = this.peerById(remId);
        if (rem) {
          rem.partyId = null;
          send(rem, this.buildPartyFrame(null));
          send(rem, { t: "notice", message: "Drużyna została rozwiązana." });
        }
      }
      this.parties.delete(pid);
      return;
    }
    if (party.leaderId === leaving.id) party.leaderId = party.memberIds[0]!;
    this.broadcastParty(party);
  }

  private partyInvite(me: Peer, toRaw: unknown) {
    if (!me.character || !this.allowSocial(me)) return;
    const target = this.findModernPeer(toRaw);
    if (!target || target === me) {
      send(me, { t: "notice", message: "Gracz nie jest teraz online." });
      return;
    }
    if (me.partyId && target.partyId === me.partyId) {
      send(me, { t: "notice", message: `${target.nick} jest już w Twojej drużynie.` });
      return;
    }
    let party: Party;
    if (me.partyId) {
      const existing = this.parties.get(me.partyId);
      if (!existing) {
        me.partyId = null;
        return;
      }
      if (existing.leaderId !== me.id) {
        send(me, { t: "notice", message: "Tylko lider drużyny może zapraszać." });
        return;
      }
      if (existing.memberIds.length >= MAX_PARTY_SIZE) {
        send(me, { t: "notice", message: `Drużyna jest pełna (maks. ${MAX_PARTY_SIZE} graczy).` });
        return;
      }
      party = existing;
    } else {
      party = { id: "grp" + ++this.partySeq, leaderId: me.id, memberIds: [me.id] };
      this.parties.set(party.id, party);
      me.partyId = party.id;
      this.broadcastParty(party);
    }
    const key = `${target.account}:${party.id}`;
    this.partyInvites.set(key, {
      partyId: party.id,
      fromPeerId: me.id,
      fromNick: me.nick,
      expiresAt: Date.now() + INVITE_TTL_MS,
    });
    send(me, { t: "notice", message: `Wysłano zaproszenie do drużyny dla ${target.nick}.` });
    send(target, {
      t: "party_invite",
      partyId: party.id,
      fromId: me.id,
      fromNick: me.nick,
      fromName: me.character.name,
      fromLevel: me.level,
      fromRace: me.race,
    });
  }

  private partyRespond(me: Peer, partyIdRaw: unknown, accept: boolean) {
    if (!me.character || typeof partyIdRaw !== "string") return;
    const key = `${me.account}:${partyIdRaw}`;
    const inv = this.partyInvites.get(key);
    this.partyInvites.delete(key);
    if (!inv || inv.expiresAt < Date.now()) {
      send(me, { t: "notice", message: "Zaproszenie do drużyny wygasło." });
      return;
    }
    const inviter = this.peerById(inv.fromPeerId);
    if (!accept) {
      if (inviter)
        send(inviter, { t: "notice", message: `${me.nick} odrzucił zaproszenie do drużyny.` });
      return;
    }
    const party = this.parties.get(partyIdRaw);
    if (!party || party.memberIds.length >= MAX_PARTY_SIZE) {
      send(me, { t: "notice", message: "Ta drużyna jest już pełna lub nie istnieje." });
      return;
    }
    if (me.partyId && me.partyId !== party.id) this.removeFromParty(me);
    if (!party.memberIds.includes(me.id)) party.memberIds.push(me.id);
    me.partyId = party.id;
    this.broadcastParty(party);
    send(me, { t: "notice", message: "Dołączyłeś do drużyny!" });
    if (inviter) send(inviter, { t: "notice", message: `${me.nick} dołączył do drużyny!` });
  }

  private partyLeave(me: Peer) {
    if (!me.partyId) return;
    this.removeFromParty(me);
    send(me, { t: "notice", message: "Opuszczono drużynę." });
  }

  private partyKick(me: Peer, targetIdRaw: unknown) {
    if (!me.partyId || typeof targetIdRaw !== "string") return;
    const party = this.parties.get(me.partyId);
    if (!party || party.leaderId !== me.id) {
      send(me, { t: "notice", message: "Tylko lider może usuwać graczy z drużyny." });
      return;
    }
    if (targetIdRaw === me.id) return;
    const target = this.peerById(targetIdRaw);
    if (!target || target.partyId !== party.id) return;
    this.removeFromParty(target);
    send(target, { t: "notice", message: "Usunięto Cię z drużyny." });
    send(me, { t: "notice", message: `Usunięto ${target.nick} z drużyny.` });
  }

  /* -------------------------------- guilds -------------------------------- */

  private async pushGuild(me: Peer) {
    const social = this.socialProvider?.();
    if (!me.character || !social) return;
    try {
      const snap = await social.getGuildSnapshot(me.account);
      if (!snap) {
        me.guildId = null;
        me.guildTag = null;
        me.guildName = null;
        me.guildRole = null;
        send(me, { t: "guild", guild: null });
        return;
      }
      me.guildId = snap.id;
      me.guildTag = snap.tag;
      me.guildName = snap.name;
      me.guildRole = snap.role;
      send(me, {
        t: "guild",
        guild: {
          id: snap.id,
          name: snap.name,
          tag: snap.tag,
          role: snap.role,
          members: snap.members.map((m) => {
            const livePeer = this.peerByAccount(m.accountId);
            return {
              accountId: m.accountId,
              nick: m.nick,
              role: m.role,
              online: Boolean(livePeer?.character),
              peerId: livePeer?.id ?? "",
              name: livePeer?.character?.name ?? "",
              level: livePeer?.level ?? 0,
              land: livePeer?.land ?? "",
            };
          }),
        },
      });
    } catch {
      /* ignore transient DB read error */
    }
  }

  private async broadcastGuildRefresh(guildId: string) {
    for (const peer of this.activePeers()) {
      if (peer.guildId === guildId) await this.pushGuild(peer);
    }
  }

  private async guildCreate(me: Peer, nameRaw: unknown, tagRaw: unknown) {
    const social = this.socialProvider?.();
    if (!me.character || !social || !this.allowSocial(me)) return;
    try {
      const snap = await social.createGuild(me.account, nameRaw, tagRaw);
      await this.pushGuild(me);
      send(me, { t: "notice", message: `Utworzono gildię <${snap.tag}> ${snap.name}!` });
    } catch (e) {
      send(me, {
        t: "notice",
        message: e instanceof SocialError ? e.message : "Nie udało się utworzyć gildii.",
      });
    }
  }

  private guildInvite(me: Peer, toRaw: unknown) {
    if (!me.character || !this.allowSocial(me)) return;
    if (!me.guildId || !me.guildTag || !me.guildName) {
      send(me, { t: "notice", message: "Nie należysz do żadnej gildii." });
      return;
    }
    if (me.guildRole !== "leader" && me.guildRole !== "officer") {
      send(me, { t: "notice", message: "Tylko lider lub oficer może zapraszać do gildii." });
      return;
    }
    const target = this.findModernPeer(toRaw);
    if (!target || target === me) {
      send(me, { t: "notice", message: "Gracz nie jest teraz online." });
      return;
    }
    if (target.guildId) {
      send(me, { t: "notice", message: `${target.nick} należy już do gildii.` });
      return;
    }
    const key = `${target.account}:${me.guildId}`;
    this.guildInvites.set(key, {
      guildId: me.guildId,
      guildName: me.guildName,
      guildTag: me.guildTag,
      fromPeerId: me.id,
      fromNick: me.nick,
      expiresAt: Date.now() + INVITE_TTL_MS,
    });
    send(me, { t: "notice", message: `Wysłano zaproszenie do gildii dla ${target.nick}.` });
    send(target, {
      t: "guild_invite",
      guildId: me.guildId,
      guildName: me.guildName,
      guildTag: me.guildTag,
      fromNick: me.nick,
    });
  }

  private async guildRespond(me: Peer, guildIdRaw: unknown, accept: boolean) {
    const social = this.socialProvider?.();
    if (!me.character || !social || typeof guildIdRaw !== "string") return;
    const key = `${me.account}:${guildIdRaw}`;
    const inv = this.guildInvites.get(key);
    this.guildInvites.delete(key);
    if (!inv || inv.expiresAt < Date.now()) {
      send(me, { t: "notice", message: "Zaproszenie do gildii wygasło." });
      return;
    }
    const inviter = this.peerById(inv.fromPeerId);
    if (!accept) {
      if (inviter)
        send(inviter, { t: "notice", message: `${me.nick} odrzucił zaproszenie do gildii.` });
      return;
    }
    try {
      const snap = await social.joinGuild(me.account, guildIdRaw);
      me.guildId = snap.id;
      me.guildTag = snap.tag;
      me.guildName = snap.name;
      me.guildRole = snap.role;
      await this.broadcastGuildRefresh(snap.id);
      send(me, { t: "notice", message: `Dołączyłeś do gildii <${snap.tag}> ${snap.name}!` });
      if (inviter) send(inviter, { t: "notice", message: `${me.nick} dołączył do gildii!` });
    } catch (e) {
      send(me, {
        t: "notice",
        message: e instanceof SocialError ? e.message : "Nie udało się dołączyć do gildii.",
      });
    }
  }

  private async guildLeave(me: Peer) {
    const social = this.socialProvider?.();
    if (!me.character || !social || !this.allowSocial(me)) return;
    try {
      const res = await social.leaveGuild(me.account);
      await this.pushGuild(me);
      if (!res.disbanded) await this.broadcastGuildRefresh(res.guildId);
      send(me, {
        t: "notice",
        message: res.disbanded ? "Rozwiązano gildię." : "Opuszczono gildię.",
      });
    } catch (e) {
      send(me, {
        t: "notice",
        message: e instanceof SocialError ? e.message : "Nie udało się opuścić gildii.",
      });
    }
  }

  private async guildKick(me: Peer, targetRaw: unknown) {
    const social = this.socialProvider?.();
    if (!me.character || !social || !this.allowSocial(me) || typeof targetRaw !== "string") return;
    try {
      const res = await social.kickGuildMember(me.account, targetRaw);
      await this.broadcastGuildRefresh(res.guildId);
      send(me, { t: "notice", message: `Usunięto ${res.targetNick} z gildii.` });
      const kickedPeer = this.peerByAccount(res.targetId);
      if (kickedPeer) {
        await this.pushGuild(kickedPeer);
        send(kickedPeer, { t: "notice", message: "Zostałeś usunięty z gildii." });
      }
    } catch (e) {
      send(me, {
        t: "notice",
        message: e instanceof SocialError ? e.message : "Nie udało się usunąć członka.",
      });
    }
  }

  /* -------------------------------- tick & lifecycle -------------------------------- */

  private start() {
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async refresh(peer: Peer, now: number) {
    peer.checkingAccess = true;
    try {
      const accounts = this.accounts();
      if (!accounts || accounts.subjectOf(peer.token) !== peer.account)
        throw Error("TOKEN_EXPIRED");
      await this.admission?.(peer.token);
      if (now - peer.accountCheckedAt >= CHARACTER_REFRESH_MS) {
        await accounts.assertActive(peer.account);
        peer.accountCheckedAt = now;
      }
      if (
        peer.character &&
        this.readCharacter &&
        now - peer.characterReadAt >= CHARACTER_REFRESH_MS
      ) {
        const character = await this.readCharacter(peer.account, peer.character.id);
        if (!character) throw Error("CHARACTER_NOT_OWNED");
        peer.character = character;
        peer.race = character.race;
        peer.level = character.level;
        const social = this.socialProvider?.();
        if (social) {
          const gm = await social.getGuildMeta(peer.account);
          peer.guildId = gm?.id ?? null;
          peer.guildTag = gm?.tag ?? null;
          peer.guildName = gm?.name ?? null;
          peer.guildRole = gm?.role ?? null;
        }
        peer.characterReadAt = now;
      }
      peer.accessCheckedAt = now;
    } catch {
      peer.socket.close(1008, "Utracono dostęp do gry na żywo");
    } finally {
      peer.checkingAccess = false;
    }
  }

  private tick() {
    const now = Date.now();
    const all = [...this.peers.values()].filter((p) => p.socket.readyState === 1);
    for (const me of all) {
      if (me.checkingAccess) continue;
      if (now - me.lastPos > 30_000) {
        me.socket.close(1001, "Brak aktywności");
        continue;
      }
      if (now - me.accessCheckedAt >= 1_000) {
        void this.refresh(me, now);
        continue;
      }
      const peers = all
        .filter((p) => p !== me && near(me, p, me.character ? ISOMETRIC_RADIUS : LEGACY_RADIUS))
        .sort((a, b) => distance(a, me) - distance(b, me))
        .slice(0, MAX_PEERS_SENT)
        .map((p) => ({
          id: p.id,
          nick: p.nick,
          race: p.race,
          level: p.level,
          x: Math.round(p.x),
          y: Math.round(p.y),
          f: p.facing,
          ...(p.character
            ? {
                name: p.character.name,
                pose: p.pose,
                action: p.action,
                ki: p.transformed,
                ...(p.guildTag ? { guildTag: p.guildTag } : {}),
                ...(me.partyId && p.partyId === me.partyId ? { inParty: true } : {}),
              }
            : {}),
        }));
      send(me, {
        t: "peers",
        peers,
        online: all.length,
        ...(me.character
          ? {
              land: me.land,
              power: power(me.character, me.transformed),
              ...(me.guildTag ? { guildTag: me.guildTag } : {}),
            }
          : {}),
      });
    }
  }

  closeAll() {
    this.stop();
    for (const socket of this.connections) socket.close(1001, "Serwer zatrzymany");
    this.connections.clear();
    this.peers.clear();
    this.parties.clear();
    this.partyInvites.clear();
    this.guildInvites.clear();
  }
}
