/**
 * Skill tree drawn as a real tree (owner 11.11.2026: "pięknie rozrysowane"): the starting skill on
 * top, three branches that split and join exactly as the annex requires (two passives side by
 * side, the either-or choice marked "albo"), the KI mode at the bottom. Every node is labelled,
 * learnable nodes carry their own "+" and the description card opens right beside the chosen node,
 * not under the board. Ranks have no cap (owner 03.11.2026 and 11.11.2026).
 */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BRANCH_NAMES, KIT_NODES, canLearn } from "../../game/kit";
import { nodeDescription, rankBasePercent } from "../../game/kit/nodePresentation";
import type { KitNodeData } from "../../game/kit/types";
import type { GameViewState } from "../../game/session";
import type { SendCommand } from "./AdventurePanels";
import { BRANCH_MOTTO, NODE_LORE, skillFacts } from "./skillTreeLore";
import "./skill-tree.css";

type Branch = "A" | "B" | "C";
const BRANCHES: readonly Branch[] = ["A", "B", "C"];

const TYPE_LABEL: Record<string, string> = {
  starting: "Zdolność startowa",
  active: "Aktywna",
  passive: "Pasywna",
  choice: "Wybór — albo, albo",
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

/** Column (0 left, 1 middle, 2 right) and row of each node inside its branch. */
const SLOT: Record<string, [number, number]> = {
  "1": [1, 1],
  "2": [0, 2],
  "3": [2, 2],
  "4": [1, 3],
  "5": [0, 4],
  "6": [2, 4],
  "7": [0, 5],
  "8": [2, 5],
  "9": [1, 6],
};

type Pos = { x: number; y: number };

function GraphicSkillTreeImpl({ state, send }: { state: GameViewState; send: SendCommand }) {
  const p = state.player;
  const nodes = KIT_NODES[p.race];
  const names = BRANCH_NAMES[p.race];
  const lore = NODE_LORE[p.race];
  const motto = BRANCH_MOTTO[p.race];
  const learned = useMemo(() => new Set(p.skills), [p.skills]);
  const rankOf = (id: string) => p.skills.filter((s) => s === id).length;
  const byId = (id: string) => nodes.find((n) => n.id === id);

  const boardRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(720);
  const [compact, setCompact] = useState(false);
  const [focus, setFocus] = useState<Branch>("A");
  const [selected, setSelected] = useState<string>("R");

  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth || 720);
      setCompact(typeof window !== "undefined" && window.innerHeight < 560);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Whole tree when there is room for nine columns; one branch at a time on a narrow screen.
  const wide = width >= 560;
  const shown: readonly Branch[] = wide ? BRANCHES : [focus];
  const cols = shown.length * 3;
  const colW = width / cols;
  const node = compact ? 46 : 54;
  const row = compact ? 82 : 96;
  const top = node / 2 + 10;
  const head = compact ? 44 : 54;
  const yOf = (r: number) => (r === 0 ? top : top + node / 2 + head + (r - 0.5) * row);
  const tRow = yOf(6) + row + 6;
  const height = tRow + node / 2 + 40;

  const pos = useMemo(() => {
    const out: Record<string, Pos> = { R: { x: width / 2, y: top }, T: { x: width / 2, y: tRow } };
    shown.forEach((b, bi) => {
      for (const n of nodes) {
        if (!n.id.startsWith(b)) continue;
        const slot = SLOT[n.id.slice(1)];
        if (!slot) continue;
        out[n.id] = { x: (bi * 3 + slot[0] + 0.5) * colW, y: yOf(slot[1]) };
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, shown.join(""), width, colW, compact]);

  const status = (n: KitNodeData) => {
    if (learned.has(n.id)) return "is-learned";
    if (n.excludes && learned.has(n.excludes)) return "is-blocked";
    return canLearn(p.race, p.level, p.skills, n.id).ok ? "is-ready" : "is-locked";
  };

  const edges: { from: string; to: string; cls: string }[] = [];
  for (const n of nodes) {
    if (!pos[n.id]) continue;
    for (const r of n.requires) {
      if (!pos[r]) continue;
      const on = learned.has(r) && learned.has(n.id);
      const open = learned.has(r) && !learned.has(n.id) && status(n) === "is-ready";
      edges.push({ from: r, to: n.id, cls: on ? "is-on" : open ? "is-open" : "is-off" });
    }
  }
  const curve = (a: Pos, b: Pos) => {
    const mid = (a.y + b.y) / 2;
    return `M${a.x},${a.y} C${a.x},${mid} ${b.x},${mid} ${b.x},${b.y}`;
  };

  const learn = (id: string) => send({ type: "learn", node: id });

  // Reset to root when the chosen node leaves the view (branch switch on a narrow screen).
  useEffect(() => {
    if (selected && !pos[selected]) setSelected("R");
  }, [pos, selected]);
  useEffect(() => {
    cardRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const orb = (n: KitNodeData) => {
    const at = pos[n.id]!;
    const st = status(n);
    const rank = rankOf(n.id);
    const check = canLearn(p.race, p.level, p.skills, n.id);
    const levelLock = !learned.has(n.id) && p.level < n.minLevel;
    return (
      <div
        key={n.id}
        className={"ki-st-slot " + st + " is-" + n.type + (selected === n.id ? " is-selected" : "")}
        style={{ left: at.x, top: at.y - node / 2, width: Math.max(64, colW - 4) }}
      >
        <button
          className="ki-st-node"
          data-id={n.id}
          style={{ width: node, height: node }}
          onClick={(e) => {
            e.stopPropagation();
            setSelected(n.id);
          }}
          aria-label={n.name + " — " + TYPE_LABEL[n.type]}
          aria-pressed={selected === n.id}
          aria-expanded={selected === n.id}
        >
          <span className="ki-st-glyph" aria-hidden>
            {GLYPH[n.type] ?? "◆"}
          </span>
          {rank > 0 && n.id !== "R" && <span className="ki-st-rank">{rank}</span>}
        </button>
        {check.ok && (n.id !== "R" || !learned.has("R")) && (
          <button
            className="ki-st-plus"
            onClick={(e) => {
              e.stopPropagation();
              learn(n.id);
            }}
            title={learned.has(n.id) ? "Zwiększ rangę do " + (rank + 1) : "Poznaj"}
            aria-label={(learned.has(n.id) ? "Zwiększ rangę: " : "Poznaj: ") + n.name}
          >
            +
          </button>
        )}
        <span className="ki-st-name">{n.name}</span>
        {levelLock && <span className="ki-st-lvl">poz. {n.minLevel}</span>}
      </div>
    );
  };

  const card = () => {
    if (!selected) return null;
    const n = byId(selected);
    const at = pos[selected];
    if (!n || !at) return null;
    const st = status(n);
    const rank = rankOf(n.id);
    const have = learned.has(n.id);
    const check = canLearn(p.race, p.level, p.skills, n.id);
    const description = nodeDescription(p.race, n.id, p.skills);
    const facts = skillFacts(description);
    const cw = Math.min(300, width - 16);
    const gap = node / 2 + 12;
    let left: number;
    let topPx: number | undefined = Math.max(4, at.y - node / 2 - 6);
    let bottom: number | undefined;
    if (at.x + gap + cw <= width) left = at.x + gap;
    else if (at.x - gap - cw >= 0) left = at.x - gap - cw;
    else {
      left = Math.min(Math.max(8, at.x - cw / 2), width - cw - 8);
      topPx = at.y + node / 2 + 30;
    }
    if (topPx !== undefined && topPx > height * 0.55 && at.y > height * 0.55) {
      bottom = Math.max(4, height - at.y - node / 2 - 6);
      topPx = undefined;
    }
    const branch = n.id[0] as Branch;
    const reqNames = n.requires.map((r) => byId(r)?.name ?? r);
    const excl = n.excludes ? byId(n.excludes)?.name : undefined;
    return (
      <article
        ref={cardRef}
        className={"ki-st-card ki-gst-card " + st + " is-" + n.type}
        role="dialog"
        aria-label={n.name}
      >
        <header>
          <span className="ki-st-card-glyph" aria-hidden>
            {GLYPH[n.type] ?? "◆"}
          </span>
          <div>
            <strong>{n.name}</strong>
            <small>
              {TYPE_LABEL[n.type]}
              {n.id !== "R" && n.id !== "T" ? " · " + names[branch] : ""} · poziom {n.minLevel}
            </small>
          </div>
        </header>
        {lore[n.id] && <p className="ki-st-lore">„{lore[n.id]}”</p>}
        <section className="ki-st-action">
          <h4>Działanie</h4>
          {facts.length > 0 && (
            <ul className="ki-st-facts">
              {facts.map((f) => (
                <li key={f.kind + f.label} className={"is-" + f.kind}>
                  <span aria-hidden>{f.icon}</span> {f.label}
                </li>
              ))}
            </ul>
          )}
          <p>{description}</p>
        </section>
        {n.id !== "R" && (
          <p className="ki-st-rankline">
            {have ? (
              <>
                Ranga <b>{rank}</b> · premia <b>{rankBasePercent(rank)}%</b> wartości pierwszego
                punktu → po dodaniu <b>{rankBasePercent(rank + 1)}%</b>
              </>
            ) : (
              <>
                Pierwszy punkt daje premię opisaną powyżej. Każdy kolejny dodaje 10% jej początkowej
                wartości.
              </>
            )}
            <small>
              Koszt punktu: 1. Bez limitu rang. Wykluczenia i stałe mechaniki pozostają takie same.
            </small>
          </p>
        )}
        {(reqNames.length > 0 || excl) && (
          <p className="ki-st-req">
            {reqNames.length > 0 && (
              <>
                Wymaga: <b>{reqNames.join(" lub ")}</b>
              </>
            )}
            {excl && (
              <span className="ki-st-excl">
                Wybór wyklucza: <b>{excl}</b>
              </span>
            )}
          </p>
        )}
        {have && n.id === "R" ? (
          <span className="ki-st-known">✓ Poznane</span>
        ) : (
          <button className="ki-st-learn" disabled={!check.ok} onClick={() => learn(n.id)}>
            {check.ok
              ? have
                ? "＋ Zwiększ rangę do " + (rank + 1) + " · 1 punkt"
                : "＋ Poznaj · 1 punkt"
              : check.reason}
          </button>
        )}
      </article>
    );
  };

  const visible = nodes.filter((n) => pos[n.id]);

  return (
    <div className="ki-st ki-gst" data-race={p.race}>
      <div className="ki-st-bar ki-gst-points">
        <span className="ki-st-points">
          Punkty <b>{state.skillPoints}</b>
        </span>
        <span>
          Poziom <b>{p.level}</b>
        </span>
        <span>
          Wydane <b>{p.skills.length}</b>
        </span>
        <span className="ki-st-legend" aria-hidden>
          <i className="is-active">⚡ aktywna</i>
          <i className="is-passive">◈ pasywna</i>
          <i className="is-choice">⚖ wybór</i>
          <i className="is-ultimate">✹ ostateczna</i>
        </span>
        <button
          className="ki-st-respec"
          onClick={() => send({ type: "respec" })}
          disabled={p.skills.length <= 1 || p.gold < state.respecCost}
        >
          Resetuj · {state.respecCost === 0 ? "pierwszy raz za darmo" : state.respecCost + " monet"}
        </button>
      </div>
      {!wide && (
        <div className="ki-st-tabs" role="tablist">
          {BRANCHES.map((b) => (
            <button
              key={b}
              role="tab"
              aria-selected={focus === b}
              className={focus === b ? "is-on" : ""}
              onClick={() => setFocus(b)}
            >
              {names[b]}
            </button>
          ))}
        </div>
      )}
      <div className="ki-st-layout">
        <div
          ref={boardRef}
          className={"ki-st-board ki-gst-board" + (compact ? " is-compact" : "")}
          style={{ height, ["--n" as string]: node + "px" }}
        >
          <svg className="ki-st-links" width={width} height={height} aria-hidden>
            {edges.map((e) => (
              <path
                key={e.from + e.to}
                className={"ki-st-link " + e.cls}
                d={curve(pos[e.from]!, pos[e.to]!)}
              />
            ))}
            {shown.map((b) => {
              const a = pos[b + "7"];
              const c = pos[b + "8"];
              if (!a || !c) return null;
              return (
                <line
                  key={b + "x"}
                  className="ki-st-either"
                  x1={a.x + node / 2 + 4}
                  y1={a.y}
                  x2={c.x - node / 2 - 4}
                  y2={c.y}
                />
              );
            })}
          </svg>
          {shown.map((b, bi) => (
            <header
              key={b}
              className="ki-st-head"
              style={{
                left: bi * 3 * colW,
                width: 3 * colW,
                top: top + node / 2 + 8,
                height: head,
              }}
            >
              <strong>{names[b]}</strong>
              <small>{motto[b]}</small>
            </header>
          ))}
          {shown.map((b) => {
            const a = pos[b + "7"];
            const c = pos[b + "8"];
            if (!a || !c) return null;
            return (
              <span
                key={b + "albo"}
                className="ki-st-albo"
                style={{ left: (a.x + c.x) / 2, top: a.y }}
                title="Można wybrać tylko jeden z tych dwóch węzłów"
              >
                albo
              </span>
            );
          })}
          {visible.map(orb)}
        </div>
        {card()}
      </div>
    </div>
  );
}

/**
 * Faza 2 (memo HUD): drzewko zużywa tylko rasę, poziom, złoto, punkty, koszt respec i listę
 * umiejętności. HUD odświeża się 10×/s, ale te pola zmieniają się rzadko — bez memo 29 węzłów
 * i ścieżki SVG przerysowywały się przy każdym tyknięciu. Komparator pomija re-render, dopóki
 * któryś z tych pól (lub stabilne `send`) się nie zmieni.
 */
export const GraphicSkillTree = memo(
  GraphicSkillTreeImpl,
  (a, b) =>
    a.send === b.send &&
    a.state.player.race === b.state.player.race &&
    a.state.player.level === b.state.player.level &&
    a.state.player.gold === b.state.player.gold &&
    a.state.skillPoints === b.state.skillPoints &&
    a.state.respecCost === b.state.respecCost &&
    a.state.player.skills.join(",") === b.state.player.skills.join(","),
);
