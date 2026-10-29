import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...p }: { children: ReactNode; to: string }) => (
    <a href={to} {...p}>
      {children}
    </a>
  ),
}));
import { CharacterEditor } from "../components/admin/CoderAdminPanel";
import { newPlayer, stats } from "../game/session";
import { RACE_IDS } from "../game/world/races";
import { emptyCombatTraining } from "../game/combatTraining";
import { CHARACTER_STAT_FIELDS } from "../game/characterStats";
import { emptyDevelopment } from "../game/development/state";
import { summarize } from "../game/account/gmEdit";
afterEach(cleanup);
const makeRow = (player = newPlayer()) => ({
  user_id: "qa",
  save_key: "qa-character",
  revision: 1,
  data: { player },
  updated_at: "2026-10-29T00:00:00Z",
  updated_by: null,
});

it.each(RACE_IDS)("shows real race/level/equipment/training values before editing %s", (race) => {
  const player = newPlayer(race);
  player.level = 7;
  player.skills = ["R", "A1", "A2"];
  player.weapon = "sword";
  player.items.sword = 1;
  player.upgrade = 1;
  player.armor = "vest";
  player.items.vest = 1;
  player.combatTraining = emptyCombatTraining();
  player.combatTraining.technique.rank = 20;
  player.combatTraining.attackSpeed.rank = 20;
  player.combatTraining.dodge.rank = 10;
  const actual = stats(player);
  render(<CharacterEditor row={makeRow(player)} onSaveData={vi.fn()} />);
  for (const [key, field] of Object.entries(CHARACTER_STAT_FIELDS))
    expect(screen.getByLabelText(field.label)).toHaveValue(
      Number(actual[key as keyof typeof actual].toFixed(6)),
    );
  expect(screen.getByRole("button", { name: "Zapisz zmiany" })).toBeDisabled();
  expect(player.statOverrides).toBeUndefined();
});

it("recalculates level/equipment preview but never freezes untouched fields as GM overrides", async () => {
  const row = makeRow();
  row.data.player.items.sword = 1;
  const onSaveData = vi.fn(async (_data: unknown) => {});
  render(<CharacterEditor row={row} onSaveData={onSaveData} />);
  fireEvent.change(screen.getByLabelText("Poziom (1–100)"), { target: { value: "7" } });
  fireEvent.change(screen.getByLabelText("Założona broń"), { target: { value: "sword" } });
  const expected = stats({ ...row.data.player, level: 7, weapon: "sword" });
  expect(screen.getByLabelText("Atak")).toHaveValue(expected.attack);
  fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
  await waitFor(() => expect(onSaveData).toHaveBeenCalledTimes(1));
  const saved = onSaveData.mock.calls[0]![0] as typeof row.data;
  expect(saved.player.statOverrides).toBeUndefined();
  expect(stats(saved.player)).toEqual(expected);
});

