import { useCallback, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SkillTree } from "../components/game/SkillTree";
import { GameSession, type Command } from "../game/session";

afterEach(cleanup);
function Harness({ game }: { game: GameSession }) {
  const [state, setState] = useState(() => game.snapshot());
  const send = useCallback(
    (command: Command) => {
      game.command(command);
      setState(game.snapshot());
    },
    [game],
  );
  return <SkillTree state={state} send={send} onClose={() => {}} />;
}
describe("skill-tree interface uses the real session model", () => {
  it("learns, equips and confirms a reset without granting more points", () => {
    const g = new GameSession(undefined, "planetary", true);
    g.player.level = 4;
    render(<Harness game={g} />);
    fireEvent.click(screen.getByRole("button", { name: /^Naucz się/ }));
    expect(g.player.progression!.learned).toContain("planetary.A1");
    expect(screen.getByLabelText("Umiejętność na miejscu 1")).toHaveValue("planetary.A1");
    fireEvent.click(screen.getByRole("button", { name: "Zresetuj punkty" }));
    expect(g.player.progression!.learned).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Potwierdź reset" }));
    expect(g.player.progression!.learned).toEqual(["planetary.R"]);
    expect(screen.getByRole("button", { name: /^Naucz się/ })).toBeEnabled();
  });
  it("browses another race without changing the character or allowing learning", () => {
    const g = new GameSession(undefined, "sage", true);
    g.player.level = 20;
    render(<Harness game={g} />);
    fireEvent.click(screen.getByRole("button", { name: "Androidy" }));
    expect(screen.getByText("Nexus-9", { exact: false })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Naucz się/ })).toBeDisabled();
    expect(g.player.race).toBe("sage");
    expect(g.player.progression!.learned).toEqual(["sage.R"]);
    fireEvent.click(screen.getByRole("tab", { name: "Statystyki" }));
    fireEvent.change(screen.getByLabelText("Poziom podglądu statystyk"), {
      target: { value: "1" },
    });
    expect(g.player.level).toBe(20);
  });
  it("gates learning with a clear level requirement while keeping locked nodes inspectable", () => {
    const g = new GameSession(undefined, "legend", true);
    const send = vi.fn();
    render(<SkillTree state={g.snapshot()} send={send} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Tysiąc Cięć · poziom 16" }));
    expect(
      within(screen.getByLabelText("Szczegóły umiejętności")).getByRole("heading", {
        name: "Tysiąc Cięć",
      }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /^Naucz się/ })).toBeDisabled();
    expect(screen.getByText("Wymagany poziom 16.")).toBeVisible();
    expect(send).not.toHaveBeenCalled();
  });
});
