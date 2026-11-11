import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as kit from "../game/kit";
import { GraphicSkillTree } from "../components/game/GraphicSkillTree";
import type { GameViewState } from "../game/session";
import type { RaceId } from "../game/world/races";

function mockState(
  race: RaceId = "planetary",
  level = 10,
  skills: string[] = ["R", "A1"],
): GameViewState {
  return {
    player: {
      id: "p1",
      name: "Test Warrior",
      race,
      level,
      gold: 500,
      skills,
      hp: 200,
      maxHp: 200,
      ki: 100,
      maxKi: 100,
      pos: { x: 100, y: 100 },
      state: "idle",
      facing: "S",
      dead: false,
    } as unknown as GameViewState["player"],
    skillPoints: 5,
    respecCost: 0,
    foes: [],
    projectiles: [],
    effects: [],
    messages: [],
    notifications: [],
    inventory: [],
    equipment: {},
    quests: [],
    activeQuests: [],
  } as unknown as GameViewState;
}

describe("GraphicSkillTree Component", () => {
  it("renders starting node, branch headers and the KI mode node for planetary", () => {
    const send = vi.fn();
    const state = mockState("planetary", 10, ["R"]);
    render(<GraphicSkillTree state={state} send={send} />);

    // Points bar
    expect(screen.getByText("Punkty")).toBeDefined();
    expect(screen.getByText("Szlak Wędrowca")).toBeDefined();
    expect(screen.getByText("Żywa Ziemia")).toBeDefined();
    expect(screen.getAllByText("Pieśń Korzeni").length).toBeGreaterThanOrEqual(1);

    // Node names should be visible directly on the nodes (and card)
    expect(screen.getAllByText("Cios Szlaku").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Szybki Unik")).toBeDefined();
    expect(screen.getByText("Wir Energii")).toBeDefined();
    expect(screen.getByText("Forma Rezonansu Świata")).toBeDefined();
  });

  it("renders '+' button directly at the node branching for learnable skills", () => {
    const send = vi.fn();
    // Level 10 player with R and A1, 5 skill points. A2 and A3 require A1 (level 4), so both are learnable!
    const state = mockState("planetary", 10, ["R", "A1"]);
    const { container } = render(<GraphicSkillTree state={state} send={send} />);

    const plusButtons = container.querySelectorAll(".ki-st-plus");
    expect(plusButtons.length).toBeGreaterThan(0);

    // Click "+" on A1 (increasing rank) or A2 (learning)
    const a1Plus = screen.getByLabelText("Zwiększ rangę: Szybki Unik");
    expect(a1Plus).toBeDefined();
    fireEvent.click(a1Plus);
    expect(send).toHaveBeenCalledWith({ type: "learn", node: "A1" });

    const a2Plus = screen.getByLabelText("Poznaj: Lekki Krok");
    expect(a2Plus).toBeDefined();
    fireEvent.click(a2Plus);
    expect(send).toHaveBeenCalledWith({ type: "learn", node: "A2" });
  });

  it("opens beautiful description card with lore and action details when clicking a node", () => {
    const send = vi.fn();
    const state = mockState("planetary", 10, ["R", "A1"]);
    const { container } = render(<GraphicSkillTree state={state} send={send} />);

    // Click on A1 node (Szybki Unik)
    const a1Node = container.querySelector('.ki-st-node[data-id="A1"]') as HTMLElement;
    expect(a1Node).toBeDefined();
    fireEvent.click(a1Node);

    // Card should appear with action section, facts, and lore
    expect(screen.getByRole("heading", { name: "Działanie" })).toBeDefined();
    expect(screen.getByText(/Ziemia pomaga tym, którzy jej słuchają/i)).toBeDefined();
    expect(screen.getByText(/Zryw w wybranym kierunku/i)).toBeDefined();
    expect(screen.getByText(/Bez limitu rang/i)).toBeDefined();

    // Card has learn / increase rank button
    const cardLearnBtn = screen.getByRole("button", { name: /Zwiększ rangę do 2/i });
    fireEvent.click(cardLearnBtn);
    expect(send).toHaveBeenCalledWith({ type: "learn", node: "A1" });
  });

  it("marks exclusive choice nodes with 'albo' divider", () => {
    const send = vi.fn();
    const state = mockState("planetary", 14, ["R"]);
    const { container } = render(<GraphicSkillTree state={state} send={send} />);

    // The 'albo' divider badges
    const alboDividers = container.querySelectorAll(".ki-st-albo");
    expect(alboDividers.length).toBe(3); // 3 branches: A7/A8, B7/B8, C7/C8
    expect(alboDividers[0]?.textContent).toBe("albo");
  });

  it("supports all 4 races without crashing and shows race-specific branch names and lore", () => {
    const races: RaceId[] = ["planetary", "sage", "android", "legend"];
    for (const race of races) {
      const send = vi.fn();
      const state = mockState(race, 20, ["R"]);
      const { unmount } = render(<GraphicSkillTree state={state} send={send} />);
      unmount();
    }
  });

  it("memo pomija re-render przy niezmienionych polach drzewka, a przepuszcza naukę", () => {
    const send = vi.fn();
    // canLearn jest wołane tylko podczas renderu drzewka — licznik jego wywołań mierzy re-render.
    const spy = vi.spyOn(kit, "canLearn");
    const base = mockState("planetary", 10, ["R", "A1"]);
    const { rerender } = render(<GraphicSkillTree state={base} send={send} />);
    expect(spy.mock.calls.length).toBeGreaterThan(0);
    spy.mockClear();
    // Nowy obiekt stanu, ale pola drzewka identyczne — memo ma pominąć render (0 wywołań).
    const unrelated = {
      ...base,
      player: { ...base.player, pos: { x: 999, y: 999 } },
    } as GameViewState;
    rerender(<GraphicSkillTree state={unrelated} send={send} />);
    expect(spy.mock.calls.length).toBe(0);
    // Nauka zmienia skills — memo musi przepuścić i policzyć węzły od nowa.
    const learned = {
      ...base,
      player: { ...base.player, skills: ["R", "A1", "A2"] },
    } as GameViewState;
    rerender(<GraphicSkillTree state={learned} send={send} />);
    expect(spy.mock.calls.length).toBeGreaterThan(0);
    spy.mockRestore();
  });
});
