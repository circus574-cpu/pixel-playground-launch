import { CombatQuestSummary } from "./CombatQuestSummary";
import { CombatAction } from "./CombatAction";
import { uiTextureUrl } from "../../game/assets/catalog";
import { isCityStage } from "../../game/city/types";
import { TEST_RACE_SWITCH_ENABLED } from "../../game/features";
import { GameMessage } from "./GameMessage";
import { useGameMessage, type MessageEvent } from "./useGameMessage";
import {
  readUiPreferences,
  writeUiPreferences,
  type UiPreferences,
} from "../../game/uiPreferences";
import { MangaIcon, type MangaSymbol } from "./MangaIcon";
import originArt from "../../game/world/origin-art.json";
import { DiabloInventory } from "./DiabloInventory";
import { GraphicSkillTree } from "./GraphicSkillTree";
import { V2Minimap } from "./V2Minimap";
import { WORLD_V2 } from "../../game/world/generated/worldVersion";
import { BrandMark } from "./BrandMark";
import { WORLDS } from "../../game/world/worlds";
import { RACES } from "../../game/world/races";
import { minimapPercent, OPEN_WORLDS } from "../../game/world/zoneMap";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { clampZoom, DEFAULT_ZOOM } from "../../game/view";
import type { GameViewState } from "../../game/mountGame";
import "./game-hud.css";
import "./anime-hud.css";
import { POTION, xpNeeded, type Command } from "../../game/session";
import { Inventory, QuestJournal, NpcDialogue, SkillTree } from "./AdventurePanels";
import { CityDirectory, DepotPanel } from "./CityPanels";
import "./city.css";
import { LocalMinimap } from "./LocalMinimap";
import { music, trackFor } from "../../game/music";
import { StaffTools } from "./StaffTools";
import "./staff-tools.css";
import "./adventure.css";
import "./game-messages.css";
import "./hud-layout.css";
import "./manga-hud.css";

