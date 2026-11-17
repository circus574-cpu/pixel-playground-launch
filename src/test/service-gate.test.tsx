import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceGate } from "../components/game/ServiceGate";

const auth = vi.hoisted(() => ({
  state: { ready: true, session: null as null | { user: { id: string } } },
}));
vi.mock("../components/account/useAccount", () => ({ useAccount: () => auth.state }));
vi.mock("../game/account/vpsAuth", () => ({ accessToken: async () => "server-verified-session" }));
const reply = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
beforeEach(() => {
  auth.state = { ready: true, session: null };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("website maintenance entry", () => {
  it("shows conservation instead of the game and keeps the administrator login reachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply({ maintenance: true, canEnter: false, message: "Rozbudowa Pyry" })),
    );
    render(
      <ServiceGate>
        <p>GAME RUNTIME</p>
      </ServiceGate>,
    );
    await screen.findByText("Rozbudowa Pyry");
    expect(screen.queryByText("GAME RUNTIME")).toBeNull();
    expect(screen.getByRole("link", { name: "Logowanie administratora" })).toHaveAttribute(
      "href",
      "/konto",
    );
  });
  it("lets an authenticated administrator enter based on the server response", async () => {
    auth.state.session = { user: { id: "owner" } };
    const request = vi.fn(async () => reply({ maintenance: true, canEnter: true }));
    vi.stubGlobal("fetch", request);
    render(
      <ServiceGate>
        <p>GAME RUNTIME</p>
      </ServiceGate>,
    );
    await screen.findByText("GAME RUNTIME");
    expect(request).toHaveBeenCalledWith(
      "/ws/godot/status",
      expect.objectContaining({
        cache: "no-store",
        headers: { Authorization: "Bearer server-verified-session" },
      }),
    );
  });
  it("does not trust stale client state or a malformed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply({ maintenance: true, roles: ["admin"] })),
    );
    render(
      <ServiceGate>
        <p>GAME RUNTIME</p>
      </ServiceGate>,
    );
    await screen.findByText(/Serwer jest chwilowo niedostępny/);
    expect(screen.queryByText("GAME RUNTIME")).toBeNull();
  });
  it("unmounts a running game after the owner closes access and restores it when reopened", async () => {
    vi.useFakeTimers();
    let closed = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply({ maintenance: closed, canEnter: !closed, message: "Konserwacja" })),
    );
    render(
      <ServiceGate>
        <p>GAME RUNTIME</p>
      </ServiceGate>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText("GAME RUNTIME")).toBeInTheDocument();
    closed = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.queryByText("GAME RUNTIME")).toBeNull();
    expect(screen.getByText("Konserwacja")).toBeInTheDocument();
    closed = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByText("GAME RUNTIME")).toBeInTheDocument();
  });
  it("cancels an old status request when the account changes", async () => {
    let finish: ((response: Response) => void) | undefined;
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options) => {
        signal = options.signal;
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }),
    );
    const view = render(
      <ServiceGate>
        <p>GAME RUNTIME</p>
      </ServiceGate>,
    );
    await waitFor(() => expect(finish).toBeDefined());
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      finish?.(reply({ maintenance: false, canEnter: true }));
    });
  });
});
