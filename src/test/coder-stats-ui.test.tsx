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
import { newPlayer } from "../game/session";
import { summarize } from "../game/account/gmEdit";
afterEach(cleanup);
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