it("reloads clean fields when a newer save arrives and blocks stale dirty edits until explicitly discarded", async () => {
  const row = makeRow(),
    onSaveData = vi.fn(async (_data: unknown) => {});
  const { rerender } = render(<CharacterEditor row={row} onSaveData={onSaveData} />);
  const newer = { ...row, revision: 2, data: { player: { ...row.data.player, level: 5 } } };
  rerender(<CharacterEditor row={newer} onSaveData={onSaveData} />);
  expect(screen.getByLabelText("Szybkość ruchu (jednostki/s)")).toHaveValue(
    Number(stats(newer.data.player).speed.toFixed(6)),
  );
  fireEvent.change(screen.getByLabelText("Atak"), { target: { value: "99" } });
  const latest = { ...newer, revision: 3, data: { player: { ...newer.data.player, level: 8 } } };
  rerender(<CharacterEditor row={latest} onSaveData={onSaveData} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Zapis postaci zmienił się podczas edycji");
  expect(screen.getByRole("button", { name: "Zapisz zmiany" })).toBeDisabled();
  expect(onSaveData).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Wczytaj aktualne dane" }));
  expect(screen.getByLabelText("Atak")).toHaveValue(stats(latest.data.player).attack);
  expect(screen.getByRole("button", { name: "Zapisz zmiany" })).toBeDisabled();
});

it("clearing an override restores the computed value without resetting other GM fields", async () => {
  const player = newPlayer();
  player.statOverrides = { speed: 700, attack: 99 };
  const onSaveData = vi.fn(async (_data: unknown) => {});
  render(<CharacterEditor row={makeRow(player)} onSaveData={onSaveData} />);
  const input = screen.getByLabelText("Szybkość ruchu (jednostki/s)");
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.blur(input);
  expect(input).toHaveValue(stats({ ...player, statOverrides: { attack: 99 } }).speed);
  expect(screen.getByLabelText("Atak")).toHaveValue(99);
  fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
  await waitFor(() => expect(onSaveData).toHaveBeenCalledTimes(1));
  expect(summarize(onSaveData.mock.calls[0]![0])!.statOverrides).toEqual({ attack: 99 });
});

it("shows effective range including the saved optics module, without overwriting its underlying GM setting", async () => {
  const player = newPlayer("android");
  player.development = emptyDevelopment();
  player.development.unlockedModules = ["mn-optics"];
  player.development.equippedModuleIds = ["mn-optics"];
  player.statOverrides = { range: 200 };
  const actual = stats(player);
  expect(actual.range).toBeGreaterThan(200);
  const onSaveData = vi.fn(async (_data: unknown) => {});
  render(<CharacterEditor row={makeRow(player)} onSaveData={onSaveData} />);
  expect(screen.getByLabelText("Zasięg ataku")).toHaveValue(Number(actual.range.toFixed(6)));
  fireEvent.change(screen.getByLabelText("Złoto"), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
  await waitFor(() => expect(onSaveData).toHaveBeenCalledTimes(1));
  expect(summarize(onSaveData.mock.calls[0]![0])!.statOverrides).toEqual({ range: 200 });
});

it("reports a failed local write without clearing the editor or claiming success", async () => {
  const onSaveData = vi.fn(async () => {
    throw new Error("Pamięć niedostępna");
  });
  render(<CharacterEditor row={makeRow()} onSaveData={onSaveData} />);
  fireEvent.change(screen.getByLabelText("Atak"), { target: { value: "42" } });
  fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
  await screen.findByText("Pamięć niedostępna");
  expect(screen.getByLabelText("Atak")).toHaveValue(42);
  expect(screen.queryByText("Zapisano postać na urządzeniu.")).not.toBeInTheDocument();
});
it("saves speed through the actual Coder character form and can restore defaults", async () => {
  const onSaveData = vi.fn(async (_data: unknown) => {});
  const row = {
    user_id: "qa",
    save_key: "qa-character",
    revision: 1,
    data: { player: newPlayer() },
    updated_at: "2026-10-28T00:00:00Z",
    updated_by: null,
  };
  render(<CharacterEditor row={row} onSaveData={onSaveData} />);
  fireEvent.change(screen.getByLabelText("Szybkość ruchu (jednostki/s)"), {
    target: { value: "650" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
  await waitFor(() => expect(onSaveData).toHaveBeenCalledTimes(1));
  expect(summarize(onSaveData.mock.calls[0]![0])!.statOverrides.speed).toBe(650);
  fireEvent.click(screen.getByRole("button", { name: "Przywróć parametry domyślne" }));
  fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
  await waitFor(() => expect(onSaveData).toHaveBeenCalledTimes(2));
  expect(summarize(onSaveData.mock.calls[1]![0])!.statOverrides).toEqual({});
});
it("does not save an out-of-range speed", async () => {
  const onSaveData = vi.fn(async () => {});
  render(
    <CharacterEditor
      row={{
        user_id: "qa",
        save_key: "qa",
        revision: 1,
        data: { player: newPlayer() },
        updated_at: "2026-10-28T00:00:00Z",
        updated_by: null,
      }}
      onSaveData={onSaveData}
    />,
  );
  fireEvent.change(screen.getByLabelText("Szybkość ruchu (jednostki/s)"), {
    target: { value: "999999" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
  await screen.findByText(/Parametry postaci poza dozwolonym zakresem/);
  expect(onSaveData).not.toHaveBeenCalled();
});
