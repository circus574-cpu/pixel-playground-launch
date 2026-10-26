import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CombatAction } from "../components/game/CombatAction";

afterEach(cleanup);

it("dispatches once per pointer press, ignores a second finger, and releases on cancel", () => {
  const activate = vi.fn();
  const { getByRole } = render(<CombatAction onActivate={activate}>Skill</CombatAction>);
  const button = getByRole("button");
  button.setPointerCapture = vi.fn();
  button.hasPointerCapture = () => true;
  button.releasePointerCapture = vi.fn();
  const pointer = (type: string, id: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: id, button: 0 });
    fireEvent(button, event);
  };
  pointer("pointerdown", 2);
  pointer("pointerdown", 3);
  pointer("pointerup", 3);
  fireEvent.click(button, { detail: 1 });
  expect(activate).toHaveBeenCalledTimes(1);
  pointer("pointercancel", 2);
  expect(button.releasePointerCapture).toHaveBeenCalledWith(2);
  pointer("pointerdown", 4);
  pointer("pointerup", 4);
  expect(activate).toHaveBeenCalledTimes(2);
  fireEvent.click(button, { detail: 0 });
  expect(activate).toHaveBeenCalledTimes(3);
});

it("does not activate a disabled action", () => {
  const activate = vi.fn();
  const { getByRole } = render(
    <CombatAction disabled onActivate={activate}>
      Skill
    </CombatAction>,
  );
  fireEvent.click(getByRole("button"));
  fireEvent.pointerDown(getByRole("button"));
  expect(activate).not.toHaveBeenCalled();
});

it("releases the held pointer when a menu or cooldown disables the action", () => {
  const activate = vi.fn();
  const { getByRole, rerender } = render(<CombatAction onActivate={activate}>Skill</CombatAction>);
  const button = getByRole("button");
  button.setPointerCapture = vi.fn();
  button.hasPointerCapture = () => true;
  button.releasePointerCapture = vi.fn();
  const event = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 8, button: 0 });
  fireEvent(button, event);
  rerender(
    <CombatAction disabled onActivate={activate}>
      Skill
    </CombatAction>,
  );
  expect(button.releasePointerCapture).toHaveBeenCalledWith(8);
  expect(activate).toHaveBeenCalledTimes(1);
});
