import type { NetworkPlayerState } from "../../game/multiplayer/protocol";
import path from "node:path";
import { z } from "zod";
import type { WebSocket } from "ws";
import { OnlineSession } from "./onlineSession";
import type { PgCharacterRepository } from "./repository";
import type { VerifyAccount } from "./http";

const packet = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reauth"), token: z.string().min(16).max(8192) }).strict(),
  z
    .object({
      type: z.literal("open"),
      token: z.string().min(16).max(8192),
      characterId: z.string().uuid(),
    })
    .strict(),
  z
    .object({ type: z.literal("command"), operationId: z.string().uuid(), command: z.unknown() })
    .strict(),
  z
    .object({
      type: z.literal("direction"),
      x: z.number().finite().min(-1).max(1),
      y: z.number().finite().min(-1).max(1),
    })
    .strict(),
]);

export function serveOnlineSocket(
  socket: WebSocket,
  options: {
    repository: PgCharacterRepository;
    verify: VerifyAccount;
    publicRoot?: string;
    role?: (token: string, subject: string) => Promise<"admin" | "gm" | undefined>;
    peers?: (frame: ReturnType<OnlineSession["view"]>) => NetworkPlayerState[];
    metric?: (kind: "in" | "out" | "tick", value: number) => void;
    onFrame?: (frame: ReturnType<OnlineSession["view"]>) => void;
    onClose?: () => void;
  },
) {
  let bucketAt = performance.now(),
    bucket = 0;
  let session: OnlineSession | undefined,
    closed = false,
    queue: Promise<unknown> = Promise.resolve(),
    pending = 0,
    ticking = false;
  let timer: ReturnType<typeof setInterval> | undefined,
    token = "",
    verifiedAt = 0,
    subject = "";
  const deadline = setTimeout(() => {
    if (!session) fail("AUTH_TIMEOUT");
  }, 15000);
  const send = (value: unknown) => {
    if (socket.bufferedAmount > 4000000) {
      socket.terminate();
      void close();
      return;
    }
    if (socket.readyState === 1) {
      const text = JSON.stringify(value);
      options.metric?.("out", Buffer.byteLength(text));
      socket.send(text);
    }
  };
  async function close() {
    if (closed) return;
    closed = true;
    clearTimeout(deadline);
    if (timer) clearInterval(timer);
    await queue.catch(() => {});
    await session?.close().catch(() => {});
    options.onClose?.();
  }
  function fail(code: string) {
    send({ type: "online_error", code });
    socket.close(1011, "Sesja serwerowa przerwana. Połącz ponownie.");
    void close();
  }
  const publish = (frame: ReturnType<OnlineSession["view"]>) => {
    send({ type: "state", frame: { ...frame, peers: options.peers?.(frame) ?? [] } });
    options.onFrame?.(frame);
  };
  socket.on("message", (raw) => {
    if (closed) return;
    options.metric?.("in", raw.length);
    if (performance.now() - bucketAt > 1000) {
      bucketAt = performance.now();
      bucket = 0;
    }
    if (++bucket > 120) {
      fail("RATE_LIMIT");
      return;
    }
    if (++pending > 32) {
      fail("COMMAND_LIMIT");
      return;
    }
    queue = queue
      .then(async () => {
        if (closed) return;
        const input = packet.parse(JSON.parse(raw.toString()));
        if (input.type === "open") {
          if (session) throw Error("ALREADY_OPEN");
          token = input.token;
          const owner = await options.verify(token);
          subject = owner.subject;
          verifiedAt = Date.now();
          const opened = await OnlineSession.open(
            options.repository,
            owner,
            input.characterId,
            options.publicRoot ?? path.resolve(".output/public"),
          );
          if (closed) {
            await opened.close();
            return;
          }
          session = opened;
          session.setStaff(await options.role?.(token, subject));
          clearTimeout(deadline);
          publish(await session.tick());
          let lastTick = performance.now();
          timer = setInterval(() => {
            if (ticking || closed || !session) return;
            ticking = true;
            void (async () => {
              if (Date.now() - verifiedAt > 30000) {
                await options.verify(token);
                verifiedAt = Date.now();
              }
              if (!closed && session) {
                const now = performance.now();
                const dt = Math.max(1, Math.min(250, now - lastTick));
                lastTick = now;
                const started = performance.now();
                publish(await session.tick(dt));
                options.metric?.("tick", performance.now() - started);
              }
            })()
              .catch(() => fail("SESSION_FAILED"))
              .finally(() => {
                ticking = false;
              });
          }, 50);
        } else {
          if (!session) throw Error("AUTH_REQUIRED");
          if (input.type === "reauth") {
            const next = await options.verify(input.token);
            if (next.subject !== subject) throw Error("ACCOUNT_CHANGED");
            token = input.token;
            session.setStaff(await options.role?.(token, subject));
            verifiedAt = Date.now();
          } else if (input.type === "direction") session.setDirection(input.x, input.y);
          else {
            const result = await session.command(input.operationId, input.command);
            send({
              type: "ack",
              operationId: input.operationId,
              revision: result.revision,
              duplicate: result.duplicate,
            });
            publish(result.frame);
          }
        }
      })
      .catch(() => fail("COMMAND_REJECTED"))
      .finally(() => {
        pending--;
      });
  });
  socket.on("close", () => {
    void close();
  });
  socket.on("error", () => {
    void close();
  });
  return { close };
}