type Props = {
  /** Continents a special staff character can travel to directly. */
  staffDestinations?: { id: string; name: string }[] | undefined;
  onStaffTravel?: ((id: string) => void) | undefined;
  planetLocation?: string | undefined;
  onPlanetTravel?: ((id: string) => void) | undefined;
  worldOverride?: import("../../game/world/types").WorldDefinition | undefined;
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
type Panel = "inventory" | "journal" | "skills" | "settings" | "map" | "planet" | null;
/** Planet atlas (2D map + 3D globe) loads only when opened from the world map. */
const PlanetAtlas = lazy(() =>
  import("../planet-map/MapaView").then((m) => ({ default: m.MapaView })),
);
const iconNames = [
  "Portret",
  "Impuls KI",
  "Cięcie płomienia",
  "Tarcza ducha",
  "Mikstura życia",
  "Ekwipunek",
  "Dziennik",
  "Ustawienia",
  "Umiejętności",
];
const POTION_COOLDOWN = POTION.cooldown;
const STATUS_NAMES: Record<string, string> = {
  slow: "Spowolnienie",
  root: "Unieruchomienie",
  stun: "Ogłuszenie",
  fear: "Strach",
  silence: "Uciszenie",
  blind: "Oślepienie",
  fog: "Mgła",
  jam: "Zakłócenia",
  mark: "Znak",
  armor: "Obrona w dół",
  weaken: "Osłabienie",
  poison: "Trucizna",
  burn: "Podpalenie",
  bleed: "Krwawienie",
};
/** Ranged races keep an energy symbol for their actual basic attack. */
const abilitySymbol = (id: string, race: string): MangaSymbol =>
  id === "R"
    ? race === "sage" || race === "android"
      ? "energy"
      : "attack"
    : id === "T"
      ? "skills"
      : id.startsWith("A")
        ? "slash"
        : id.startsWith("B")
          ? "shield"
          : "energy";
const symbols: MangaSymbol[] = [
  "attack",
  "energy",
  "slash",
  "shield",
  "potion",
  "inventory",
  "journal",
  "settings",
  "skills",
];
function Icon({ index }: { index: number }) {
  return <MangaIcon symbol={symbols[index] ?? "energy"} />;
}

/** Each page contains complete controls; no half-visible skill at the edge of a scroller. */
function TechniqueBank({
  abilities,
  renderAbility,
}: {
  abilities: GameViewState["abilities"];
  renderAbility: (a: GameViewState["abilities"][number]) => ReactNode;
}) {
  const [requestedPage, setPage] = useState(0);
  if (!abilities.length) return null;
  const pages = Math.ceil(abilities.length / 2);
  const page = Math.min(requestedPage, pages - 1);
  return (
    <div className="ki-secondary-skills" role="group" aria-label="Poznane techniki">
      <div className="ki-technique-page">
        {abilities.slice(page * 2, page * 2 + 2).map(renderAbility)}
      </div>
      {pages > 1 && (
        <nav className="ki-technique-pagination" aria-label="Strony technik">
          <button
            aria-label="Poprzednie techniki"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            ‹
          </button>
          <span aria-live="polite">
            {page + 1} / {pages}
          </span>
          <button
            aria-label="Następne techniki"
            disabled={page === pages - 1}
            onClick={() => setPage(page + 1)}
          >
            ›
          </button>
        </nav>
      )}
    </div>
  );
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
  worldOverride,
  planetLocation,
  onPlanetTravel,
  staffDestinations,
  onStaffTravel,
}: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [tab, setTab] = useState("System");
  const [chatOpen, setChatOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const tools = useRef<HTMLDivElement>(null);
  const toolsToggle = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const messageLog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messageLog.current) messageLog.current.scrollTop = messageLog.current.scrollHeight;
  }, [state.noticeId, tab, chatOpen, messages]);
  const [preferences, setPreferences] = useState(readUiPreferences);
  const [hiddenSaveWarning, setHiddenSaveWarning] = useState("");
  const scope = panel
    ? "panel:" + panel
    : state.depotOpen
      ? "depot"
      : state.dialogue
        ? "npc:" + state.dialogue
        : "world";
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
  function changePreference(key: Exclude<keyof UiPreferences, "musicVolume">, value: boolean) {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      return next;
    });
  }
  useEffect(() => {
    writeUiPreferences(preferences);
    music.setVolume(preferences.musicVolume, preferences.musicMuted);
  }, [preferences]);
  // The continent's own theme while playing; the loading theme elsewhere (index.tsx).
  useEffect(() => {
    music.play(trackFor(state.player.continent));
  }, [state.player.continent]);
  useEffect(() => {
    onWorldLabels?.(preferences.worldLabels);
  }, [preferences.worldLabels, onWorldLabels]);
  useEffect(() => {
    if (state.dialogue || state.depotOpen) {
      setChatOpen(false);
      setToolsOpen(false);
    }
  }, [state.dialogue, state.depotOpen]);
  useEffect(() => {
    if (!toolsOpen) return;
    const dismiss = (event: PointerEvent) => {
      const node = event.target;
      if (
        node instanceof Node &&
        !tools.current?.contains(node) &&
        !toolsToggle.current?.contains(node)
      )
        setToolsOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [toolsOpen]);
  const world = worldOverride ?? WORLDS[state.player.continent];
  const npcs = world.npcs;
  const nearbyNpc = state.activeNpcs.find(
    (n) => n.id === state.nearestNpc && Math.hypot(n.x - state.x, n.y - state.y) <= 180,
  );
  const { left: x, top: y } = minimapPercent(
    worldOverride ? "" : world.id,
    state.building?.door ?? state,
    world,
  );
  function toggle(next: Panel) {
    setToolsOpen(false);
    setChatOpen(false);
    if (state.dialogue) onCommand({ type: "dialogue", action: "close" });
    if (state.depotOpen) onCommand({ type: "storage-close" });
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
        setToolsOpen(false);
        setChatOpen(false);
        if (
          document.activeElement instanceof HTMLElement &&
          document.activeElement.closest(".ki-chat, .ki-tools, .ki-tools-toggle")
        )
          document.activeElement.blur();
        setPanel(null);
        onCommand({ type: "dialogue", action: "close" });
        onCommand({ type: "storage-close" });
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onCommand]);
  function closeAndResume() {
    setPanel(null);
    onCommand({ type: "pause", value: false });
  }
  const tracked = state.quests.find(
    (q) => q.status !== "done" && (!isCityStage(world) || q.id !== "boars"),
  );
  const renderAbility = (a: GameViewState["abilities"][number]) => {
    const blocked =
      !state.ready ||
      player.dead ||
      Boolean(state.dialogue) ||
      state.depotOpen ||
      panel !== null ||
      state.locked ||
      a.remaining > 0 ||
      (a.id !== "R" && player.ki < a.ki) ||
      (a.id !== "R" && state.statuses.some((s) => s.id === "silence")) ||
      state.statuses.some((s) => s.id === "stun" || s.id === "fear");
    const remaining = a.remaining > 0 && a.id !== "R" ? (a.remaining / 1000).toFixed(1) : "";
    return (
      <CombatAction
        className="ki-skill"
        data-ability={a.id}
        key={a.id}
        title={
          a.name + (a.id === "R" ? "" : " · " + a.ki + " KI · " + a.cd / 1000 + " s odnowienia")
        }
        aria-label={a.name}
        disabled={blocked}
        onActivate={() => onCommand({ type: "ability", ability: a.id })}
      >
        <MangaIcon symbol={abilitySymbol(a.id, player.race)} />
        <kbd>{a.id === "R" ? "␣" : a.key}</kbd>
        {a.id !== "R" && <span className="ki-ability-cost">{a.ki} KI</span>}
        {remaining && <span className="ki-cooldown">{remaining}</span>}
        {a.id === "R" && state.autoAttack && <span className="ki-auto">AUTO</span>}
      </CombatAction>
    );
  };
  return (
    <div
      className="ki-hud"
      style={{ "--ki-ui-image": `url("${uiTextureUrl()}")` } as CSSProperties}
    >
      <section className="ki-player ki-frame" aria-label="Postać gracza">
        <div className="ki-portrait" data-race={player.race}>
          <span className="ki-portrait-art">
            <img
              src={originArt[player.race].card}
              alt={"Portret: " + RACES[player.race].name}
              width={480}
              height={580}
            />
          </span>
          <span className="ki-level">{player.level}</span>
        </div>
        <div className="ki-player-info">
          <div className="ki-player-name">
            {state.player.name ?? "Wędrowiec"} <span>{RACES[player.race].name.toUpperCase()}</span>
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
          {state.resource && (
            <div
              className="ki-resource"
              role="meter"
              aria-label={state.resource.label}
              aria-valuenow={state.resource.value}
              aria-valuemin={0}
              aria-valuemax={state.resource.max}
              data-state={state.resource.state}
              data-kind={state.resource.label}
            >
              <i style={{ width: (state.resource.value / state.resource.max) * 100 + "%" }} />
              <span>
                {state.resource.label} {state.resource.value}
                {state.resource.state === "overheat" ? " · PRZEGRZANIE" : ""}
              </span>
            </div>
          )}
          {(state.statuses.length > 0 || state.buffs.length > 0 || state.shieldPoints > 0) && (
            <div className="ki-status-strip" aria-label="Efekty">
              {state.shieldPoints > 0 && (
                <span className="ki-status-chip is-buff">Tarcza {state.shieldPoints}</span>
              )}
              {state.buffs
                .filter((b) => !b.id.startsWith("fx-") && b.id !== "dodge")
                .map((b) => (
                  <span key={b.id} className="ki-status-chip is-buff">
                    {b.id} · {(b.ms / 1000).toFixed(0)} s
                  </span>
                ))}
              {state.statuses.map((s) => (
                <span key={s.id + (s.stacks ?? "")} className="ki-status-chip">
                  {STATUS_NAMES[s.id] ?? s.id}
                  {s.stacks && s.stacks > 1 ? " ×" + s.stacks : ""} · {(s.ms / 1000).toFixed(0)} s
                </span>
              ))}
            </div>
          )}
        </div>
      </section>
      {state.fog > 0 && (
        <div className="ki-fog" aria-hidden="true" style={{ opacity: Math.min(0.9, state.fog) }} />
      )}
      <div className="ki-status-stack">
        {state.target && (
          <section className="ki-target ki-frame" aria-label="Wybrany przeciwnik">
            <span>
              {state.target.inRange ? "BESTIA · ATAK W ZASIĘGU" : "BESTIA · PODEJDŹ BLIŻEJ"}
            </span>
            <strong>
              {state.target.name} · poz. {state.target.level}
            </strong>
            <div className="ki-meter ki-hp">
              <i style={{ width: `${(state.target.hp / state.target.maxHp) * 100}%` }} />
              <span>
                {state.target.hp} / {state.target.maxHp}
              </span>
            </div>
          </section>
        )}
        {!panel && !state.dialogue && !state.depotOpen && (
          <div className="ki-notification-rail" aria-label="Powiadomienia gry">
            {feedback}
          </div>
        )}
      </div>
      {state.staff && onStaffTravel && (
        <StaffTools
          state={state}
          send={onCommand}
          continents={staffDestinations ?? []}
          current={planetLocation}
          onTravel={onStaffTravel}
        />
      )}
      <section
        className={`ki-map ki-frame ${preferences.largeMinimap ? "ki-map-large" : ""}`}
        aria-label="Minimapa"
      >
        <div className="ki-map-title" title={world.settlement}>
          <span className="ki-dot" />
          {world.settlement}
        </div>
        <button
          className="ki-map-image"
          aria-label="Otwórz mapę świata"
          onClick={() => toggle(WORLD_V2 ? "planet" : "map")}
        >
          {WORLD_V2 && !state.building ? (
            <V2Minimap land={state.player.continent} at={{ x: state.x, y: state.y }} />
          ) : (
            <LocalMinimap
              world={world}
              at={state.building?.door ?? { x: state.x, y: state.y }}
              inside={!!state.building}
            />
          )}
          {state.minimapJammed && <span className="ki-map-jam">ZAKŁÓCENIA</span>}
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
        {WORLD_V2 && !tracked ? (
          // Starter quests come first; Argon's adventures show once they are done.
          <CombatQuestSummary continent={player.continent} />
        ) : (
          <div>
            <strong>
              {tracked?.name ?? (world.id === "verdant" ? "Wioska ocalona" : "Region ocalony")}
            </strong>
            <span>{tracked?.text ?? "Trenuj i zdobywaj wyposażenie"}</span>
          </div>
        )}
        <span className="ki-quest-arrow">›</span>
      </button>
      <div className="ki-location">
        <BrandMark compact />
        <strong>
          {state.building?.name ?? (WORLD_V2 && !state.inCity ? "Dzikie ziemie" : world.settlement)}
        </strong>
        <i />
        {world.name}
      </div>
      <section
        className={`ki-chat ki-frame ${chatOpen ? "ki-chat-open" : ""}`}
        aria-label="Czat lokalny"
      >
        <button
          className="ki-chat-toggle"
          aria-label="Czat lokalny"
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
        <TechniqueBank
          abilities={state.abilities.filter((a) => a.id !== "R")}
          renderAbility={renderAbility}
        />
        {state.abilities.filter((a) => a.id === "R").map(renderAbility)}
        <button
          className="ki-skill"
          data-ability="potion"
          key="potion"
          title={"Mikstura życia · " + POTION_COOLDOWN / 1000 + " s odnowienia"}
          aria-label="Mikstura życia"
          disabled={
            !state.ready ||
            player.dead ||
            Boolean(state.dialogue) ||
            state.depotOpen ||
            panel !== null ||
            state.potion.remaining > 0 ||
            !player.items.potion ||
            player.hp >= state.stats.maxHp
          }
          onClick={(event) => {
            onCommand({ type: "ability", ability: "potion" });
            event.currentTarget.blur();
          }}
        >
          <Icon index={4} />
          <kbd>Q</kbd>
          {state.potion.remaining > 0 && (
            <span className="ki-cooldown">{(state.potion.remaining / 1000).toFixed(1)}</span>
          )}
          <span className="ki-item-count">{player.items.potion}</span>
        </button>
        <div className="ki-bar-decoration">◆</div>
      </nav>
      <button
        ref={toolsToggle}
        className="ki-tools-toggle ki-frame"
        aria-label="Menu gry"
        aria-expanded={toolsOpen}
        aria-controls="ki-tools"
        onClick={(event) => {
          if (!toolsOpen) onCommand({ type: "cancel" });
          setToolsOpen((v) => !v);
          setChatOpen(false);
          event.currentTarget.blur();
        }}
      >
        {toolsOpen ? <span aria-hidden="true">×</span> : <MangaIcon symbol="map" />}
        <small>Widok</small>
      </button>
      <div ref={tools} id="ki-tools" className={`ki-tools ${toolsOpen ? "is-open" : ""}`}>
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
        <button
          className="ki-menu-chat ki-menu-button ki-frame"
          aria-label="Czat lokalny"
          onClick={() => {
            setToolsOpen(false);
            setChatOpen(true);
          }}
        >
          <MangaIcon symbol="chat" />
          <small>Czat lokalny</small>
        </button>
      </div>
      <nav className="ki-menu" aria-label="Menu gry">
        {(
          [
            { p: "inventory", n: 5 },
            { p: "journal", n: 6 },
            { p: "skills", n: 8 },
            { p: "settings", n: 7 },
          ] as const
        ).map(({ p, n }) => (
          <button
            key={p}
            className={`ki-menu-button ki-frame ${panel === p ? "active" : ""}`}
            title={iconNames[n]}
            aria-label={iconNames[n]}
            aria-pressed={panel === p}
            onClick={() => toggle(p)}
            style={{ position: "relative" }}
          >
            <Icon index={n} />
            <span className="ki-menu-label">{p === "journal" ? "Zadania" : iconNames[n]}</span>
            {p === "skills" && state.skillPoints > 0 && (
              <span className="ki-badge" aria-label={state.skillPoints + " punktów umiejętności"}>
                {state.skillPoints}
              </span>
            )}
          </button>
        ))}
      </nav>
      {state.saveWarning && (
        <span className="ki-save-indicator ki-save-status" aria-label="Problem z zapisem">
          !
        </span>
      )}
      {!panel && state.dialogue && (
        <NpcDialogue
          worldOverride={worldOverride}
          state={state}
          send={onCommand}
          feedback={<div className="ki-inline-messages">{feedback}</div>}
        />
      )}
      {!panel && state.depotOpen && (
        <DepotPanel
          state={state}
          send={onCommand}
          feedback={<div className="ki-inline-messages">{feedback}</div>}
        />
      )}
      {!panel && !state.dialogue && !state.depotOpen && state.building && (
        <aside className="ki-city-state" aria-label="Wnętrze budynku">
          <strong>{state.building.name}</strong>
          <small>{state.building.district}</small>
          {player.interior === "arena" && (
            <>
              <span>
                Trafienia: {state.training.hits} · Obrażenia: {state.training.damage}
              </span>
              <small>Trening bez nagród · rzeczywiste KI i odnowienia</small>
              <button
                onClick={() =>
                  onCommand({ type: "training", action: state.training.active ? "reset" : "start" })
                }
              >
                {state.training.active ? "Wyzeruj trening" : "Rozpocznij trening"}
              </button>
            </>
          )}
          <button onClick={() => onCommand({ type: "exit" })}>Wyjdź do miasta</button>
        </aside>
      )}
      {!panel && !state.dialogue && !state.depotOpen && !chatOpen && !toolsOpen && !player.dead && (
        <div className="ki-context-actions">
          {world.city && !player.interior && (!WORLD_V2 || state.inCity) && (
            <button onClick={() => toggle(WORLD_V2 ? "planet" : "map")}>Plan miasta</button>
          )}
          {state.nearbyBuilding && (
            <button
              onClick={() => onCommand({ type: "enter", building: state.nearbyBuilding!.id })}
            >
              Wejdź · {state.nearbyBuilding.name}
            </button>
          )}
          {player.interior === "depot" && (
            <button onClick={() => onCommand({ type: "chest" })}>Otwórz swoją skrzynię</button>
          )}
          {player.quests.steps === "active" && !state.target && !player.interior && (
            <button
              onClick={(event) => {
                onCommand({ type: "move", ...world.market });
                event.currentTarget.blur();
              }}
            >
              {world.market.action}
            </button>
          )}
          {nearbyNpc && !state.target && (
            <button
              onClick={(event) => {
                onCommand({ type: "interact", npc: nearbyNpc.id });
                event.currentTarget.blur();
              }}
            >
              Rozmowa · {nearbyNpc.name} <kbd>E</kbd>
            </button>
          )}
          {state.nearbyLoot[0] && (
            <button onClick={() => onCommand({ type: "loot", id: state.nearbyLoot[0]!.id })}>
              Podnieś łup <kbd>F</kbd>
            </button>
          )}
        </div>
      )}

      {player.dead && (
        <div className="ki-death-overlay" role="status">
          Zostałeś pokonany · odrodzenie za chwilę
        </div>
      )}
      {panel === "planet" && (
        <div
          className="ki-planet-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Mapa planety"
        >
          <Suspense
            fallback={
              <div className="ki-planet-loading" role="status">
                Wczytywanie mapy planety…
              </div>
            }
          >
            <PlanetAtlas
              current={planetLocation ?? state.player.continent}
              onTravel={onPlanetTravel}
              onClose={() => (WORLD_V2 ? closeAndResume() : setPanel("map"))}
            />
          </Suspense>
        </div>
      )}
      {panel && panel !== "planet" && (
        <div className="ki-modal-backdrop" onClick={() => setPanel(null)}>
          <section
            className="ki-modal ki-frame"
            role="dialog"
            aria-modal="true"
            aria-label={
              {
                inventory: "Ekwipunek",
                journal: "Dziennik",
                skills: "Umiejętności",
                settings: "Ustawienia",
                map: "Mapa regionu",
              }[panel as Exclude<Panel, "planet" | null>]
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
                    skills: "Drzewko umiejętności · " + RACES[player.race].name,
                    settings: "Ustawienia",
                    map: world.settlement,
                  }[panel as Exclude<Panel, "planet" | null>]
                }
              </h2>
              <button autoFocus onClick={() => setPanel(null)} aria-label="Zamknij okno">
                ×
              </button>
            </header>
            <div className="ki-inline-messages">{feedback}</div>
            {panel === "inventory" &&
              (WORLD_V2 ? (
                <DiabloInventory state={state} send={onCommand} />
              ) : (
                <Inventory state={state} send={onCommand} />
              ))}
            {panel === "journal" && (
              <QuestJournal
                worldOverride={worldOverride}
                state={state}
                send={onCommand}
                close={closeAndResume}
              />
            )}
            {panel === "skills" &&
              (WORLD_V2 ? (
                <GraphicSkillTree state={state} send={onCommand} />
              ) : (
                <SkillTree state={state} send={onCommand} />
              ))}
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
                  <span>
                    Muzyka ·{" "}
                    {preferences.musicMuted
                      ? "wyciszona"
                      : Math.round(preferences.musicVolume * 100) + "%"}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={preferences.musicVolume}
                    aria-label="Głośność muzyki"
                    onChange={(e) =>
                      setPreferences((current) => ({
                        ...current,
                        musicVolume: Number(e.target.value),
                        musicMuted: false,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Wycisz muzykę</span>
                  <input
                    type="checkbox"
                    checked={preferences.musicMuted}
                    onChange={(e) => changePreference("musicMuted", e.target.checked)}
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
                    WASD / strzałki — ruch · E — rozmowa · 1–9, 0 — umiejętności z drzewka · spacja
                    — atak podstawowy · Q — mikstura · F — łup · Escape — zamknij okno lub anuluj
                    działanie. Cele i wskazówki znajdziesz w Dzienniku. Ostatnie zdarzenia są w
                    czacie System.
                  </p>
                </details>
              </div>
            )}
            {panel === "map" && (
              <>
                {world.city && (
                  <CityDirectory city={world.city} send={onCommand} close={closeAndResume} />
                )}
                <button className="ki-planet-open" onClick={() => setPanel("planet")}>
                  <span aria-hidden>◎</span> Mapa planety Superior · 2D / 3D
                  <small>Tu jesteś: {world.name}</small>
                </button>
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
                  {((worldOverride ? undefined : OPEN_WORLDS[world.id])?.zones ?? []).map((z) => {
                    const at = minimapPercent(worldOverride ? "" : world.id, z, world);
                    return (
                      <span
                        key={z.id}
                        className="ki-zone-label"
                        style={{ left: `${at.left}%`, top: `${at.top}%` }}
                      >
                        {z.name}
                      </span>
                    );
                  })}
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
