import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameHud } from "../components/game/GameHud";
import { initialView } from "../game/session";
const state = { ...initialView(), ready: true };
afterEach(cleanup);
describe("game interface controls", () => {
  it("opens and closes an actual inventory dialog", () => {
    render(
      <GameHud
        onCommand={() => {}}
        state={state}
        error={null}
        zoom={0.62}
        onZoom={() => {}}
        fullscreen={false}
        onFullscreen={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ekwipunek" }));
    expect(screen.getByRole("dialog", { name: "Ekwipunek" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Zamknij okno" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("routes zoom and fullscreen actions separately from character input", () => {
    const onZoom = vi.fn();
    const onFullscreen = vi.fn();
    render(
      <GameHud
        onCommand={() => {}}
        state={state}
        error={null}
        zoom={0.62}
        onZoom={onZoom}
        fullscreen={false}
        onFullscreen={onFullscreen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Oddal mapę" }));
    expect(onZoom).toHaveBeenCalledWith(0.54);
    fireEvent.click(screen.getByRole("button", { name: "Pełny ekran" }));
    expect(onFullscreen).toHaveBeenCalledTimes(1);
  });
});
