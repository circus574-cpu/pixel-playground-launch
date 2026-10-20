import { TEST_RACE_SWITCH_ENABLED } from "../../game/features";
import { GameMessage } from "./GameMessage";
import { useGameMessage, type MessageEvent } from "./useGameMessage";
import {
  readUiPreferences,
  writeUiPreferences,
  type UiPreferences,
} from "../../game/uiPreferences";
import { BrandMark } from "./BrandMark";
import { WORLDS } from "../../game/world/worlds";
import { RACES } from "../../game/world/races";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { clampZoom, DEFAULT_ZOOM } from "../../game/view";
import type { GameViewState } from "../../game/mountGame";
import "./game-hud.css";
import "./anime-hud.css";
import { ABILITIES, xpNeeded, type Ability, type Command } from "../../game/session";
import { Inventory, QuestJournal, NpcDialogue } from "./AdventurePanels";
import "./adventure.css";
import "./game-messages.css";

type Props = {
  state: GameViewState;
  error: string | null;
  zoom: number;
  onZoom: (zoom: number) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  onCommand: (command: Command) => void;
  onCharacters?: () => void;
  onRaceChange?: () => void;
  onWorldLabels?: (visible: boolean) => void;
  systemNotice?: MessageEvent;
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
  zoom,
  onZoom,
  fullscreen,
  onFullscreen,
  onCommand,
  onCharacters,
  onRaceChange,
  onWorldLabels,
  systemNotice,
}: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [tab, setTab] = useState("System");
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const messageLog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messageLog.current) messageLog.current.scrollTop = messageLog.current.scrollHeight;
  }, [state.noticeId, tab, chatOpen, messages]);
  const [preferences, setPreferences] = useState(readUiPreferences);
  const [hiddenSaveWarning, setHiddenSaveWarning] = useState("");
  const scope = panel ? "panel:" + panel : state.dialogue ? "npc:" + state.dialogue : "world";
  const gameMessage = useGameMessage(
    { id: state.noticeId, text: state.notice },
    scope,
    preferences.messages && !state.player.dead && state.notice !== state.saveWarning,
  );
  const systemMessage = useGameMessage(systemNotice ?? { id: 0, text: "" }, scope);
  const currentMessage = systemMessage.message ? systemMessage : gameMessage;
  const hasWarning = Boolean(
    state.saveWarning && hiddenSaveWarning !== state.saveWarning && panel !== "settings",
  );
  const feedback = (
    <>
      {hasWarning && (
        <GameMessage
          text={state.saveWarning}
          warning
          onDismiss={() => setHiddenSaveWarning(state.saveWarning)}
        />
      )}
      {currentMessage.message?.scope === scope && (
        <GameMessage text={currentMessage.message.text} onDismiss={currentMessage.dismiss} />
      )}
    </>
  );
  function changePreference(key: keyof UiPreferences, value: boolean) {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      return next;
    });
  }
  useEffect(() => {
    writeUiPreferences(preferences);
  }, [preferences]);
  useEffect(() => {
    onWorldLabels?.(preferences.worldLabels);
  }, [preferences.worldLabels, onWorldLabels]);
  useEffect(() => {
    if (state.dialogue) setChatOpen(false);
  }, [state.dialogue]);
  const world = WORLDS[state.player.continent];
  const npcs = world.npcs;
  const x = Math.max(0, Math.min(100, (state.x / world.width) * 100));
  const y = Math.max(0, Math.min(100, (state.y / world.height) * 100));
  function toggle(next: Panel) {
    setChatOpen(false);
    if (state.dialogue) onCommand({ type: "dialogue", action: "close" });
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
        setChatOpen(false);
        if (
          document.activeElement instanceof HTMLElement &&
          document.activeElement.closest(".ki-chat")
        )
          document.activeElement.blur();
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
            aria-valuenow={Math.ceil(player.hp)}
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
            aria-valuenow={Math.floor(player.ki)}
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
      <section
        className={`ki-map ki-frame ${preferences.largeMinimap ? "ki-map-large" : ""}`}
        aria-label="Minimapa"
      >
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
            onClick={() => changePreference("largeMinimap", !preferences.largeMinimap)}
            aria-label={preferences.largeMinimap ? "Zmniejsz minimapę" : "Powiększ minimapę"}
          >
            {preferences.largeMinimap ? "−" : "+"}
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
        <BrandMark compact />
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
          <div ref={messageLog} className="ki-messages" role="log" aria-live="polite">
            {tab === "System" && (
              <>
                <p>
                  <b>[System]</b> Witaj w Ki Legends!
                </p>
                <p>
                  <b>[System]</b> Odkryto: {world.settlement}.
                </p>
                {state.log.slice(-6).map((entry, index) => (
                  <p key={index}>{entry}</p>
                ))}
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
            {p === "settings" && state.saveWarning && (
              <span className="ki-save-indicator" aria-label="Problem z zapisem">
                !
              </span>
            )}
          </button>
        ))}
      </nav>
      {!panel && state.dialogue && (
        <NpcDialogue
          state={state}
          send={onCommand}
          feedback={<div className="ki-inline-messages">{feedback}</div>}
        />
      )}
      {!panel && !state.dialogue && !chatOpen && (
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
      {!panel && !state.dialogue && (
        <div className="ki-notification-rail" aria-label="Powiadomienia gry">
          {feedback}
        </div>
      )}
      {player.dead && (
        <div className="ki-death-overlay" role="status">
          Zostałeś pokonany · odrodzenie za chwilę
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
            <div className="ki-inline-messages">{feedback}</div>
            {panel === "inventory" && <Inventory state={state} send={onCommand} />}
            {panel === "journal" && (
              <QuestJournal state={state} send={onCommand} close={closeAndResume} />
            )}
            {panel === "settings" && (
              <div className="ki-settings">
                {TEST_RACE_SWITCH_ENABLED && onRaceChange && (
                  <div>
                    <button className="ki-fullscreen-setting ki-race-switch" onClick={onRaceChange}>
                      Zmiana rasy
                    </button>
                    <p className="ki-race-switch-note">
                      Opcja testowa. Wybierz inne pochodzenie; obecna postać pozostanie zapisana.
                    </p>
                  </div>
                )}
                {onCharacters && (
                  <button className="ki-fullscreen-setting" onClick={onCharacters}>
                    Zapisz i wybierz postać
                  </button>
                )}
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
                  <span>Komunikaty w grze</span>
                  <input
                    type="checkbox"
                    checked={preferences.messages}
                    onChange={(e) => changePreference("messages", e.target.checked)}
                  />
                </label>
                <label>
                  <span>Nazwy postaci w pobliżu</span>
                  <input
                    type="checkbox"
                    checked={preferences.worldLabels}
                    onChange={(e) => changePreference("worldLabels", e.target.checked)}
                  />
                </label>
                <label>
                  <span>Duża minimapa</span>
                  <input
                    type="checkbox"
                    checked={preferences.largeMinimap}
                    onChange={(e) => changePreference("largeMinimap", e.target.checked)}
                  />
                </label>
                {state.saveWarning && (
                  <p role="alert" className="ki-settings-save-warning">
                    {state.saveWarning}
                  </p>
                )}
                <details className="ki-controls-guide">
                  <summary>Sterowanie i pomoc</summary>
                  <p>
                    Kliknij ziemię, aby iść, postać, aby porozmawiać, lub przeciwnika, aby walczyć.
                    Na telefonie przeciągnij palcem po wolnym obszarze w lewym dolnym rogu.
                  </p>
                  <p>
                    WASD / strzałki — ruch · E — rozmowa · 1–4 — umiejętności · Q — mikstura · F —
                    łup · Escape — zamknij okno lub anuluj działanie. Cele i wskazówki znajdziesz w
                    Dzienniku. Ostatnie zdarzenia są w czacie System.
                  </p>
                </details>
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
