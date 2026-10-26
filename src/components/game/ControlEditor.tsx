/**
 * Player-arranged touch controls: drag the attack, potion, skills and joystick handles to new
 * places; sizes are set with the sliders in the settings. Stored with the interface preferences.
 */
import { useEffect, useState, type PointerEvent } from "react";
import {
  CONTROL_IDS,
  DEFAULT_CONTROLS,
  joystickRest,
  type ControlId,
  type ControlLayout,
} from "../../game/uiPreferences";

export const CONTROL_LABEL: Record<ControlId, string> = {
  attack: "Atak",
  potion: "Mikstura",
  skills: "Umiejętności",
  joystick: "Joystick",
};
const SELECTOR: Record<Exclude<ControlId, "joystick">, string> = {
  attack: '.ki-actionbar > .ki-skill[data-ability="R"]',
  potion: '.ki-actionbar > .ki-skill[data-ability="potion"]',
  skills: ".ki-actionbar .ki-secondary-skills",
};

/** CSS variables that place and size the controls on the HUD root. */
export function controlStyle(c: ControlLayout): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of ["attack", "potion", "skills"] as const) {
    out[`--ctl-${id}-x`] = c[id].dx + "px";
    out[`--ctl-${id}-y`] = c[id].dy + "px";
    out[`--ctl-${id}-s`] = String(c[id].scale);
  }
  return out;
}

type Box = { x: number; y: number; w: number; h: number };

export function ControlEditor({
  controls,
  joystick,
  onChange,
  onDone,
}: {
  controls: ControlLayout;
  /** Whether the visible touch joystick is in use (world v2 on a touch screen). */
  joystick: boolean;
  onChange: (next: ControlLayout) => void;
  onDone: () => void;
}) {
  const [boxes, setBoxes] = useState<Partial<Record<ControlId, Box>>>({});
  const [drag, setDrag] = useState<{ id: ControlId; x: number; y: number } | null>(null);
  // Handles follow the real controls (their transformed boxes) after every change.
  useEffect(() => {
    const next: Partial<Record<ControlId, Box>> = {};
    for (const id of ["attack", "potion", "skills"] as const) {
      const el = document.querySelector(SELECTOR[id]);
      const r = el?.getBoundingClientRect();
      if (r && r.width > 0) next[id] = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    if (joystick) {
      const c = controls.joystick,
        at = joystickRest(window.innerWidth, window.innerHeight, c),
        d = 96 * c.scale;
      next.joystick = { x: at.x - d / 2, y: at.y - d / 2, w: d, h: d };
    }
    setBoxes(next);
  }, [controls, joystick]);

  const move = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
    const c = controls[drag.id];
    onChange({ ...controls, [drag.id]: { ...c, dx: c.dx + dx, dy: c.dy + dy } });
  };
  return (
    <div
      className="ki-control-editor"
      onPointerMove={move}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      <div className="ki-control-editor-bar">
        <span>Przeciągnij przyciski w wygodne miejsca</span>
        <button onClick={() => onChange(DEFAULT_CONTROLS)}>Przywróć domyślne</button>
        <button className="is-primary" onClick={onDone}>
          Gotowe
        </button>
      </div>
      {CONTROL_IDS.map((id) => {
        const b = boxes[id];
        if (!b) return null;
        return (
          <div
            key={id}
            className={"ki-control-handle" + (drag?.id === id ? " is-dragging" : "")}
            style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
            onPointerDown={(e) => {
              e.currentTarget.parentElement?.setPointerCapture(e.pointerId);
              setDrag({ id, x: e.clientX, y: e.clientY });
            }}
          >
            <span>{CONTROL_LABEL[id]}</span>
          </div>
        );
      })}
    </div>
  );
}
