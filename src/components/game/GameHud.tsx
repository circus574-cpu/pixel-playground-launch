import { WORLDS } from "../../game/world/worlds";
import { RACES } from "../../game/world/races";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { clampZoom, DEFAULT_ZOOM } from "../../game/view";
import type { GameViewState } from "../../game/mountGame";
import "./game-hud.css";
import "./anime-hud.css";
import { ABILITIES, xpNeeded, type Ability, type Command } from "../../game/session";
import { Inventory, QuestJournal, NpcDialogue } from "./AdventurePanels";
import "./adventure.css";

type Props = {
  state: GameViewState;
  error: string | null;
  zoom: number;
  onZoom: (zoom: number) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  onCommand: (command: Command) => void;
  onCharacters?: () => void;
};
type Panel = "inventory" | "journal" | "settings" | "map" | null;
const iconNames = [
  "Portret",
  "Impuls KI",
  "Cięcie płomienia",
  "Tarcza ducha",
  "Mikstura życia",
  "Ekwipunek",
  "Dziennik",
  "Ustawienia",
  "Walka",
];
function Icon({ index, className = "" }: { index: number; className?: string }) {
  const style: CSSProperties = {
    backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`,
  };
  return <span aria-hidden="true" className={`ki-icon ${className}`} style={style} />;
}

export function GameHud({
  state,
  error,
  zoom,
  onZoom,
  fullscreen,
  onFullscreen,
  onCommand,
  onCharacters,
}: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [tab, setTab] = useState("System");
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [hints, setHints] = useState(true);
  const [notice, setNotice] = useState("");
  const [mapSize, setMapSize] = useState(false);
  const world = WORLDS[state.player.continent];
  const npcs = world.npcs;
  const x = Math.max(0, Math.min(100, (state.x / world.width) * 100));
  const y = Math.max(0, Math.min(100, (state.y / world.height) * 100));
  function toggle(next: Panel) {
    setPanel((p) => (p === next ? null : next));
  }
  const player = state.player;
  useEffect(() => {
    onCommand({ type: "pause", value: panel !== null });
    return () => onCommand({ type: "pause", value: false });
  }, [panel, onCommand]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanel(null);
        onCommand({ type: "dialogue", action: "close" });
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onCommand]);
  function closeAndResume() {
    setPanel(null);
    onCommand({ type: "pause", value: false });
  }
  const tracked = state.quests.find((q) => q.status !== "done");
  return (
    <div className="ki-hud">
      <section className="ki-player ki-frame" aria-label="Postać gracza">
        <div className="ki-portrait">
          <Icon index={0} />
          <span className="ki-level">{player.level}</span>
        </div>
        <div className="ki-player-info">
          <div className="ki-player-name">
            Wędrowiec <span>{RACES[player.race].name.toUpperCase()}</span>
          </div>
          <div
            className="ki-meter ki-hp"
            role="meter"
            aria-label="Zdrowie"
            aria-valuenow={Math.round(player.hp)}
            aria-valuemin={0}
            aria-valuemax={state.stats.maxHp}
          >
            <i style={{ width: (player.hp / state.stats.maxHp) * 100 + "%" }} />
            <span>
              {Math.ceil(player.hp)} / {state.stats.maxHp}
            </span>
          </div>
          <div
            className="ki-meter ki-energy"
            role="meter"
            aria-label="Energia KI"
            aria-valuenow={Math.round(player.ki)}
            aria-valuemin={0}
            aria-valuemax={state.stats.maxKi}
          >
            <i style={{ width: (player.ki / state.stats.maxKi) * 100 + "%" }} />
            <span>
              {Math.floor(player.ki)} / {state.stats.maxKi}
            </span>
          </div>
          <div
            className="ki-xp"
            aria-label={"Doświadczenie " + player.xp + "/" + xpNeeded(player.level)}
          >
            <i style={{ width: (player.xp / xpNeeded(player.level)) * 100 + "%" }} />
          </div>
        </div>
      </section>
      {state.target && (
        <section className="ki-target ki-frame" aria-label="Wybrany przeciwnik">
          <span>
            {state.target.inRange ? "BESTIA · ATAK W ZASIĘGU" : "BESTIA · PODEJDŹ BLIŻEJ"}
          </span>
          <strong>{state.target.name}</strong>
          <div className="ki-meter ki-hp">
            <i style={{ width: `${(state.target.hp / state.target.maxHp) * 100}%` }} />
            <span>
              {state.target.hp} / {state.target.maxHp}
            </span>
          </div>
        </section>
      )}
      <section className={`ki-map ki-frame ${mapSize ? "ki-map-large" : ""}`} aria-label="Minimapa">
        <div className="ki-map-title">
          <span className="ki-dot" />
          {world.settlement}
        </div>
        <button
          className="ki-map-image"
          aria-label="Otwórz mapę świata"
          onClick={() => toggle("map")}
        >
          <img src={world.minimap} alt={"Mapa: " + world.settlement} />
          {world.landmarks.map((l) => (
            <span
              key={l.label}
              className={"ki-landmark ki-landmark-" + l.kind}
              title={l.label}
              style={{
                left: `${(l.x / world.width) * 100}%`,
                top: `${(l.y / world.height) * 100}%`,
              }}
            >
              ◆
            </span>
          ))}
          <span className="ki-map-marker" style={{ left: `${x}%`, top: `${y}%` }} />
        </button>
        <div className="ki-map-footer">
          <span>{world.name.toUpperCase()}</span>
          <button
            onClick={() => setMapSize((v) => !v)}
            aria-label={mapSize ? "Zmniejsz minimapę" : "Powiększ minimapę"}
          >
            {mapSize ? "−" : "+"}
          </button>
        </div>
      </section>
      <button className="ki-quest" onClick={() => toggle("journal")}>
        <span className="ki-quest-diamond">◆</span>
        <div>
          <strong>
            {tracked?.name ?? (world.id === "verdant" ? "Wioska ocalona" : "Region ocalony")}
          </strong>
          <span>{tracked?.text ?? "Trenuj i zdobywaj wyposażenie"}</span>
        </div>
        <span className="ki-quest-arrow">›</span>
      </button>
      <div className="ki-location">
        <span>KI LEGENDS</span>
        <strong>{world.settlement}</strong>
        <i />
        {world.name}
      </div>
      <section
        className={`ki-chat ki-frame ${chatOpen ? "ki-chat-open" : ""}`}
        aria-label="Czat lokalny"
      >
        <button
          className="ki-chat-toggle"
          onClick={() => setChatOpen((v) => !v)}
          aria-expanded={chatOpen}
        >
          Czat lokalny <span>{chatOpen ? "−" : "+"}</span>
        </button>
        <div className="ki-chat-content">
          <div className="ki-chat-tabs" role="tablist" aria-label="Kanały czatu">
            {["Ogólny", "System", "Walka", "Gildia"].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="ki-messages" role="log" aria-live="polite">
            {tab === "System" && (
              <>
                <p>
                  <b>[System]</b> Witaj w Ki Legends!
                </p>
                <p>
                  <b>[System]</b> Odkryto: {world.settlement}.
                </p>
                <p className="ki-chat-muted">Twoja podróż zaczyna się tutaj.</p>
              </>
            )}
            {tab === "Walka" && (
              <p>
                <b>[Walka]</b> {state.log.slice(-3).join(" · ")}
              </p>
            )}
            {tab === "Gildia" && <p className="ki-chat-muted">Nie należysz jeszcze do gildii.</p>}
            {tab === "Ogólny" &&
              (messages.length ? (
                messages.map((m, i) => (
                  <p key={i}>
                    <b>[Ty]</b> {m}
                  </p>
                ))
              ) : (
                <p className="ki-chat-muted">Rozmowa lokalna na tym urządzeniu.</p>
              ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) {
                setMessages((m) => [...m.slice(-19), draft.trim().slice(0, 240)]);
                setDraft("");
                setTab("Ogólny");
              }
            }}
          >
            <input
              maxLength={240}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Napisz wiadomość lokalną…"
              aria-label="Wiadomość lokalna"
            />
            <button aria-label="Dodaj wiadomość lokalną">↵</button>
          </form>
        </div>
      </section>
      <nav className="ki-actionbar ki-frame" aria-label="Umiejętności">
        <div className="ki-action-crest">KI</div>
        {(["flame", "pulse", "shield", "attack", "potion"] as Ability[]).map((id) => {
          const spec = ABILITIES[id];
          const remaining =
            player.cooldowns[id] > 0 ? (player.cooldowns[id] / 1000).toFixed(1) : "";
          const disabled =
            !state.ready ||
            player.dead ||
            Boolean(state.dialogue) ||
            panel !== null ||
            player.cooldowns[id] > 0 ||
            player.ki < spec.cost ||
            (id === "potion" && (!player.items.potion || player.hp >= state.stats.maxHp));
          return (
            <button
              className="ki-skill"
              key={id}
              title={
                spec.name + " · " + spec.cost + " KI · " + spec.cooldown / 1000 + " s odnowienia"
              }
              aria-label={spec.name}
              disabled={disabled}
              onClick={(event) => {
                onCommand({ type: "ability", ability: id });
                event.currentTarget.blur();
              }}
            >
              <Icon index={spec.icon} />
              <kbd>{spec.key}</kbd>
              {remaining && <span className="ki-cooldown">{remaining}</span>}
              {id === "potion" && <span className="ki-item-count">{player.items.potion}</span>}
              {id === "attack" && state.autoAttack && <span className="ki-auto">AUTO</span>}
            </button>
          );
        })}
        <div className="ki-bar-decoration">◆</div>
      </nav>
      <nav className="ki-view-controls ki-frame" aria-label="Widok mapy">
        <button
          onClick={() => onZoom(clampZoom(zoom - 0.08))}
          disabled={zoom <= 0.35}
          aria-label="Oddal mapę"
          title="Oddal mapę"
        >
          −
        </button>
        <button
          className="ki-zoom-value"
          onClick={() => onZoom(DEFAULT_ZOOM)}
          aria-label="Przywróć oddalenie mapy"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => onZoom(clampZoom(zoom + 0.08))}
          disabled={zoom >= 1}
          aria-label="Przybliż mapę"
          title="Przybliż mapę"
        >
          +
        </button>
        <button
          onClick={onFullscreen}
          aria-label={fullscreen ? "Opuść pełny ekran" : "Pełny ekran"}
          title="Pełny ekran"
        >
          ⛶
        </button>
      </nav>
      <nav className="ki-menu" aria-label="Menu gry">
        {(
          [
            { p: "inventory", n: 5 },
            { p: "journal", n: 6 },
            { p: "settings", n: 7 },
          ] as const
        ).map(({ p, n }) => (
          <button
            key={p}
            className={`ki-menu-button ki-frame ${panel === p ? "active" : ""}`}
            title={iconNames[n]}
            aria-label={iconNames[n]}
            onClick={() => toggle(p)}
          >
            <Icon index={n} />
          </button>
        ))}
      </nav>
      {hints && (
        <div className="ki-help">
          <span>WASD</span> ruch <b>·</b> kliknij ziemię lub przeciwnika <b>·</b> <span>ESC</span>{" "}
          anuluj
        </div>
      )}
      {state.dialogue && <NpcDialogue state={state} send={onCommand} />}
      {!panel && !state.dialogue && (
        <div className="ki-context-actions">
          {player.quests.steps === "active" && (
            <button
              onClick={(event) => {
                onCommand({ type: "move", ...world.market });
                event.currentTarget.blur();
              }}
            >
              {world.market.action}
            </button>
          )}
          <button
            onClick={(event) => {
              onCommand({ type: "interact", npc: state.nearestNpc });
              event.currentTarget.blur();
            }}
          >
            Rozmowa · {npcs.find((n) => n.id === state.nearestNpc)?.name} <kbd>E</kbd>
          </button>
          {state.nearbyLoot[0] && (
            <button onClick={() => onCommand({ type: "loot", id: state.nearbyLoot[0]!.id })}>
              Podnieś łup <kbd>F</kbd>
            </button>
          )}
        </div>
      )}
      {state.saveWarning && (
        <p className="ki-save-warning" role="alert">
          {state.saveWarning}
        </p>
      )}
      {state.notice && (
        <p className="ki-game-feedback ki-frame" role="status">
          {state.notice}
        </p>
      )}
      {player.dead && (
        <div className="ki-death-overlay" role="status">
          Zostałeś pokonany · odrodzenie za chwilę
        </div>
      )}
      {notice && (
        <button className="ki-notice ki-frame" onClick={() => setNotice("")}>
          {notice} <span>×</span>
        </button>
      )}
      {(!state.ready || error) && (
        <div className="ki-loading">
          <div className="ki-frame">
            <span className="ki-loading-rune">◆</span>
            <h1>KI LEGENDS</h1>
            <p>{error || "Wkraczasz do: " + world.settlement + "…"}</p>
          </div>
        </div>
      )}
      {panel && (
        <div className="ki-modal-backdrop" onClick={() => setPanel(null)}>
          <section
            className="ki-modal ki-frame"
            role="dialog"
            aria-modal="true"
            aria-label={
              {
                inventory: "Ekwipunek",
                journal: "Dziennik",
                settings: "Ustawienia",
                map: "Mapa regionu",
              }[panel]
            }
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPanel(null);
            }}
          >
            <header>
              <h2>
                {
                  {
                    inventory: "Ekwipunek",
                    journal: "Dziennik podróży",
                    settings: "Ustawienia",
                    map: world.settlement,
                  }[panel]
                }
              </h2>
              <button autoFocus onClick={() => setPanel(null)} aria-label="Zamknij okno">
                ×
              </button>
            </header>
            {panel === "inventory" && <Inventory state={state} send={onCommand} />}
            {panel === "journal" && (
              <QuestJournal state={state} send={onCommand} close={closeAndResume} />
            )}
            {panel === "settings" && (
              <div className="ki-settings">
                {onCharacters && <button onClick={onCharacters}>Zapisz i wybierz postać</button>}
                <p>
                  Pochodzenie: {RACES[player.race].name} · tymczasowy ludzki sprite. Lokalna gra
                  PvE.
                </p>
                <label>
                  <span>Oddalenie mapy · {Math.round(zoom * 100)}%</span>
                  <input
                    aria-label="Oddalenie mapy"
                    type="range"
                    min={0.35}
                    max={1}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => onZoom(Number(e.target.value))}
                  />
                </label>
                <button className="ki-fullscreen-setting" onClick={onFullscreen}>
                  {fullscreen ? "Opuść pełny ekran" : "Pełny ekran"}
                </button>
                <label>
                  <span>Podpowiedzi sterowania</span>
                  <input
                    type="checkbox"
                    checked={hints}
                    onChange={(e) => setHints(e.target.checked)}
                  />
                </label>
                <label>
                  <span>Duża minimapa</span>
                  <input
                    type="checkbox"
                    checked={mapSize}
                    onChange={(e) => setMapSize(e.target.checked)}
                  />
                </label>
              </div>
            )}
            {panel === "map" && (
              <>
                <div className="ki-npc-links">
                  {npcs.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        closeAndResume();
                        onCommand({ type: "interact", npc: n.id });
                      }}
                    >
                      Idź do {n.name} · {n.role}
                    </button>
                  ))}
                </div>
                <div className="ki-full-map">
                  <img src={world.minimap} alt={"Mapa: " + world.settlement} />
                  <span className="ki-map-marker" style={{ left: `${x}%`, top: `${y}%` }} />
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
