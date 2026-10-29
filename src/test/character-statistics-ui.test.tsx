import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CharacterStatsPanel } from "../components/game/CharacterStatsPanel";
import { initialView, newPlayer } from "../game/session";
import { emptyCombatTraining } from "../game/combatTraining";
afterEach(cleanup);

it("shows a single stat value without equipment and omits the breakdown", () => {
  render(<CharacterStatsPanel state={initialView()} train={() => {}} />);
  const row = screen.getByText("Atak", { exact: true }).closest("[data-stat]")!;
  expect(row.querySelector("strong")).toHaveTextContent("12");
  expect(row.querySelector(".ki-item-stat-bonus")).toBeNull();
  expect(screen.queryByText(/Baza/)).toBeNull();
});

it("shows the weapon contribution in red without counting it twice", () => {
  const player = newPlayer();
  player.items.sword = 1;
  player.weapon = "sword";
  const state = initialView(player);
  render(<CharacterStatsPanel state={state} train={() => {}} />);
  const row = screen.getByText("Atak", { exact: true }).closest("[data-stat]")!;
  expect(state.stats.attack).toBe(20);
  expect(row.querySelector("strong")).toHaveTextContent("12");
  expect(row.querySelector(".ki-item-stat-bonus")).toHaveTextContent("+ 8");
  expect(row.querySelector(".ki-item-stat-bonus")).toHaveStyle({ color: "#ff6262" });
});

it("includes trained values in X and respects a fixed GM override", () => {
  const player = newPlayer();
  player.combatTraining = emptyCombatTraining();
  player.combatTraining.technique.rank = 10;
  player.items.sword = 1;
  player.weapon = "sword";
  player.statOverrides = { attack: 99 };
  render(<CharacterStatsPanel state={initialView(player)} train={() => {}} />);
  const attack = screen.getByText("Atak", { exact: true }).closest("[data-stat]")!;
  const technique = screen.getByText("Technika", { exact: true }).closest("[data-stat]")!;
  expect(attack.querySelector("strong")).toHaveTextContent("99");
  expect(attack.querySelector(".ki-item-stat-bonus")).toBeNull();
  expect(technique.querySelector("strong")).toHaveTextContent("10");
});
