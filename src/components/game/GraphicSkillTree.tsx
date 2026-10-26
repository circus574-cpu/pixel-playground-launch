/**
 * Skill tree drawn as a tree (preview switch ?ki-world-v2=1): the starting skill on top, three
 * branches of round nodes joined by lines, the KI mode at the bottom, one detail card for the
 * selected node. Learning and respec use the same commands as the list view.
 */
import { useState } from "react";
import { BRANCH_NAMES, KIT_NODES, canLearn } from "../../game/kit";
import type { GameViewState } from "../../game/session";
import type { SendCommand } from "./AdventurePanels";

const TYPE_LABEL: Record<string, string> = {
  starting: "Zdolność startowa",
  active: "Aktywna",
  passive: "Pasywna",
  choice: "Wybór",
  ultimate: "Ostateczna",
  "ki-mode": "Tryb KI",
};
const GLYPH: Record<string, string> = {
  starting: "✦",
  active: "⚡",
  passive: "◈",
  choice: "⚖",
  ultimate: "✹",
  "ki-mode": "☯",
};

export function GraphicSkillTree({ state, send }: { state: GameViewState; send: SendCommand }) {
  const p = state.player;
  const nodes = KIT_NODES[p.race];
  const names = BRANCH_NAMES[p.race];
  const learned = new Set(p.skills);
  const [selected, setSelected] = useState("R");
  const sel = nodes.find((n) => n.id === selected) ?? nodes[0]!;
  const check = canLearn(p.race, p.level, p.skills, sel.id);
  const status = (id: string) => {
    const n = nodes.find((x) => x.id === id)!;
    if (learned.has(id)) return "is-learned";
    if (n.excludes && learned.has(n.excludes)) return "is-blocked";
    return canLearn(p.race, p.level, p.skills, id).ok ? "is-ready" : "is-locked";
  };
  const orb = (id: string) => {
    const n = nodes.find((x) => x.id === id)!;
    return (
      <button
        key={id}
        className={"ki-gst-node " + status(id) + (id === selected ? " is-selected" : "")}
        onClick={() => setSelected(id)}
        aria-label={n.name + " — " + TYPE_LABEL[n.type]}
        aria-pressed={id === selected}
      >
        <span className="ki-gst-glyph" aria-hidden>
          {GLYPH[n.type] ?? "◆"}
        </span>
        <span className="ki-gst-id">{id}</span>
      </button>
    );
  };
  return (
    <div className="ki-gst">
      <div className="ki-gst-points">
        <span>
          Punkty <b>{state.skillPoints}</b>
        </span>
        <span>
          Poziom <b>{p.level}</b>
        </span>
      </div>
      <div className="ki-gst-board">
        <div className="ki-gst-root">{orb("R")}</div>
        <div className="ki-gst-branches">
          {(["A", "B", "C"] as const).map((b) => (
            <section key={b} className="ki-gst-branch" aria-label={"Gałąź " + names[b]}>
              <h3>{names[b]}</h3>
              <div className="ki-gst-column">
                {nodes.filter((n) => n.id.startsWith(b)).map((n) => orb(n.id))}
              </div>
            </section>
          ))}
        </div>
        <div className="ki-gst-root ki-gst-mode">{orb("T")}</div>
      </div>
      <article className={"ki-gst-card " + status(sel.id)}>
        <header>
          <span className="ki-gst-glyph" aria-hidden>
            {GLYPH[sel.type] ?? "◆"}
          </span>
          <div>
            <strong>{sel.name}</strong>
            <small>
              {TYPE_LABEL[sel.type]} · poziom {sel.minLevel}
            </small>
          </div>
        </header>
        <p>{sel.text}</p>
        {learned.has(sel.id) ? (
          <span className="ki-gst-learned">Poznane</span>
        ) : (
          <button
            disabled={!check.ok}
            onClick={() => send({ type: "learn", node: sel.id })}
            className="ki-gst-learn"
          >
            {check.ok ? "Poznaj · 1 punkt" : check.reason}
          </button>
        )}
      </article>
      <button
        className="ki-gst-respec"
        onClick={() => send({ type: "respec" })}
        disabled={p.skills.length <= 1 || p.gold < state.respecCost}
      >
        Resetuj drzewko ·{" "}
        {state.respecCost === 0 ? "pierwszy raz za darmo" : state.respecCost + " monet"}
      </button>
    </div>
  );
}
