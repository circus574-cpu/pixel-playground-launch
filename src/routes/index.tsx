import { DevelopmentExam } from "../components/game/DevelopmentExam";
import type { ExamAttempt } from "../game/development/exams";
import { bossPreviewEnabled } from "../game/bosses/preview";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameLoadingScreen } from "../components/game/GameLoadingScreen";
import { preparingWorld, type GameLoadingState } from "../game/loading";
import { CharacterSelection } from "../components/game/CharacterSelection";
import { type CharacterSlot } from "../game/characters";
import { SuperiorCharacterStore as CharacterStore } from "../game/world/generated/superiorCharacters";
import { playtestSaveKey } from "../game/playtest";
import type { RaceId } from "../game/world/races";
import { GameHud } from "../components/game/GameHud";
import { music } from "../game/music";
import { registerAssetCache } from "../game/assetCache";
import { RotateNotice } from "../components/game/RotateNotice";
import { syncCloud } from "../components/account/cloudSync";
import { markStaff, verifiedStaffRole } from "../game/account/staff";
import { useAccount } from "../components/account/useAccount";
import { clampZoom, initialZoom } from "../game/view";
import type { GameViewState } from "../game/mountGame";
import { isPlaytest, STAGE21_BUILD } from "../game/playtest";
import { initialView, type Command, type StaffRole } from "../game/session";
import type { SuperiorRuntime } from "../game/world/generated/superiorRuntime";
import type { FeatureId } from "../game/world/generated/superiorSave";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ki Legends — Superior" },
      { name: "ki-build", content: STAGE21_BUILD },
      { property: "og:title", content: "Ki Legends — Superior" },
      {
        property: "og:description",
        content: "Cztery pochodzenia, cztery krainy. Rozpocznij lokalną przygodę PvE w Ki Legends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "description",
        content: "Cztery pochodzenia, cztery krainy. Rozpocznij lokalną przygodę PvE w Ki Legends.",
      },
    ],
  }),
  component: Index,
});
export function Index() {
  const account = useAccount();
  const [store, setStore] = useState<CharacterStore | null>(null);
  const [mapNotice, setMapNotice] = useState<"verdant" | "aether" | "nexus" | "pyra" | false>(
    false,
  );
  const [slots, setSlots] = useState<CharacterSlot[]>([]);
  const [active, setActive] = useState<CharacterSlot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [warning, setWarning] = useState("");
  const [startWithOrigins, setStartWithOrigins] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // A signed-in player's cloud saves arrive before the slots are read (no-op without an account).
    void syncCloud(true).then(() => {
      if (cancelled) return;
      try {
        const profiles = new CharacterStore(
          window.localStorage,
          playtestSaveKey(window.location.search),
        );
        setStore(profiles);
        setSlots(profiles.list());
        setActive(profiles.active() ?? null);
        setWarning(profiles.warning);
      } catch {
        setWarning(
          "Pamięć lokalna jest zablokowana. Zezwól na zapis, aby bezpiecznie utworzyć postać.",
        );
      }
      setLoaded(true);
      // Explicit continent handoff from /mapa. Never overwrite or auto-create saves.
      const params = new URLSearchParams(window.location.search);
      if (["verdant", "aether", "nexus", "pyra"].includes(params.get("continent") ?? "")) {
        setMapNotice(params.get("continent") as "verdant" | "aether" | "nexus" | "pyra");
        setActive(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // During play only local changes go up; a full sync runs again when the player leaves the game.
  const playing = Boolean(active?.player);
  useEffect(() => {
    if (!playing) return;
    const push = () => void syncCloud(false);
    const hidden = () => document.visibilityState === "hidden" && push();
    const timer = window.setInterval(push, 60_000);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [playing]);
  const open = (slot: CharacterSlot) => {
    store?.select(slot);
    setActive(slot);
  };
  const create = (race: RaceId, nick = "", special?: StaffRole) => {
    const slot = store?.create(race, nick);
    if (slot && special && account.roles.length) markStaff(window.localStorage, slot.id, special);
    if (slot) open(slot);
    else setWarning(store?.warning || "Nie można utworzyć zapisu na tym urządzeniu.");
  };
  const remove = (slot: CharacterSlot) => {
    if (!store?.remove(slot)) setWarning(store?.warning || "Nie udało się usunąć postaci.");
    else setWarning("");
    setSlots(store?.list() ?? []);
  };
  // Start screen and character selection: the loading theme (the game switches per continent).
  useEffect(() => {
    if (!active?.player) music.play("loading");
  }, [active]);
  if (!loaded)
    return (
      <main className="ki-bootstrap">
        <GameLoadingScreen state={preparingWorld()} />
      </main>
    );
  if (active?.player)
    return (
      <GameScreen
        key={active.id}
        slot={active}
        onExit={(origins = false) => {
          setStartWithOrigins(origins);
          store?.select(null);
          setActive(null);
          setSlots(store?.list() ?? []);
          setWarning(store?.warning ?? "");
          // The game is unmounted: bring in game-master edits, then refresh the slot list.
          void syncCloud(true).then((report) => {
            if (report?.pulled.length) setSlots(store?.list() ?? []);
          });
        }}
      />
    );
  return (
    <>
      {mapNotice && (
        <div role="status" style={{ padding: "12px", textAlign: "center" }}>
          {
            (
              {
                verdant: "Verdantia — Planetarni",
                aether: "Aetheria — Mędrcy",
                nexus: "Nexus-9 — Androidy",
                pyra: "Pyra — Legendy",
              } as const
            )[mapNotice]
          }
          : wybierz istniejącą postać odpowiedniego pochodzenia lub utwórz nową.
        </div>
      )}
      <CharacterSelection
        slots={slots}
        requestedContinent={mapNotice || undefined}
        warning={warning}
        onCreate={create}
        staffRoles={account.roles}
        onContinue={open}
        onDelete={remove}
        startWithOrigins={startWithOrigins || Boolean(mapNotice)}
      />
    </>
  );
}
function GameScreen({
  slot,
  onExit,
}: {
  slot: CharacterSlot;
  onExit: (origins?: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const [testMode, setTestMode] = useState(false);
  const [zoom, setZoom] = useState(0.62);
  const [fullscreen, setFullscreen] = useState(false);
  const [displayNotice, setDisplayNotice] = useState({ id: 0, text: "" });
  const displayMessage = (text: string) =>
    setDisplayNotice((previous) => ({ id: previous.id + 1, text }));
  const setWorldLabels = useCallback((visible: boolean) => {
    container.current?.dispatchEvent(new CustomEvent("ki:labels", { detail: visible }));
  }, []);
  const [loading, setLoading] = useState<GameLoadingState>(preparingWorld);
  const [attempt, setAttempt] = useState(0);
  const activeDevelopmentExam = useRef<ExamAttempt | null>(null);
  const [developmentExam, setDevelopmentExam] = useState<ExamAttempt | null>(null);
  const [worldRuntime, setWorldRuntime] = useState<SuperiorRuntime | null>(null);
  const [state, setState] = useState<GameViewState>(() => initialView(slot.player!));
  const sendCommand = useCallback((command: Command) => {
    container.current?.dispatchEvent(new CustomEvent("ki:command", { detail: command }));
  }, []);
  // The sleeping owner's HUD/rotation listeners may clean up while a loan profile is active.
  // Their cleanup commands must never wake or advance the owner underneath that profile.
  const sendOwnerCommand = useCallback(
    (command: Command) => {
      if (!activeDevelopmentExam.current) sendCommand(command);
    },
    [sendCommand],
  );
  useEffect(() => {
    setTestMode(isPlaytest(window.location.search));
    const initial = initialZoom(window.innerWidth, window.innerHeight);
    setZoom(initial);
    if (container.current) container.current.dataset["zoom"] = String(initial);
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  function changeZoom(value: number) {
    const next = clampZoom(value);
    setZoom(next);
    if (container.current) {
      container.current.dataset["zoom"] = String(next);
      container.current.dispatchEvent(new Event("ki:zoom"));
    }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.current?.requestFullscreen) await stage.current.requestFullscreen();
      else displayMessage("Ta przeglądarka nie udostępnia pełnego ekranu.");
    } catch {
      displayMessage("Nie udało się włączyć pełnego ekranu. Spróbuj ponownie.");
    }
  }
  useEffect(() => {
    setLoading(preparingWorld());
    setState(initialView(slot.player!));
    let cancelled = false;
    const abort = new AbortController();
    let prepared: SuperiorRuntime | undefined;
    setWorldRuntime(null);
    let cleanup: (() => void) | undefined;
    import("../game/mountGame")
      .then(async ({ mountKileGends }) => {
        if (!bossPreviewEnabled(location.pathname, location.search)) {
          const { prepareSuperior } = await import("../game/world/generated/superiorRuntime");
          const [runtime, staff] = await Promise.all([
            prepareSuperior({
              race: slot.player!.race,
              saveKey: slot.key,
              signal: abort.signal,
              onLoading: (next) => {
                if (!cancelled) setLoading(next);
              },
            }),
            verifiedStaffRole(slot.id),
          ]);
          prepared = runtime;
          prepared.session.staff = staff;
          if (!cancelled) setWorldRuntime(prepared);
        }
        if (!cancelled) {
          setLoading({
            phase: "preparing",
            message: "Przygotowywanie mapy świata i globusa…",
            progress: null,
          });
          try {
            const { prepareGameMap } = await import("../components/planet-map/preload");
            await prepareGameMap(prepared?.feature ?? slot.player!.continent);
          } catch {
            /* Optional map preparation must not block the actual game. */
          }
        }
        if (!cancelled && container.current)
          cleanup = mountKileGends(
            container.current,
            (next) => {
              if (!cancelled) setState(next);
            },
            {
              saveKey: slot.key,
              race: slot.player!.race,
              ...(prepared ? { runtime: prepared } : {}),
              onLoading: (next) => {
                if (!cancelled) setLoading(next);
              },
            },
          );
      })
      .catch((error: unknown) => {
        if (!cancelled && container.current)
          container.current.dataset["worldError"] =
            error instanceof Error ? error.message : String(error);
        if (!cancelled)
          setLoading({
            phase: "error",
            message: "Nie można uruchomić silnika gry. Sprawdź połączenie i ponów próbę.",
            progress: null,
            reload: true,
          });
      });
    return () => {
      cancelled = true;
      cleanup?.();
      prepared?.dispose?.();
      abort.abort();
    };
  }, [slot.key, slot.player, attempt]);
  return (
    <main ref={stage} className="ki-stage">
      {developmentExam && (
        <DevelopmentExam
          key={developmentExam.instanceId}
          attempt={developmentExam}
          retry={() => {
            const next = worldRuntime?.session.retryDevelopmentExam(developmentExam);
            if (!next) return;
            activeDevelopmentExam.current = next;
            setDevelopmentExam(next);
          }}
          accept={() => {
            if (!worldRuntime?.session.finishDevelopmentExam(developmentExam)) return false;
            activeDevelopmentExam.current = null;
            setDevelopmentExam(null);
            sendCommand({ type: "pause", value: false });
            return true;
          }}
          leave={() => {
            worldRuntime?.session.leaveDevelopmentExam(developmentExam);
            activeDevelopmentExam.current = null;
            setDevelopmentExam(null);
            sendCommand({ type: "pause", value: false });
          }}
        />
      )}

      <div ref={container} className="ki-canvas" aria-label="Ki Legends — ekran gry" />
      {!developmentExam && <RotateNotice stage={stage.current} onCommand={sendOwnerCommand} />}
      {!developmentExam && state.ready && loading.phase === "ready" && (
        <GameHud
          onStartExam={(discipline, tier, rehearsal) => {
            const exam = worldRuntime?.session.startDevelopmentExam(discipline, tier, rehearsal);
            if (!exam) return displayMessage("Podejdź do trenera i sprawdź wymagania egzaminu.");
            activeDevelopmentExam.current = exam;
            sendCommand({ type: "pause", value: true, suspendRendering: true });
            setDevelopmentExam(exam);
          }}
          worldOverride={worldRuntime?.session.world}
          planetLocation={worldRuntime?.feature}
          staffDestinations={worldRuntime?.index.features.map((f) => ({ id: f.id, name: f.name }))}
          onStaffTravel={(id) => {
            if (worldRuntime?.travel(id as FeatureId, true)) setAttempt((n) => n + 1);
            else displayMessage("Podróż niemożliwa: wyjdź na otwarty teren.");
          }}
          onPlanetTravel={(id) => {
            if (worldRuntime?.travel(id as FeatureId)) setAttempt((n) => n + 1);
            else
              displayMessage(
                worldRuntime?.save.warning ||
                  "Podejdź do przystani w głównej osadzie, aby podróżować.",
              );
          }}
          state={state}
          error={null}
          zoom={zoom}
          onZoom={changeZoom}
          fullscreen={fullscreen}
          onFullscreen={() => void toggleFullscreen()}
          onCommand={sendOwnerCommand}
          onWorldLabels={setWorldLabels}
          systemNotice={displayNotice}
          onRaceChange={() => {
            container.current?.dispatchEvent(new Event("ki:flush"));
            onExit(true);
          }}
          onCharacters={() => {
            container.current?.dispatchEvent(new Event("ki:flush"));
            onExit();
          }}
        />
      )}
      {loading.phase !== "ready" && <LoadingTheme />}
      {loading.phase !== "ready" && (
        <GameLoadingScreen
          state={loading}
          race={slot.player!.race}
          onRetry={() => {
            if (loading.phase === "error" && loading.reload) window.location.reload();
            else setAttempt((value) => value + 1);
          }}
          onBack={() => onExit()}
        />
      )}
      {testMode && (
        <div className="ki-playtest-badge">
          TEST 3 · oddzielny zapis · <a href="/">Powrót</a>
        </div>
      )}
    </main>
  );
}

/** While a world loads (also on travel between lands) the loading theme plays. */
function LoadingTheme() {
  useEffect(() => music.play("loading"), []);
  useEffect(registerAssetCache, []);
  return null;
}
