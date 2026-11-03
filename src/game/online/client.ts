import type { OnlineSession } from "../../server/characters/onlineSession";
import type { CharacterRecord } from "../../server/characters/repository";
import type { Command } from "../session";
import type { RaceId } from "../world/races";
export type OnlineFrame = ReturnType<OnlineSession["view"]> & {
  peers?: import("../multiplayer/protocol").NetworkPlayerState[];
};

/** Deliberately has no local save port and sends intentions only. */
export class OnlineClient {
  frame: OnlineFrame | undefined;
  private socket: WebSocket | undefined;
  private listeners = new Set<(frame: OnlineFrame) => void>();
  private lastDirection = 0;
  private closed = false;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  private refresh: ReturnType<typeof setInterval> | undefined;
  constructor(
    private token: () => Promise<string>,
    private onFailure: (message: string) => void,
  ) {}
  setFailureHandler(handler: (message: string) => void) {
    this.onFailure = handler;
  }
  async characters(): Promise<CharacterRecord[]> {
    return (await this.request("GET")).characters;
  }
  async create(race: RaceId, name: string): Promise<CharacterRecord> {
    return this.request("POST", { race, name });
  }
  async remove(id: string) {
    await this.request("DELETE", undefined, id);
  }
  private async request(method: string, body?: unknown, id?: string) {
    const response = await fetch("/ws/characters" + (id ? "/" + encodeURIComponent(id) : ""), {
      method,
      headers: {
        Authorization: "Bearer " + (await this.token()),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw Error(
        body.error === "CHARACTER_LIMIT"
          ? "Masz już 12 postaci. Usuń nieużywaną postać z listy."
          : body.error === "SESSION_BUSY"
            ? "Postać jest w grze. Najpierw zakończ jej sesję."
            : response.status === 401
              ? "Zaloguj się ponownie."
              : "Serwer zapisu postaci jest niedostępny. Ponów próbę.",
      );
    }
    return response.json();
  }
  async connect(characterId: string, signal: AbortSignal): Promise<OnlineFrame> {
    const token = await this.token();
    if (signal.aborted) throw Error("Połączenie anulowane");
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/online`,
      );
      this.socket = socket;
      let ready = false,
        lastFrame = performance.now();
      const timeout = setTimeout(() => fail("Serwer nie odpowiedział. Ponów połączenie."), 20000);
      const abort = () => {
        this.close();
        reject(Error("Połączenie anulowane"));
      };
      signal.addEventListener("abort", abort, { once: true });
      const fail = (message: string) => {
        clearTimeout(timeout);
        if (this.closed) return;
        this.closed = true;
        socket.close();
        if (this.refresh) clearInterval(this.refresh);
        if (this.watchdog) clearInterval(this.watchdog);
        if (!ready) reject(Error(message));
        this.onFailure(message);
      };
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "open", token, characterId }));
        this.watchdog = setInterval(() => {
          if (performance.now() - lastFrame > 6000)
            fail("Serwer nie potwierdza zapisu. Połącz ponownie; lokalna gra jest wyłączona.");
        }, 1000);
        this.refresh = setInterval(() => {
          void this.token()
            .then((token) => this.send({ type: "reauth", token }))
            .catch(() => fail("Zaloguj się ponownie."));
        }, 25000);
      };
      socket.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet.type === "online_error")
            return fail(
              "Sesja serwerowa została przerwana" +
                (typeof packet.code === "string" ? ` (${packet.code})` : "") +
                ". Połącz ponownie; postęp pozostaje na serwerze.",
            );
          if (packet.type !== "state") return;
          const frame: OnlineFrame = packet.frame;
          if (this.frame && frame.revision <= this.frame.revision) return;
          lastFrame = performance.now();
          this.frame = frame;
          for (const listener of this.listeners) listener(frame);
          if (!ready) {
            ready = true;
            clearTimeout(timeout);
            resolve(frame);
          }
        } catch {
          fail("Nieprawidłowa odpowiedź serwera.");
        }
      };
      socket.onerror = () =>
        fail("Brak połączenia z serwerem gry. Lokalna rozgrywka jest wyłączona.");
      socket.onclose = () => {
        signal.removeEventListener("abort", abort);
        fail("Utracono połączenie z serwerem gry. Połącz ponownie, aby kontynuować.");
      };
    });
  }
  subscribe(listener: (frame: OnlineFrame) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private send(packet: unknown) {
    if (this.closed || this.socket?.readyState !== 1) return;
    this.socket.send(JSON.stringify(packet));
  }
  intent(command: unknown) {
    this.send({ type: "command", operationId: crypto.randomUUID(), command });
  }
  command(command: Command) {
    // Menus may suspend presentation, never the shared authoritative simulation.
    if (command.type === "pause") return;
    this.send({ type: "command", operationId: crypto.randomUUID(), command });
  }
  direction(x: number, y: number) {
    const now = performance.now();
    if ((x !== 0 || y !== 0) && now - this.lastDirection < 50) return;
    this.lastDirection = now;
    const length = Math.max(1, Math.hypot(x, y));
    this.send({ type: "direction", x: x / length, y: y / length });
  }
  close() {
    this.closed = true;
    this.socket?.close();
    if (this.refresh) clearInterval(this.refresh);
    if (this.watchdog) clearInterval(this.watchdog);
    this.listeners.clear();
  }
}
