import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const server = vi.hoisted(() => ({
  session: vi.fn(),
  header: vi.fn(),
  request: vi.fn(),
}));
vi.mock("@tanstack/react-start/server", () => ({
  useSession: server.session,
  setResponseHeader: server.header,
  getRequest: server.request,
}));
import { checkSketchOrigin, requireSketchAccess, sketchSession } from "../lib/sketches.server";

describe("private sketch access stays independent of gameplay", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SESSION_SECRET", "isolated-test-session-secret-at-least-32-characters");
  });
  it("rejects missing unlock capability before storage can be accessed", async () => {
    server.session.mockResolvedValue({ data: {} });
    await expect(requireSketchAccess()).rejects.toThrow("Wpisz hasło");
  });
  it("requires encrypted, HTTP-only, same-site session and disables caching", async () => {
    server.session.mockResolvedValue({ data: { unlocked: true } });
    expect((await requireSketchAccess()).data.unlocked).toBe(true);
    expect(server.header).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(server.session).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ki-sketches",
        cookie: { httpOnly: true, secure: true, sameSite: "strict", path: "/" },
      }),
    );
  });
  it("fails closed when session configuration is missing", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    await expect(sketchSession()).rejects.toThrow("Brak konfiguracji dostępu");
    expect(server.session).not.toHaveBeenCalled();
  });
  it("rejects cross-origin operations", () => {
    server.request.mockReturnValue(
      new Request("https://game.example/test", { headers: { origin: "https://outside.example" } }),
    );
    expect(checkSketchOrigin).toThrow("Niedozwolone żądanie");
    server.request.mockReturnValue(
      new Request("https://game.example/test", { headers: { origin: "https://game.example" } }),
    );
    expect(checkSketchOrigin).not.toThrow();
  });
});
