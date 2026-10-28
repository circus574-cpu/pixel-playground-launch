/**
 * Player-arranged touch controls: drag the attack, potion, dodge, every skill button and the
 * joystick to new places; sizes are set with the sliders in the settings. Stored with the interface
 * preferences (skill buttons and dodge by ability id in `controls.buttons`).
 */
import { useEffect, useState, type PointerEvent } from "react";
import {
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
/** A draggable handle: a fixed control, or one button (`btn:<ability id>`). */
type HandleId = ControlId | `btn:${string}`;
const BUTTONS =
  ".ki-actionbar .ki-secondary-skills .ki-skill[data-ability], .ki-actionbar > .ki-dodge";

/** Inline offset of one skill or dodge button, on top of its group placement. */
export function buttonStyle(c: ControlLayout, id: string): Record<string, string> | undefined {
  const b = c.buttons?.[id];
  return b && (b.dx || b.dy) ? { translate: b.dx + "px " + b.dy + "px" } : undefined;
}

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
  const [boxes, setBoxes] = useState<{ id: HandleId; label: string; box: Box }[]>([]);
  const [drag, setDrag] = useState<{ id: HandleId; x: number; y: number } | null>(null);
  // Handles follow the real controls (their transformed boxes) after every change.
  useEffect(() => {
    const next: { id: HandleId; label: string; box: Box }[] = [];
    const add = (id: HandleId, label: string, el: Element | null) => {
      const r = el?.getBoundingClientRect();
      if (r && r.width > 0)
        next.push({ id, label, box: { x: r.x, y: r.y, w: r.width, h: r.height } });
    };
    add("attack", CONTROL_LABEL.attack, document.querySelector(SELECTOR.attack));
    add("potion", CONTROL_LABEL.potion, document.querySelector(SELECTOR.potion));
    for (const el of document.querySelectorAll(BUTTONS)) {
      const id = el.getAttribute("data-ability")!;
      add(("btn:" + id) as HandleId, el.getAttribute("aria-label") ?? id, el);
    }
    if (joystick) {
      const c = controls.joystick,
        at = joystickRest(window.innerWidth, window.innerHeight, c),
        d = 96 * c.scale;
      next.push({
        id: "joystick",
        label: CONTROL_LABEL.joystick,
        box: { x: at.x - d / 2, y: at.y - d / 2, w: d, h: d },
      });
    }
    setBoxes(next);
  }, [controls, joystick]);

  const move = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
    if (drag.id.startsWith("btn:")) {
      const id = drag.id.slice(4),
        b = controls.buttons?.[id] ?? { dx: 0, dy: 0 };
      onChange({
        ...controls,
        buttons: { ...controls.buttons, [id]: { dx: b.dx + dx, dy: b.dy + dy } },
      });
      return;
    }
    const key = drag.id as ControlId,
      c = controls[key];
    onChange({ ...controls, [key]: { ...c, dx: c.dx + dx, dy: c.dy + dy } });
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
      {boxes.map(({ id, label, box: b }) => (
        <div
          key={id}
          className={"ki-control-handle" + (drag?.id === id ? " is-dragging" : "")}
          style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
          onPointerDown={(e) => {
            e.currentTarget.parentElement?.setPointerCapture(e.pointerId);
            setDrag({ id, x: e.clientX, y: e.clientY });
          }}
        >
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
