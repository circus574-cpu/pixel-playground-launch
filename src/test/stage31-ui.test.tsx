import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameLoadingScreen } from "../components/game/GameLoadingScreen";
import { CharacterSelection } from "../components/game/CharacterSelection";
import { GameHud } from "../components/game/GameHud";
import { GameSession, initialView } from "../game/session";
import { RACE_IDS, RACES } from "../game/world/races";
import { WORLDS } from "../game/world/worlds";

afterEach(cleanup);
describe("real loading presentation", () => {
  it("shows only asset-loader fractions as percentages, and no made-up initialization percentage", () => {
    const { rerender } = render(
      <GameLoadingScreen
        state={{ phase: "preparing", message: "Przygotowywanie świata…", progress: null }}
      />,
    );
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    rerender(
      <GameLoadingScreen
        race="legend"
        state={{ phase: "assets", message: "Ładowanie kontynentu…", progress: 0.375 }}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "38");
    expect(screen.getByText("Pyra")).toBeVisible();
    rerender(
      <GameLoadingScreen
        state={{ phase: "building", message: "Przywoływanie bohatera…", progress: null }}
      />,
    );
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
  it("offers retry and return on an error without a misleading completed bar", () => {
    const retry = vi.fn(),
      back = vi.fn();
    render(
      <GameLoadingScreen
        state={{ phase: "error", message: "Brak połączenia", progress: null }}
        onRetry={retry}
        onBack={back}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Brak połączenia");
    expect(screen.queryByRole("progressbar")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ponów próbę" }));
    fireEvent.click(screen.getByRole("button", { name: "Wróć do postaci" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(back).toHaveBeenCalledOnce();
  });
});
it.each(RACE_IDS)("keeps %s identity during bootstrap and in the HUD", (race) => {
  const player = new GameSession(undefined, race).player;
  const state = initialView(player);
  expect(state.player.race).toBe(race);
  expect(state.player.continent).toBe(RACES[race].world);
  expect(state.ready).toBe(false);
  expect(state.player).not.toBe(player);
  render(
    <GameHud
      state={{ ...state, ready: true }}
      error={null}
      zoom={0.62}
      onZoom={() => {}}
      fullscreen={false}
      onFullscreen={() => {}}
      onCommand={() => {}}
    />,
  );
  expect(document.querySelector(".ki-location")).toHaveTextContent(
    WORLDS[player.continent].settlement,
  );
  expect(document.querySelector(".ki-location")).toHaveTextContent(WORLDS[player.continent].name);
  if (race === "legend")
    expect(document.querySelector(".ki-location")).not.toHaveTextContent("Verdantia");
});
it("allows comparing every origin without creating a save until the explicit start action", () => {
  const create = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  render(<CharacterSelection slots={[]} warning="" onCreate={create} onContinue={() => {}} />);
  for (const race of RACE_IDS) {
    fireEvent.click(
      screen.getByRole("button", { name: "Podgląd kontynentu: " + RACES[race].name }),
    );
    expect(
      screen.getByRole("region", { name: "Pochodzenie: " + RACES[race].name }),
    ).toHaveTextContent(WORLDS[RACES[race].world].name);
    expect(create).not.toHaveBeenCalled();
  }
  fireEvent.click(screen.getByRole("button", { name: "Rozpocznij przygodę" }));
  expect(create).toHaveBeenCalledWith("legend");
});
it.each([0, 1, 60, 120])("keeps separate accessible HP/KI readings at HP %s", (hp) => {
  const state = initialView();
  state.player.hp = hp;
  state.player.ki = hp === 0 ? 0 : 50;
  render(
    <GameHud
      state={{ ...state, ready: true }}
      error={null}
      zoom={0.62}
      onZoom={() => {}}
      fullscreen={false}
      onFullscreen={() => {}}
      onCommand={() => {}}
    />,
  );
  expect(screen.getByRole("meter", { name: "Zdrowie" })).toHaveAttribute(
    "aria-valuenow",
    String(hp),
  );
  expect(screen.getByRole("meter", { name: "Energia KI" })).toHaveAttribute(
    "aria-valuenow",
    hp === 0 ? "0" : "50",
  );
});
it("announces the same fractional HP/KI values that the player can read", () => {
  const state = initialView();
  state.player.hp = 39.2;
  state.player.ki = 13.8;
  render(
    <GameHud
      state={{ ...state, ready: true }}
      error={null}
      zoom={0.62}
      onZoom={() => {}}
      fullscreen={false}
      onFullscreen={() => {}}
      onCommand={() => {}}
    />,
  );
  const health = screen.getByRole("meter", { name: "Zdrowie" }),
    ki = screen.getByRole("meter", { name: "Energia KI" });
  expect(health).toHaveAttribute("aria-valuenow", "40");
  expect(health).toHaveTextContent("40 / 120");
  expect(ki).toHaveAttribute("aria-valuenow", "13");
  expect(ki).toHaveTextContent("13 / 50");
});
