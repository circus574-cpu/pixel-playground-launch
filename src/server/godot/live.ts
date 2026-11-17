import type { WebSocket } from "ws";
import type { AccountService } from "../accounts/service";
import { LANDS, RACES } from "./saveRules";

/**
 * Presence channel of the Android game (/ws/godot/live): who else is in your land and a local chat line. It is cosmetic and NOT
 * authoritative: the server never decides combat, loot, experience or position, and clients only see names, race, level and place.
 */
type Peer = {
  id: string;
  account: string;
  token: string;
  accessCheckedAt: number;
  checkingAccess: boolean;
  nick: string;
  race: string;
  level: number;
  land: string;
  x: number;
  y: number;
  facing: number;
  socket: WebSocket;
  lastChat: number;
  lastPos: number;
};

const RADIUS = 2600;
const MAX_PEERS_SENT = 24;
const MAX_CONNECTIONS = 300;
const TICK_MS = 250;

const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;

export class GodotLive {
  private peers = new Map<WebSocket, Peer>();
  private timer: NodeJS.Timeout | null = null;
  private seq = 0;

  constructor(
    private readonly accounts: () => AccountService | null,
    private readonly admission?: (token: unknown) => Promise<void>,
  ) {}

  count() {
    const byLand: Record<string, number> = {};
    for (const p of this.peers.values()) byLand[p.land] = (byLand[p.land] ?? 0) + 1;
    return { count: this.peers.size, byLand };
  }

  attach(socket: WebSocket) {
    if (this.peers.size >= MAX_CONNECTIONS) {
      socket.close(1013, "Serwer pełny");
      return;
    }
    let me: Peer | null = null;
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
        if (msg["t"] !== "hello") return;
        const accounts = this.accounts();
        const account = accounts?.subjectOf(msg["token"]);
        const race = msg["race"];
        const land = msg["land"];
        if (
          !accounts ||
          !account ||
          !RACES.includes(race as never) ||
          !LANDS.includes(land as never)
        ) {
          socket.close(1008, "Nieprawidłowe uwierzytelnienie");
          return;
        }
        let nick: string;
        try {
          await this.admission?.(msg["token"]);
          nick = (await accounts.view(account)).nick;
        } catch {
          socket.close(1008, "Serwer niedostępny lub trwa konserwacja");
          return;
        }
        if (socket.readyState !== 1) return;
        for (const [other, p] of this.peers)
          if (p.account === account) other.close(4000, "Zalogowano na innym urządzeniu");
        me = {
          id: "p" + ++this.seq,
          account,
          token: String(msg["token"]),
          accessCheckedAt: Date.now(),
          checkingAccess: false,
          nick,
          race: race as string,
          level: num(msg["level"], 1, 20) ?? 1,
          land: land as string,
          x: num(msg["x"], -1e6, 1e6) ?? 0,
          y: num(msg["y"], -1e6, 1e6) ?? 0,
          facing: 0,
          socket,
          lastChat: 0,
          lastPos: 0,
        };
        clearTimeout(deadline);
        this.peers.set(socket, me);
        socket.send(JSON.stringify({ t: "hello_ok", id: me.id, nick }));
        this.start();
        return;
      }
      const now = Date.now();
      if (msg["t"] === "pos") {
        if (now - me.lastPos < 150) return;
        me.lastPos = now;
        const x = num(msg["x"], -1e6, 1e6);
        const y = num(msg["y"], -1e6, 1e6);
        if (x === null || y === null) return;
        me.x = x;
        me.y = y;
        const land = msg["land"];
        if (typeof land === "string" && LANDS.includes(land as never)) me.land = land;
        me.level = num(msg["level"], 1, 20) ?? me.level;
        me.facing = num(msg["facing"], 0, 7) ?? me.facing;
      } else if (msg["t"] === "chat") {
        const text =
          typeof msg["text"] === "string"
            ? [...msg["text"]]
                .map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c))
                .join("")
                .trim()
                .slice(0, 120)
            : "";
        if (!text || now - me.lastChat < 1200) return;
        me.lastChat = now;
        const frame = JSON.stringify({ t: "chat", nick: me.nick, text, at: now });
        for (const p of this.peers.values())
          if (p.land === me.land && Math.hypot(p.x - me.x, p.y - me.y) <= RADIUS * 1.5)
            p.socket.send(frame);
      }
    });
    const gone = () => {
      clearTimeout(deadline);
      if (me) this.peers.delete(socket);
      if (this.peers.size === 0) this.stop();
    };
    socket.on("close", gone);
    socket.on("error", gone);
  }

  private start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick() {
    const all = [...this.peers.values()];
    for (const me of all) {
      if (me.socket.readyState !== 1) continue;
      if (this.admission && Date.now() - me.accessCheckedAt >= 1000) {
        if (!me.checkingAccess) {
          me.checkingAccess = true;
          void this.admission(me.token)
            .then(() => {
              me.accessCheckedAt = Date.now();
              me.checkingAccess = false;
            })
            .catch(() => me.socket.close(1008, "Serwer jest w trakcie konserwacji"));
        }
        continue;
      }
      const near = all
        .filter(
          (p) =>
            p !== me &&
            !p.checkingAccess &&
            p.land === me.land &&
            Math.hypot(p.x - me.x, p.y - me.y) <= RADIUS,
        )
        .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))
        .slice(0, MAX_PEERS_SENT)
        .map((p) => ({
          id: p.id,
          nick: p.nick,
          race: p.race,
          level: p.level,
          x: Math.round(p.x),
          y: Math.round(p.y),
          f: p.facing,
        }));
      me.socket.send(JSON.stringify({ t: "peers", peers: near, online: all.length }));
    }
  }

  closeAll() {
    this.stop();
    for (const s of this.peers.keys()) s.close(1001, "Serwer zatrzymany");
    this.peers.clear();
  }
}
