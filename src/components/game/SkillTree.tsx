import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDot,
  Flame,
  GitBranch,
  LockKeyhole,
  Shield,
  Sparkles,
  Swords,
  Target,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { RACES, RACE_IDS, type RaceId } from "../../game/world/races";
import { WORLDS } from "../../game/world/worlds";
import {
  BRANCHES,
  NODES,
  ROLES,
  TREES,
  skillId,
  type SkillNode,
} from "../../game/progression/catalog";
import {
  availablePoints,
  learnReason,
  newProgression,
  raceStats,
} from "../../game/progression/model";
import type { Command, GameViewState } from "../../game/session";
import "./skill-tree.css";

const labels = {
  root: "Zdolność startowa",
  active: "Aktywna",
  passive: "Pasywna",
  choice: "Wybór",
  ultimate: "Ostateczna",
  form: "Tryb KI",
};
const tiers = [[1], [2, 3], [4], [5, 6], [7, 8], [9]];
const RaceIcon = ({ race }: { race: RaceId }) =>
  race === "planetary" ? (
    <Wind />
  ) : race === "sage" ? (
    <Sparkles />
  ) : race === "android" ? (
    <Target />
  ) : (
    <Flame />
  );
export function SkillGlyph({ node }: { node: SkillNode }) {
  return node.kind === "form" ? (
    <Zap />
  ) : node.kind === "ultimate" ? (
    <Sparkles />
  ) : node.kind === "passive" ? (
    <CircleDot />
  ) : node.code.startsWith("B") ? (
    <Shield />
  ) : node.code.startsWith("C") ? (
    <Zap />
  ) : (
    <Swords />
  );
}
export function SkillTree({
  state,
  send,
  onClose,
}: {
  state: GameViewState;
  send: (c: Command) => void;
  onClose: () => void;
}) {
  const [race, setRace] = useState<RaceId>(state.player.race);
  const [selected, setSelected] = useState(skillId(state.player.race, "A1"));
  const [branch, setBranch] = useState(0);
  const [tab, setTab] = useState<"tree" | "growth">("tree");
  const [level, setLevel] = useState(Math.min(20, state.player.level));
  const [reset, setReset] = useState(false);
  const container = useRef<HTMLElement>(null),
    back = useRef<HTMLButtonElement>(null);
  const detail = useRef<HTMLElement>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const previousFocus = useRef<Element | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement;
    back.current?.focus();
    return () => {
      if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus();
    };
  }, []);
  const own = race === state.player.race;
  const progress = own ? (state.player.progression ?? newProgression(race)) : newProgression(race);
  const node = NODES[selected] ?? TREES[race][1]!;
  const learned = progress.learned.includes(node.id);
  const blocked = state.inCombat || Boolean(state.progression?.blocked) || state.player.dead;
  const reason = !own
    ? "Podgląd innej rasy"
    : !state.player.progression
      ? "Najpierw włącz rozwój rasy"
      : blocked
        ? "Zmiany dostępne poza walką"
        : learnReason(race, state.player.level, progress, node.id);
  const growth = raceStats(race, level);
  function changeRace(next: RaceId) {
    setRace(next);
    setSelected(skillId(next, "A1"));
    setBranch(0);
    setReset(false);
  }
  function keydown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const controls = [
      ...(container.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, select, [tabindex="0"]',
      ) ?? []),
    ].filter((el) => el.getClientRects().length > 0);
    const first = controls[0],
      last = controls.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
  function card(n: SkillNode) {
    const known = progress.learned.includes(n.id),
      excluded = Boolean(n.excludes && progress.learned.includes(n.excludes));
    const available =
      own &&
      Boolean(state.player.progression) &&
      !learnReason(race, state.player.level, progress, n.id);
    return (
      <button
        key={n.id}
        type="button"
        className={`ki-tree-node ${known ? "is-known" : available ? "is-available" : "is-locked"} ${selected === n.id ? "is-selected" : ""} ${excluded ? "is-excluded" : ""}`}
        aria-label={`${n.name} · ${known ? "poznana" : excluded ? "wykluczona" : `poziom ${n.level}`}`}
        aria-pressed={selected === n.id}
        onClick={(event) => {
          selectedButton.current = event.currentTarget;
          setSelected(n.id);
          if (window.innerWidth <= 760)
            requestAnimationFrame(() =>
              detail.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
            );
        }}
      >
        <span className="ki-tree-glyph">
          <SkillGlyph node={n} />
          {known ? (
            <Check className="ki-node-status" />
          ) : excluded ? (
            <X className="ki-node-status" />
          ) : !available ? (
            <LockKeyhole className="ki-node-status" />
          ) : null}
        </span>
        <span className="ki-tree-node-name">{n.name}</span>
        <small>{labels[n.kind]}</small>
      </button>
    );
  }
  return (
    <section
      ref={container}
      className={`ki-skill-screen ki-race-${race}`}
      role="dialog"
      aria-modal="true"
      aria-label="Rozwój postaci"
      style={{ "--skill-accent": RACES[race].color } as CSSProperties}
      onKeyDown={keydown}
    >
      <header className="ki-skill-header">
        <button
          ref={back}
          type="button"
          className="ki-skill-back"
          onClick={onClose}
          aria-label="Wróć do gry"
        >
          <ArrowLeft />
          <span>Do gry</span>
        </button>
        <div className="ki-skill-heading">
          <span>ŚCIEŻKA TWOJEJ POSTACI</span>
          <h1>Rozwój i umiejętności</h1>
        </div>
        <div className="ki-skill-points">
          <GitBranch />
          <strong>
            {state.player.progression
              ? availablePoints(state.player.level, state.player.progression)
              : Math.min(20, state.player.level) - 1}
          </strong>
          <span>
            wolnych
            <br />
            punktów
          </span>
        </div>
      </header>
      <div className="ki-skill-layout">
        <div className="ki-tree-main">
          <nav className="ki-race-tabs" aria-label="Drzewka czterech ras">
            {RACE_IDS.map((r) => (
              <button key={r} type="button" aria-pressed={race === r} onClick={() => changeRace(r)}>
                <RaceIcon race={r} />
                <span>{RACES[r].name}</span>
                {r === state.player.race && <small>Twoja rasa</small>}
              </button>
            ))}
          </nav>
          <div className="ki-tree-intro">
            <div>
              <span className="ki-tree-eyebrow">
                {WORLDS[RACES[race].world].name} <ChevronRight />{" "}
                {own ? `Poziom ${state.player.level}` : "Podgląd rasy"}
              </span>
              <h2>{RACES[race].name}</h2>
              <p>{ROLES[race]}</p>
            </div>
            <div className="ki-tree-view-tabs" role="tablist" aria-label="Widok rozwoju">
              <button role="tab" aria-selected={tab === "tree"} onClick={() => setTab("tree")}>
                Drzewko
              </button>
              <button role="tab" aria-selected={tab === "growth"} onClick={() => setTab("growth")}>
                Statystyki
              </button>
            </div>
          </div>
          {own && !state.player.progression && (
            <div className="ki-tree-activation">
              <Sparkles />
              <div>
                <strong>Otwórz nową ścieżkę rozwoju</strong>
                <p>
                  Statystyki rasy i punkty za poziomy 1–20. Postęp, przedmioty i zadania pozostają.
                  Zapis otrzyma kopię odzyskiwania.
                </p>
              </div>
              <button disabled={blocked} onClick={() => send({ type: "activate-progression" })}>
                Włącz rozwój rasy
              </button>
            </div>
          )}
          {!own && (
            <p className="ki-tree-preview-note">
              Oglądasz inną rasę. Wybór kart nie zmienia Twojej postaci ani zapisu.
            </p>
          )}
          {tab === "tree" ? (
            <>
              <div className="ki-tree-root">
                {card(TREES[race][0]!)}
                <p>
                  Wspólny początek trzech ścieżek.
                  <br />
                  <span>Wybieraj swobodnie między gałęziami.</span>
                </p>
              </div>
              <nav className="ki-branch-tabs" aria-label="Gałęzie drzewka">
                {BRANCHES[race].map((name, i) => (
                  <button key={name} aria-pressed={branch === i} onClick={() => setBranch(i)}>
                    {name}
                  </button>
                ))}
              </nav>
              <div className="ki-tree-branches">
                {BRANCHES[race].map((name, i) => {
                  const b = ["A", "B", "C"][i]!;
                  return (
                    <section
                      className={`ki-tree-branch ${branch === i ? "is-mobile-active" : ""}`}
                      key={b}
                      aria-label={name}
                    >
                      <header>
                        <span>0{i + 1}</span>
                        <h3>{name}</h3>
                        <small>{["Pierwsza ścieżka", "Druga ścieżka", "Trzecia ścieżka"][i]}</small>
                      </header>
                      {tiers.map((group, index) => (
                        <div
                          className={`ki-tree-tier ${group.length === 2 ? "is-pair" : ""} ${index === 4 ? "is-choice" : ""}`}
                          key={index}
                        >
                          <span className="ki-tier-level">{[2, 4, 7, 10, 13, 16][index]}</span>
                          {index === 4 && <span className="ki-choice-label">WYBIERZ JEDNO</span>}
                          {group.map((n) => card(NODES[skillId(race, b + n)]!))}
                        </div>
                      ))}
                    </section>
                  );
                })}
              </div>
              <div className="ki-tree-form">
                {card(TREES[race].at(-1)!)}
                <div>
                  <strong>Przebudzenie KI</strong>
                  <p>
                    Poziom 20 i dowolna zdolność ostateczna.
                    <br />
                    Forma ma osobny przycisk na pasku.
                  </p>
                </div>
              </div>
              <div className="ki-tree-legend">
                <span>
                  <i className="known" />
                  Poznana
                </span>
                <span>
                  <i className="available" />
                  Do nauczenia
                </span>
                <span>
                  <LockKeyhole />
                  Zablokowana
                </span>
                <span>Każdy węzeł: 1 punkt</span>
              </div>
            </>
          ) : (
            <div className="ki-growth-panel">
              <div className="ki-growth-level">
                <div>
                  <small>POZIOM POSTACI</small>
                  <strong>{level.toString().padStart(2, "0")}</strong>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                  aria-label="Poziom podglądu statystyk"
                />
                <span>1—20</span>
              </div>
              <div className="ki-growth-stats">
                {[
                  ["Życie", growth.maxHp, "HP"],
                  ["Energia Ki", growth.maxKi, "KI"],
                  ["Atak", growth.attack, ""],
                  ["Obrona", growth.defense, ""],
                  ["Szybkość", growth.speed, "j./s"],
                  ["Regeneracja Ki", growth.kiRegen.toFixed(2), "/s"],
                  ["Szansa krytyku", growth.crit.toFixed(2), "%"],
                  ["Odstęp ataków", growth.interval, "ms"],
                ].map(([label, value, unit]) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>
                      {value}
                      <small>{unit}</small>
                    </strong>
                  </article>
                ))}
              </div>
              <p>
                Wartości bazowe rasy bez wyposażenia, pasywek i tymczasowych efektów. Podgląd nie
                przyznaje poziomów ani XP.
              </p>
              <div className="ki-growth-milestones">
                <h3>Twój rytm rozwoju</h3>
                {[
                  [1, "Zdolność startowa"],
                  [2, "Pierwsze aktywne zdolności"],
                  [4, "Pierwsze pasywki"],
                  [7, "Drugi poziom zdolności"],
                  [10, "Wzmocnienia gałęzi"],
                  [13, "Wybory specjalizacji"],
                  [16, "Zdolności ostateczne"],
                  [20, "Tryb KI"],
                ].map(([n, label]) => (
                  <div key={n}>
                    <strong>{n}</strong>
                    <span>{label}</span>
                    <small>
                      {Number(n) <= state.player.level && own
                        ? "Osiągnięty próg"
                        : "Próg odblokowania"}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <aside ref={detail} className="ki-skill-detail" aria-label="Szczegóły umiejętności">
          <button
            type="button"
            className="ki-detail-mobile-back"
            onClick={() =>
              selectedButton.current?.scrollIntoView({ block: "center", behavior: "smooth" })
            }
          >
            <ArrowLeft /> Wróć do drzewka
          </button>
          <div className="ki-detail-symbol">
            <SkillGlyph node={node} />
          </div>
          <span className="ki-tree-eyebrow">
            {labels[node.kind]} · {node.code}
          </span>
          <h2>{node.name}</h2>
          <div className="ki-skill-tags">
            <span>POZIOM {node.level}</span>
            <span>1 PUNKT</span>
            {learned && (
              <span className="known">
                <Check />
                POZNANA
              </span>
            )}
          </div>
          <p className="ki-skill-description">{node.description}</p>
          {node.cooldown > 0 && (
            <dl className="ki-skill-costs">
              <div>
                <dt>Koszt bazowy</dt>
                <dd>{node.cost} Ki</dd>
              </div>
              <div>
                <dt>Odnowienie bazowe</dt>
                <dd>{node.cooldown / 1000} s</dd>
              </div>
            </dl>
          )}
          {node.requires.length > 0 && (
            <div className="ki-skill-requires">
              <small>WYMAGA JEDNEGO Z</small>
              {node.requires.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSelected(id);
                    const parentBranch = ["A", "B", "C"].indexOf(NODES[id]!.code[0]!);
                    if (parentBranch >= 0) setBranch(parentBranch);
                  }}
                >
                  <span>{progress.learned.includes(id) ? <Check /> : <LockKeyhole />}</span>
                  {NODES[id]!.name}
                  <ChevronRight />
                </button>
              ))}
            </div>
          )}
          {node.excludes && (
            <p className="ki-exclusion-note">
              Wybór wyklucza: <strong>{NODES[node.excludes]!.name}</strong>
            </p>
          )}
          <div className="ki-detail-action">
            {learned ? (
              <div className="ki-skill-learned">
                <Check />
                Umiejętność poznana
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="ki-learn-button"
                  disabled={Boolean(reason)}
                  onClick={() => send({ type: "learn-skill", id: node.id })}
                >
                  Naucz się{" "}
                  <span>
                    1 punkt <ChevronRight />
                  </span>
                </button>
                <p role="status">{reason || "Punkt zostanie wydany po kliknięciu."}</p>
              </>
            )}
          </div>
          <p className="ki-tree-feedback" role="status" aria-live="polite">
            {state.notice}
          </p>
          {own && state.player.progression && (
            <div className="ki-loadout-editor">
              <h3>Twój zestaw bojowy</h3>
              <p>Cztery wybrane zdolności, także ostateczne. Zmieniaj poza walką.</p>
              {[0, 1, 2, 3].map((slot) => (
                <label key={slot}>
                  <span>{slot + 1}</span>
                  <select
                    aria-label={`Umiejętność na miejscu ${slot + 1}`}
                    value={progress.loadout[slot] ?? ""}
                    disabled={blocked}
                    onChange={(e) => {
                      if (e.target.value) send({ type: "equip-skill", id: e.target.value, slot });
                    }}
                  >
                    <option value="" disabled>
                      Wybierz zdolność
                    </option>
                    {progress.learned
                      .map((id) => NODES[id]!)
                      .filter((n) => n.kind === "ultimate" || n.kind === "active")
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
              {!reset ? (
                <button
                  type="button"
                  className="ki-reset-link"
                  disabled={blocked}
                  onClick={() => setReset(true)}
                >
                  Zresetuj punkty
                </button>
              ) : (
                <div className="ki-reset-confirm">
                  <p>
                    Oddać wydane punkty? Reset jest bezpłatny w tej wersji. HP, Ki i odnowienia
                    pozostają.
                  </p>
                  <button
                    disabled={blocked}
                    onClick={() => {
                      send({ type: "reset-skills" });
                      setReset(false);
                    }}
                  >
                    Potwierdź reset
                  </button>
                  <button onClick={() => setReset(false)}>Anuluj</button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
