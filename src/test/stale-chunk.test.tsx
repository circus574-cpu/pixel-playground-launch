import { fireEvent, render, screen } from "@testing-library/react";
import { lazy, Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PanelBoundary } from "../components/game/PanelBoundary";
import { isStaleChunkError, reloadForFreshBuild } from "../lib/staleChunk";

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("stale chunk after a deployment", () => {
  it("recognises dynamic import failures and ignores other errors", () => {
    expect(
      isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: /assets/x.js")),
    ).toBe(true);
    expect(isStaleChunkError(new Error("Importing a module script failed."))).toBe(true);
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });

  it("reloads at most once per minute", () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
    expect(reloadForFreshBuild(1_000_000)).toBe(true);
    expect(reloadForFreshBuild(1_030_000)).toBe(false);
    expect(reloadForFreshBuild(1_070_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("keeps a failing panel inside the game with a way back", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onClose = vi.fn();
    const Broken = lazy(() => Promise.reject(new Error("render failed")));
    render(
      <PanelBoundary label="Mapa planety" onClose={onClose}>
        <Suspense fallback={null}>
          <Broken />
        </Suspense>
      </PanelBoundary>,
    );
    return screen.findByRole("alert").then(() => {
      fireEvent.click(screen.getByRole("button", { name: "Wróć do gry" }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
