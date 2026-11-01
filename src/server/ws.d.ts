declare module "ws" {
  import { EventEmitter } from "events";
  import { Server as HttpServer, IncomingMessage } from "http";

  export class WebSocket extends EventEmitter {
    static OPEN: number;
    static CLOSED: number;
    static CLOSING: number;
    static CONNECTING: number;

    constructor(address: string | URL, options?: Record<string, unknown>);

    readyState: number;
    bufferedAmount: number;
    send(data: string | Buffer | ArrayBufferView, cb?: (err?: Error) => void): void;
    close(code?: number, data?: string): void;
    terminate(): void;
    ping(): void;
  }

  export interface ServerOptions {
    port?: number;
    server?: HttpServer;
    path?: string;
    maxPayload?: number;
    perMessageDeflate?: boolean | Record<string, unknown>;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options?: ServerOptions, callback?: () => void);
    close(cb?: (err?: Error) => void): void;
    clients: Set<WebSocket>;
    on(event: "connection", cb: (socket: WebSocket, request: IncomingMessage) => void): this;
    on(event: "error", cb: (error: Error) => void): this;
    on(event: "close", cb: () => void): this;
    on(event: string, cb: (...args: unknown[]) => void): this;
  }
}
