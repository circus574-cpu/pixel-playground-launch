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

it("does not advertise distant conversations or conversations during combat", () => {
  const props = {
    onCommand: () => {},
    state: { ...state, x: 2300, y: 30 },
    error: null,
    zoom: 0.62,
    onZoom: () => {},
    fullscreen: false,
    onFullscreen: () => {},
  };
  const view = render(<GameHud {...props} />);
  expect(screen.queryByRole("button", { name: /Rozmowa ·/ })).toBeNull();
  view.rerender(
    <GameHud
      {...props}
      state={{
        ...state,
        target: { name: "Dzik", level: 1, hp: 30, maxHp: 30, inRange: false },
      }}
    />,
  );
  expect(screen.queryByRole("button", { name: /Rozmowa ·/ })).toBeNull();
});

it("closes the tools on Escape and outside pointer input without intercepting gameplay", () => {
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
  const menu = screen.getByRole("button", { name: "Menu gry" });
  fireEvent.click(menu);
  expect(menu).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(menu).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(menu);
  fireEvent.pointerDown(document.body);
  expect(menu).toHaveAttribute("aria-expanded", "false");
});
