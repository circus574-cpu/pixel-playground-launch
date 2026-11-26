import type { WebSocket } from "ws";
import type { AccountService } from "../accounts/service";
import type { AndroidCharacterView } from "./economy";
import { LANDS, RACES } from "./saveRules";

type CharacterReader = (account: string, id: string) => Promise<AndroidCharacterView | null>;
type ChatScope = "world" | "land" | "local" | "whisper";

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
  socket: WebSocket;
  lastChat: number;
  lastPos: number;
  lastInspect: number;
};

const ISOMETRIC_RADIUS = 620;
const LEGACY_RADIUS = 2600;
const MAX_PEERS_SENT = 24;
const MAX_CONNECTIONS = 300;
const TICK_MS = 250;
const CHARACTER_REFRESH_MS = 10_000;
const CHAT_COOLDOWN_MS = 1200;
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

/** Presence and social data for the Godot clients. Combat stays in its gameplay pipeline. */
export class GodotLive {
  private connections = new Set<WebSocket>();
  private peers = new Map<WebSocket, Peer>();
  private timer: NodeJS.Timeout | null = null;
  private seq = 0;

  constructor(
    private readonly accounts: () => AccountService | null,
    private readonly admission?: (token: unknown) => Promise<void>,
    private readonly readCharacter?: CharacterReader,
  ) {}

  private activePeers() {
    return [...this.peers.values()].filter((p) => p.socket.readyState === 1 && !p.checkingAccess);
  }

  count() {
    const byLand: Record<string, number> = {};
    const peers = [...this.peers.values()].filter((peer) => peer.socket.readyState === 1);
    for (const peer of peers) byLand[peer.land] = (byLand[peer.land] ?? 0) + 1;
    return { count: peers.length, byLand };
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
        try {
          await this.admission?.(msg["token"]);
          await accounts.assertActive(account);
          if (modern) {
            character = (await this.readCharacter?.(account, id as string)) ?? null;
            if (!character) throw Error("CHARACTER_NOT_OWNED");
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
          socket,
          lastChat: 0,
          lastPos: now,
          lastInspect: 0,
        };
        clearTimeout(deadline);
        this.peers.set(socket, me);
        send(me, { t: "hello_ok", id: me.id, nick, ...(modern ? { protocol: 2 } : {}) });
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
          this.inspect(me, msg["id"]);
          break;
      }
    });
    const gone = () => {
      clearTimeout(deadline);
      this.connections.delete(socket);
      this.peers.delete(socket);
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
    const text =
      typeof msg["text"] === "string"
        ? Array.from(msg["text"].replace(/[\p{Cc}\p{Cf}]/gu, " ").trim())
            .slice(0, 120)
            .join("")
        : "";
    if (!text) return;
    if (now - me.lastChat < CHAT_COOLDOWN_MS) {
      if (me.character) send(me, { t: "notice", message: "Odczekaj chwilę przed wysłaniem." });
      return;
    }
    me.lastChat = now;
    let scope: ChatScope = "local";
    if (me.character) {
      const requested = msg["scope"];
      if (requested === "world" || requested === "land" || requested === "whisper")
        scope = requested;
      else if (requested !== undefined && requested !== "local") return;
    }
    const peers = this.activePeers();
    const to = msg["to"];
    const recipient =
      scope === "whisper" && typeof to === "string" && to.length <= 32
        ? peers.find(
            (p) => p.character && (p.id === to || p.nick.toLowerCase() === to.toLowerCase()),
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
      ...(recipient ? { to: recipient.id, toNick: recipient.nick } : {}),
    };
    for (const peer of peers) {
      if (
        peer === me ||
        (scope === "world" && peer.character) ||
        (scope === "land" && peer.character && peer.land === me.land) ||
        (scope === "local" &&
          near(me, peer, me.character ? ISOMETRIC_RADIUS : LEGACY_RADIUS * 1.5)) ||
        (scope === "whisper" && peer === recipient)
      )
        send(peer, frame);
    }
  }

  private inspect(me: Peer, id: unknown) {
    const now = Date.now();
    if (!me.character || typeof id !== "string" || now - me.lastInspect < 500) return;
    me.lastInspect = now;
    const target = this.activePeers().find((p) => p.id === id && p !== me);
    if (!target?.character || !near(me, target, ISOMETRIC_RADIUS)) {
      send(me, { t: "notice", message: "Gracz jest poza zasięgiem." });
      return;
    }
    const character = target.character;
    send(me, {
      t: "profile",
      id: target.id,
      nick: target.nick,
      name: character.name,
      race: character.race,
      level: character.level,
      power: power(character, target.transformed),
      equipment: character.state.equipment,
    });
  }

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
          ...(p.character ? { pose: p.pose, action: p.action, ki: p.transformed } : {}),
        }));
      send(me, {
        t: "peers",
        peers,
        online: all.length,
        ...(me.character ? { land: me.land, power: power(me.character, me.transformed) } : {}),
      });
    }
  }

  closeAll() {
    this.stop();
    for (const socket of this.connections) socket.close(1001, "Serwer zatrzymany");
    this.connections.clear();
    this.peers.clear();
  }
}
