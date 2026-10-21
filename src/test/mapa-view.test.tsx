import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { FALLBACK_NOTICE, MapaView } from "../components/planet-map/MapaView";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLImageElement.prototype.decode ??= () => Promise.resolve();
});

describe("/mapa view selection", () => {
  it("shows the flat atlas with an explanation when WebGL 2 is missing", async () => {
    render(<MapaView probe={() => false} />);
    expect(await screen.findByText(FALLBACK_NOTICE["no-webgl"])).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /mapa planety Superior/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Globus 3D" })).toBeNull();
  });

  it("lazy-loads the globe with continent markers and switches to the flat atlas on request", async () => {
    render(<MapaView probe={() => true} />);
    const toFlat = await screen.findByRole("button", { name: "Mapa 2D" }, { timeout: 15_000 });
    for (const name of ["Verdantia", "Aetheria", "Nexus-9", "Pyra"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^${name} — kontynent`) }),
      ).toBeInTheDocument();
    }
    fireEvent.click(toFlat);
    expect(await screen.findByRole("button", { name: "Globus 3D" })).toBeInTheDocument();
    for (const text of Object.values(FALLBACK_NOTICE)) expect(screen.queryByText(text)).toBeNull();
  }, 20_000);
});
