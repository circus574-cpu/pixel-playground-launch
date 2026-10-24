import React, { useMemo, useState } from 'react';
import {
  Compass,
  ScrollText,
  MapPin,
  Sparkles,
  ShieldCheck,
  Swords,
  CheckCircle2,
  Lock,
  Eye,
  Award,
  Navigation as NavIcon,
  RefreshCw,
  Route as RouteIcon,
  MessageSquare,
  PackageCheck,
  AlertTriangle,
  Database,
} from 'lucide-react';
import {
  ALL_FAMOUS_LOCATIONS_V2,
  CONTINENTS_WORLD_V2,
  ContinentId,
  isPositionInSafeCity,
} from '../game/worlds';
import { MONSTERS } from '../game/monsters';
import {
  ALL_QUESTS_V2,
  QUEST_BY_ID,
  discoverFamousLocation,
  discoverHiddenPlace,
  getNpcQuestMarker,
  isLocationDiscovered,
  migrateSaveV4ToV5,
  recordQuestObjectiveEvent,
  startQuest,
  triggerWorldEvent,
} from '../game/quests/engine';
import { CanonicalItemId, PlayerSaveV5, QuestCategory } from '../game/quests/types';

interface WorldV2ExplorerProps {
  save: PlayerSaveV5;
  onUpdateSave: (next: PlayerSaveV5) => void;
}

const CONTINENT_ACCENTS: Record<
  ContinentId,
  { border: string; text: string; bg: string; badge: string; hex: string }
> = {
  verdant: {
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    bg: 'bg-emerald-950/30',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    hex: '#10b981',
  },
  pyra: {
    border: 'border-orange-500/40',
    text: 'text-orange-400',
    bg: 'bg-orange-950/30',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    hex: '#f97316',
  },
  aether: {
    border: 'border-sky-500/40',
    text: 'text-sky-400',
    bg: 'bg-sky-950/30',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    hex: '#38bdf8',
  },
  nexus: {
    border: 'border-fuchsia-500/40',
    text: 'text-fuchsia-400',
    bg: 'bg-fuchsia-950/30',
    badge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
    hex: '#d946ef',
  },
};

export const WorldV2Explorer: React.FC<WorldV2ExplorerProps> = ({ save, onUpdateSave }) => {
  const [selectedContinent, setSelectedContinent] = useState<ContinentId>(
    save.continent || 'verdant',
  );
  const [selectedCityId, setSelectedCityId] = useState<string>(
    CONTINENTS_WORLD_V2[save.continent || 'verdant'].cities[0].id,
  );
  const [journalFilter, setJournalFilter] = useState<
    'active' | 'available' | 'completed' | 'hidden' | 'intercontinental'
  >('active');
  const [activeSubPanel, setActiveSubPanel] = useState<
    'cities' | 'famous' | 'roads' | 'events' | 'registry'
  >('cities');
  const [actionLog, setActionLog] = useState<string[]>([
    'Witaj w KI Legends World V2. Wybierz miasto, porozmawiaj z NPC ze znacznikiem ! lub ? albo zbadaj Sławne Lokacje.',
  ]);

  const continentData = CONTINENTS_WORLD_V2[selectedContinent];
  const accent = CONTINENT_ACCENTS[selectedContinent];
  const [worldWidth, worldHeight] = continentData.size;

  const pushLog = (msg: string) => {
    setActionLog((prev) => [msg, ...prev.slice(0, 7)]);
  };

  const handleSelectContinent = (cId: ContinentId) => {
    setSelectedContinent(cId);
    const firstCity = CONTINENTS_WORLD_V2[cId].cities[0];
    setSelectedCityId(firstCity.id);
    onUpdateSave({
      ...save,
      continent: cId,
      position: {
        x: Math.round(firstCity.bounds.x + firstCity.bounds.width / 2),
        y: Math.round(firstCity.bounds.y + firstCity.bounds.height / 2),
      },
    });
  };

  const selectedCity =
    continentData.cities.find((c) => c.id === selectedCityId) || continentData.cities[0];

  const trackedQuest = save.trackedQuestId ? QUEST_BY_ID[save.trackedQuestId] : null;
  const trackedRecord = save.trackedQuestId ? save.quests[save.trackedQuestId] : null;

  // Oblicz najbliższy cel aktywnego/śledzonego zadania na aktualnym kontynencie
  const nearestTargetInfo = useMemo(() => {
    if (!trackedQuest || !trackedRecord) return null;
    const stage = trackedQuest.stages[trackedRecord.currentStageIndex];
    if (!stage) return null;

    const pendingObj = stage.objectives.find(
      (o) => (trackedRecord.objectiveProgress[o.id] ?? 0) < o.targetCount,
    );
    if (!pendingObj) return null;

    let targetCoords: { x: number; y: number; label: string } | null = null;

    if (pendingObj.coordinates) {
      targetCoords = {
        x: pendingObj.coordinates.x,
        y: pendingObj.coordinates.y,
        label: pendingObj.description,
      };
    } else if (pendingObj.type === 'talk') {
      for (const c of continentData.cities) {
        const npc = c.npcs.find((n) => n.id === pendingObj.targetId);
        if (npc) {
          targetCoords = {
            x: npc.coordinates.x,
            y: npc.coordinates.y,
            label: `NPC ${npc.name} (${c.name})`,
          };
          break;
        }
      }
    } else if (pendingObj.type === 'visit') {
      const city = continentData.cities.find((c) => c.id === pendingObj.targetId);
      if (city) {
        targetCoords = {
          x: Math.round(city.bounds.x + city.bounds.width / 2),
          y: Math.round(city.bounds.y + city.bounds.height / 2),
          label: `Miasto ${city.name}`,
        };
      }
    } else if (pendingObj.type === 'discover') {
      const loc = continentData.famousLocations.find(
        (l) => l.id === pendingObj.targetId || l.mapPointId === pendingObj.targetId,
      );
      if (loc) {
        targetCoords = {
          x: loc.coordinates.x,
          y: loc.coordinates.y,
          label: `${loc.name} (${loc.mapPointId})`,
        };
      }
    }

    if (!targetCoords) {
      return {
        objective: pendingObj,
        distance: null,
        label: pendingObj.description,
        coords: null,
      };
    }

    const dx = targetCoords.x - save.position.x;
    const dy = targetCoords.y - save.position.y;
    const dist = Math.round(Math.hypot(dx, dy));

    return {
      objective: pendingObj,
      distance: dist,
      label: targetCoords.label,
      coords: targetCoords,
    };
  }, [trackedQuest, trackedRecord, continentData, save.position]);

  const filteredQuests = useMemo(() => {
    return ALL_QUESTS_V2.filter((q) => {
      const rec = save.quests[q.id];
      const state = rec?.state ?? 'unavailable';

      if (journalFilter === 'intercontinental') {
        return q.category === 'intercontinental';
      }

      if (q.continent !== selectedContinent && q.category !== 'intercontinental') {
        return false;
      }

      if (journalFilter === 'active') return state === 'active';
      if (journalFilter === 'available') return state === 'available' && q.category !== 'hidden';
      if (journalFilter === 'completed') return state === 'completed';
      if (journalFilter === 'hidden') {
        return q.category === 'hidden' && state !== 'unavailable';
      }
      return true;
    });
  }, [save.quests, selectedContinent, journalFilter]);

  const hiddenLockedCount = useMemo(() => {
    return ALL_QUESTS_V2.filter(
      (q) =>
        q.continent === selectedContinent &&
        q.category === 'hidden' &&
        (save.quests[q.id]?.state ?? 'unavailable') === 'unavailable',
    ).length;
  }, [save.quests, selectedContinent]);

  const handleTravelToCity = (cityId: string) => {
    const city = continentData.cities.find((c) => c.id === cityId);
    if (!city) return;
    setSelectedCityId(city.id);

    const centerX = Math.round(city.bounds.x + city.bounds.width / 2);
    const centerY = Math.round(city.bounds.y + city.bounds.height / 2);

    let next: PlayerSaveV5 = {
      ...save,
      continent: selectedContinent,
      position: {
        x: centerX,
        y: centerY,
      },
    };
    next = recordQuestObjectiveEvent(next, 'visit', city.id, 1);
    onUpdateSave(next);
    pushLog(
      `Dotarłeś do: ${city.name} (${city.role === 'capital' ? 'Stolica' : 'Miasto'} — Strefa Bezpieczna, brak walk).`,
    );
  };

  const handleTalkToNpc = (npcId: string, npcName: string) => {
    const next = recordQuestObjectiveEvent(save, 'talk', npcId, 1);
    onUpdateSave(next);
    pushLog(`Rozmowa z NPC: ${npcName} (${npcId}). Zaktualizowano cele dialogowe.`);
  };

  const handleDeliverItem = (itemId: CanonicalItemId) => {
    if ((save.inventory[itemId] ?? 0) <= 0) {
      pushLog(`Brak przedmiotu "${itemId}" w ekwipunku do przekazania.`);
      return;
    }
    const next = recordQuestObjectiveEvent(save, 'deliver', itemId, 1);
    onUpdateSave(next);
    pushLog(`Przekazano przedmiot "${itemId}" na poczet aktywnego zadania.`);
  };

  const handleDiscoverFamous = (famousId: string, mapPointId: string, name: string) => {
    const wasDiscovered = isLocationDiscovered(save, famousId);
    const loc = continentData.famousLocations.find((l) => l.id === famousId);
    let next: PlayerSaveV5 = {
      ...save,
      continent: selectedContinent,
      position: {
        x: loc?.coordinates.x ?? save.position.x,
        y: loc?.coordinates.y ?? save.position.y,
      },
    };
    next = discoverFamousLocation(next, famousId);
    onUpdateSave(next);
    if (!wasDiscovered) {
      pushLog(
        `ODKRYTO SŁAWNĄ LOKACJĘ: ${name} (${mapPointId})! Otrzymano nagrodę za pierwsze odkrycie i zaktualizowano dziennik.`,
      );
    } else {
      pushLog(`Odwiedzono ponownie: ${name} (${mapPointId}).`);
    }
  };

  const handleDiscoverHiddenPlace = (placeId: string, name: string) => {
    const next = discoverHiddenPlace(save, placeId);
    onUpdateSave(next);
    pushLog(`ODKRYTO UKRYTE MIEJSCE: ${name} (${placeId})!`);
  };

  const handleTriggerEvent = (eventId: string, title: string) => {
    const next = triggerWorldEvent(save, eventId);
    onUpdateSave(next);
    pushLog(`WYDARZENIE ŚWIATA: "${title}" ukończone! Zapisano postęp i nagrodę.`);
  };

  const handleQuickCombat = (monsterId: string, monsterName: string) => {
    const next = recordQuestObjectiveEvent(save, 'combat', monsterId, 1);
    onUpdateSave(next);
    pushLog(`Pokonano w boju: ${monsterName} (${monsterId}). Liczniki zadań zaktualizowane.`);
  };

  const handleTestV4Migration = () => {
    const demoV4 = {
      version: 4 as const,
      heroRace: 'planetary' as const,
      continent: selectedContinent,
      level: 5,
      xp: 1150,
      coins: 380,
      position: { x: 1480, y: 900 },
      inventory: { potion: 5, tusk: 4, sword: 2, vest: 2 },
      swordUpgraded: true,
      completedQuests: ['O-V01', 'O-P01', 'O-A01', 'O-N01'],
      activeQuestId: 'O-V02',
    };
    const migrated = migrateSaveV4ToV5(demoV4);
    onUpdateSave(migrated);
    pushLog(
      'Przeprowadzono migrację testowego zapisu Save v4 -> Save v5. Zachowano ekwipunek, ukończone zadania i aktywny cel.',
    );
  };

  const continentMonsters = useMemo(() => {
    return MONSTERS.filter((m) => m.world === selectedContinent);
  }, [selectedContinent]);

  const safeCityHere = isPositionInSafeCity(selectedContinent, save.position.x, save.position.y);
  const discoveredFamousCount = ALL_FAMOUS_LOCATIONS_V2.filter((loc) =>
    isLocationDiscovered(save, loc.id),
  ).length;

  return (
    <div className="space-y-6">
      {/* Pasek statusu gracza, najbliższego celu i migracji Save v4 -> v5 */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-400">
              Postać (Save v{save.version} {save.migratedFromV4 ? '• Zmigrowano z v4' : ''})
            </div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              Adept KI ({save.heroRace})
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Lv.{save.level} ({save.xp} XP)
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                {save.coins} Monet
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-zinc-800 hidden sm:block" />

          <div className="text-xs text-zinc-300 flex flex-wrap items-center gap-2">
            <span className="text-zinc-400">Ekwipunek:</span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
              Mikstura (potion): <b>{save.inventory.potion}</b>
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
              Kieł/Rdzeń (tusk): <b>{save.inventory.tusk}</b>
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
              Broń (sword): <b>{save.inventory.sword}</b>
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
              Pancerz (vest): <b>{save.inventory.vest}</b>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestV4Migration}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
            title="Przetestuj migrację ze starszego formatu zapisu v4"
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            Testuj migrację Save v4 → v5
          </button>
        </div>
      </div>

      {/* Pasek śledzonego zadania i kompas najbliższego celu */}
      <div className="bg-zinc-900/95 border border-amber-500/30 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <NavIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-amber-400/90 font-semibold flex items-center gap-2">
              <span>Śledzone Zadanie & Najbliższy Cel</span>
              {safeCityHere ? (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
                  Strefa Bezpieczna Miasta: {safeCityHere.name} (inSafeCity)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px]">
                  Teren Przygodowy / Szlak Bojowy
                </span>
              )}
            </div>
            {trackedQuest && trackedRecord ? (
              <div className="text-sm text-zinc-100 font-medium mt-0.5">
                <span className="text-amber-300 font-bold">[{trackedQuest.id}]</span>{' '}
                {trackedQuest.title} —{' '}
                <span className="text-zinc-300">
                  {nearestTargetInfo ? nearestTargetInfo.label : 'Wszystkie cele etapu gotowe'}
                </span>
              </div>
            ) : (
              <div className="text-sm text-zinc-400">
                Brak śledzonego zadania. Wybierz zadanie w Dzienniku Questów po prawej stronie.
              </div>
            )}
          </div>
        </div>

        {nearestTargetInfo && (
          <div className="flex items-center gap-3 text-xs bg-zinc-950/80 px-3 py-2 rounded-lg border border-zinc-800">
            <Compass className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-zinc-400">Dystans do celu:</div>
              <div className="font-mono font-bold text-amber-300">
                {nearestTargetInfo.distance !== null
                  ? `${nearestTargetInfo.distance} jedn. (${nearestTargetInfo.coords?.x}, ${nearestTargetInfo.coords?.y})`
                  : 'Dowolny punkt na kontynencie'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wybór jednego z 4 kontynentów */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['verdant', 'pyra', 'aether', 'nexus'] as ContinentId[]).map((cId) => {
          const c = CONTINENTS_WORLD_V2[cId];
          const isSelected = selectedContinent === cId;
          const cAccent = CONTINENT_ACCENTS[cId];
          const discoveredOnContinent = c.famousLocations.filter((l) =>
            isLocationDiscovered(save, l.id),
          ).length;

          return (
            <button
              key={cId}
              onClick={() => handleSelectContinent(cId)}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? `${cAccent.bg} ${cAccent.border} ring-1 ring-white/15`
                  : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${cAccent.text}`}>
                  {c.raceName} ({c.factionName})
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  Odkrycia: {discoveredOnContinent}/4
                </span>
              </div>
              <div className="text-base font-bold text-white mt-0.5">{c.name}</div>
              <div className="text-xs text-zinc-400 mt-1 line-clamp-1">{c.themeSummary}</div>
            </button>
          );
        })}
      </div>

      {/* Główny układ: Lewa kolumna (Interaktywna Mapa + Miasta/Lokacje/Drogi/Wydarzenia) | Prawa kolumna (Dziennik Questów) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEWA KOLUMNA (7/12): Interaktywna Mapa Kontynentu + Zakładki Świata */}
        <div className="xl:col-span-7 space-y-5">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MapPin className={`w-4 h-4 ${accent.text}`} />
                  Mapa Taktyczna Kontynentu: {continentData.name} ({worldWidth}×{worldHeight})
                </h3>
                <p className="text-xs text-zinc-400">
                  Kliknij miasto (zielona strefa), sławną lokację (gwiazda ★) lub wybierz zakładkę
                  poniżej, aby podróżować i wykonywać cele.
                </p>
              </div>
              <div className="text-xs font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800">
                Pozycja: ({save.position.x}, {save.position.y})
              </div>
            </div>

            {/* SVG Mapa Kontynentu */}
            <div className="relative w-full aspect-[4/3] bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
              <svg viewBox={`0 0 ${worldWidth} ${worldHeight}`} className="w-full h-full">
                <defs>
                  <pattern id="worldGrid" width="240" height="240" patternUnits="userSpaceOnUse">
                    <path
                      d="M 240 0 L 0 0 0 240"
                      fill="none"
                      stroke="rgba(255,255,255,0.04)"
                      strokeWidth="2"
                    />
                  </pattern>
                </defs>
                <rect width={worldWidth} height={worldHeight} fill="url(#worldGrid)" />

                {/* Drogi i szlaki przygodowe */}
                {continentData.roads.map((road) => {
                  const pts = road.waypoints.map((w) => `${w.x},${w.y}`).join(' ');
                  const strokeColor =
                    road.category === 'merchant'
                      ? '#eab308'
                      : road.category === 'dangerous' || road.category === 'ambush'
                        ? '#ef4444'
                        : road.category === 'famous_route'
                          ? '#38bdf8'
                          : '#a1a1aa';
                  return (
                    <g key={road.id}>
                      <polyline
                        points={pts}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="12"
                        strokeDasharray={road.category === 'forgotten' ? '24 16' : undefined}
                        opacity="0.55"
                      />
                    </g>
                  );
                })}

                {/* Bezpieczne strefy miast (city.bounds) */}
                {continentData.cities.map((city) => {
                  const isCurrentCity = selectedCity.id === city.id;
                  const cx = Math.round(city.bounds.x + city.bounds.width / 2);
                  const cy = Math.round(city.bounds.y + city.bounds.height / 2);
                  const isCapital = city.role === 'capital';
                  return (
                    <g
                      key={city.id}
                      onClick={() => handleTravelToCity(city.id)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={city.bounds.x}
                        y={city.bounds.y}
                        width={city.bounds.width}
                        height={city.bounds.height}
                        rx="28"
                        fill={
                          isCurrentCity ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.1)'
                        }
                        stroke={isCurrentCity ? '#34d399' : '#059669'}
                        strokeWidth={isCurrentCity ? '10' : '6'}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isCapital ? 34 : 24}
                        fill={isCapital ? '#f59e0b' : '#10b981'}
                        stroke="#09090b"
                        strokeWidth="8"
                      />
                      <text
                        x={cx}
                        y={cy - 46}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="48"
                        fontWeight="bold"
                      >
                        {city.name}
                      </text>

                      {/* Znaczniki zadań nad NPC w tym mieście */}
                      {city.npcs.map((npc, idx) => {
                        const marker = getNpcQuestMarker(save, npc.id);
                        return (
                          <g key={npc.id}>
                            <circle
                              cx={npc.coordinates.x + idx * 14}
                              cy={npc.coordinates.y}
                              r="16"
                              fill="#e4e4e7"
                              stroke="#18181b"
                              strokeWidth="4"
                            />
                            {marker && (
                              <text
                                x={npc.coordinates.x + idx * 14}
                                y={npc.coordinates.y - 24}
                                textAnchor="middle"
                                fill={marker === '!' ? '#facc15' : '#38bdf8'}
                                fontSize="62"
                                fontWeight="900"
                              >
                                {marker}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                {/* 4 Sławne Lokacje (Exploration Points) */}
                {continentData.famousLocations.map((loc) => {
                  const isDiscovered = isLocationDiscovered(save, loc.id);
                  return (
                    <g
                      key={loc.id}
                      onClick={() => handleDiscoverFamous(loc.id, loc.mapPointId, loc.name)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={loc.coordinates.x}
                        cy={loc.coordinates.y}
                        r="32"
                        fill={isDiscovered ? '#38bdf8' : '#f59e0b'}
                        stroke="#09090b"
                        strokeWidth="7"
                      />
                      <text
                        x={loc.coordinates.x}
                        y={loc.coordinates.y + 66}
                        textAnchor="middle"
                        fill={isDiscovered ? '#7dd3fc' : '#fde047'}
                        fontSize="44"
                        fontWeight="bold"
                      >
                        ★ {loc.mapPointId}
                      </text>
                    </g>
                  );
                })}

                {/* Pozycja gracza */}
                {save.continent === selectedContinent && (
                  <g>
                    <circle
                      cx={save.position.x}
                      cy={save.position.y}
                      r="42"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="7"
                      strokeDasharray="16 10"
                    />
                    <circle cx={save.position.x} cy={save.position.y} r="18" fill="#ffffff" />
                  </g>
                )}
              </svg>

              {/* Legenda na dole mapy */}
              <div className="absolute bottom-2 left-2 right-2 bg-zinc-950/90 border border-zinc-800 rounded-lg px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-300">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Stolica
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Miasto
                    (Bezpieczna Strefa)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-400 font-bold">!</span> Nowy Quest NPC
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-sky-400 font-bold">?</span> Aktywna Rozmowa NPC
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-amber-300 font-bold">★</span> Sławna Lokacja (Exploration)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Przełącznik pod-paneli świata */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'cities', label: 'A. Miasta i NPC (4)', icon: ShieldCheck },
              { id: 'famous', label: 'C. Sławne Lokacje (4)', icon: Sparkles },
              { id: 'roads', label: 'B. Drogi i Szlaki', icon: RouteIcon },
              { id: 'events', label: '5. Wydarzenia i Polowania', icon: Swords },
              { id: 'registry', label: 'D. Ukryte Miejsca & Rejestr', icon: Eye },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeSubPanel === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubPanel(tab.id as typeof activeSubPanel)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* SUB-PANEL A: MIASTA I OSADY + INTERAKCJE Z NPC */}
          {activeSubPanel === 'cities' && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {continentData.cities.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => handleTravelToCity(city.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      selectedCity.id === city.id
                        ? `${accent.badge}`
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {city.role === 'capital' ? '★ Stolica: ' : ''}
                    {city.name}
                  </button>
                ))}
              </div>

              <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-base font-bold text-white">{selectedCity.name}</h4>
                    <div className="text-xs text-zinc-400">{selectedCity.atmosphere}</div>
                  </div>
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Bezpieczne Miasto (inSafeCity = true)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-zinc-900/80 p-3 rounded border border-zinc-800">
                    <div className="text-zinc-400 font-semibold mb-1">
                      Funkcja w gospodarce i historii:
                    </div>
                    <p className="text-zinc-200">{selectedCity.economicAndHistoricalFunction}</p>
                  </div>
                  <div className="bg-zinc-900/80 p-3 rounded border border-zinc-800">
                    <div className="text-zinc-400 font-semibold mb-1">
                      Główne problemy mieszkańców:
                    </div>
                    <ul className="text-zinc-200 space-y-1">
                      {selectedCity.citizenProblems.map((prob, idx) => (
                        <li key={idx}>• {prob}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-zinc-900/80 p-3 rounded border border-zinc-800">
                    <div className="text-zinc-400 font-semibold mb-1">
                      Tajemnica miasta do odkrycia ({selectedCity.secretToDiscover.title}):
                    </div>
                    <p className="text-amber-200/90">{selectedCity.secretToDiscover.description}</p>
                  </div>
                  <div className="bg-zinc-900/80 p-3 rounded border border-zinc-800">
                    <div className="text-zinc-400 font-semibold mb-1">
                      Powód powrotu gracza do miasta:
                    </div>
                    <p className="text-emerald-200/90">{selectedCity.reasonToReturn}</p>
                  </div>
                </div>

                {/* Lokalni NPC w mieście */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Lokalni NPC i powiązania fabularne:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedCity.npcs.map((npc) => {
                      const marker = getNpcQuestMarker(save, npc.id);
                      return (
                        <div
                          key={npc.id}
                          className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-white flex items-center gap-1.5">
                                {npc.name}
                                <span className="text-[11px] font-mono text-zinc-400">
                                  ({npc.bindingId})
                                </span>
                              </span>
                              {marker && (
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-black ${
                                    marker === '!'
                                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                  }`}
                                >
                                  {marker === '!' ? '! Nowe Zadanie' : '? Cel Rozmowy'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-amber-400/90 font-medium">{npc.role}</div>
                            <p className="text-xs text-zinc-400 mt-1">{npc.storyConnection}</p>
                          </div>

                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-800/80">
                            <button
                              onClick={() => handleTalkToNpc(npc.id, npc.name)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-medium cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3" />
                              Porozmawiaj
                            </button>
                            <button
                              onClick={() => handleDeliverItem('potion')}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] cursor-pointer"
                            >
                              <PackageCheck className="w-3 h-3" /> Oddaj potion
                            </button>
                            <button
                              onClick={() => handleDeliverItem('tusk')}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] cursor-pointer"
                            >
                              <PackageCheck className="w-3 h-3" /> Oddaj tusk
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-PANEL C: 4 SŁAWNE LOKACJE NA KONTYNENCIE */}
          {activeSubPanel === 'famous' && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="text-xs text-zinc-400">
                Każdy kontynent wykorzystuje dokładnie 4 istniejące punkty mapy (łącznie 16 sławnych
                lokacji). Pierwsze odkrycie przyznaje nagrodę i zapisuje stan w dzienniku.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {continentData.famousLocations.map((loc) => {
                  const discovered = isLocationDiscovered(save, loc.id);
                  return (
                    <div
                      key={loc.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                        discovered
                          ? 'bg-sky-950/20 border-sky-500/40'
                          : 'bg-zinc-950/70 border-zinc-800'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-white">{loc.name}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-amber-300 border border-zinc-700">
                            ID: {loc.mapPointId}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">{loc.loreAndLegend}</p>
                        <div className="text-[11px] text-zinc-400">
                          <b>Wyzwanie ({loc.challengeOrEncounter.type}):</b>{' '}
                          {loc.challengeOrEncounter.description}
                        </div>
                        <div className="text-[11px] text-amber-300/90">
                          <b>Nagroda za 1. odkrycie:</b> +{loc.firstDiscoveryReward.xp} XP, +
                          {loc.firstDiscoveryReward.coins} monet
                          {loc.firstDiscoveryReward.itemId
                            ? `, 1× ${loc.firstDiscoveryReward.itemId}`
                            : ''}
                        </div>
                        {loc.crossLocationSecret && (
                          <div className="text-[11px] text-purple-300/90">
                            <b>Sekret powiązany ({loc.crossLocationSecret.secretTitle}):</b>{' '}
                            {loc.crossLocationSecret.description}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                        <span
                          className={`text-xs font-semibold flex items-center gap-1 ${
                            discovered ? 'text-sky-400' : 'text-zinc-500'
                          }`}
                        >
                          {discovered ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Odkryto w dzienniku
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" /> Nieodkryte
                            </>
                          )}
                        </span>
                        <button
                          onClick={() => handleDiscoverFamous(loc.id, loc.mapPointId, loc.name)}
                          className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold cursor-pointer"
                        >
                          {discovered ? 'Odwiedź ponownie' : 'Zbadaj i Odkryj'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUB-PANEL B: DROGI I SZLAKI PRZYGODOWE */}
          {activeSubPanel === 'roads' && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="text-xs text-zinc-400">
                Szlaki wykorzystują istniejącą geometrię dróg kontynentu: trasy kupieckie,
                niebezpieczne odcinki, zapomniane ścieżki i miejsca zasadzek.
              </div>
              <div className="space-y-2.5">
                {continentData.roads.map((road) => (
                  <div
                    key={road.id}
                    className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{road.name}</span>
                      <span className="text-[11px] uppercase px-2 py-0.5 rounded bg-zinc-900 text-amber-300 border border-zinc-700">
                        Typ: {road.category} | Poziom zagrożenia: {road.dangerLevel}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300">{road.description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                      {road.restPoint && (
                        <div className="text-emerald-300/90">
                          <b>Punkt odpoczynku ({road.restPoint.name}):</b>{' '}
                          {road.restPoint.description}
                        </div>
                      )}
                      {road.roadsideSecret && (
                        <div className="text-purple-300/90">
                          <b>Sekret przy drodze ({road.roadsideSecret.title}):</b>{' '}
                          {road.roadsideSecret.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUB-PANEL 5: WYDARZENIA ŚWIATA I POLOWANIA NA POTWORY */}
          {activeSubPanel === 'events' && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                  Wydarzenia na Szlakach ({continentData.name})
                </h4>
                <div className="space-y-2.5">
                  {continentData.worldEvents.map((ev) => {
                    const claimedOnce = save.discoveryRewardClaimedIds.includes(ev.id);
                    const isLockedOnce = ev.repeatability === 'once' && claimedOnce;
                    const isActiveInEngine = ev.implementationStatus === 'active_in_engine';
                    return (
                      <div
                        key={ev.id}
                        className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{ev.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-700">
                              {ev.repeatability === 'once' ? 'Jednorazowe' : 'Odnawialne'}
                            </span>
                            {!isActiveInEngine && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Dane przyszłego etapu
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">{ev.description}</p>
                        </div>

                        {isActiveInEngine ? (
                          <button
                            disabled={isLockedOnce}
                            onClick={() => handleTriggerEvent(ev.id, ev.name)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                              isLockedOnce
                                ? 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {isLockedOnce ? 'Już ukończono' : 'Rozegraj Zdarzenie'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-amber-400/80 italic">
                            Wymaga rozbudowy runtime
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2">
                  Szybkie Starcie na Szlaku (10 Potworów Kontynentu z Bestiariusza Właściciela)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {continentMonsters.map((m) => (
                    <div
                      key={m.id}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">
                          {m.name}{' '}
                          <span className="text-[10px] font-mono text-zinc-400">({m.id})</span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Lv.{m.level} • HP {m.stats.hp} • ATK {m.stats.atk}
                        </div>
                      </div>
                      <button
                        onClick={() => handleQuickCombat(m.id, m.name)}
                        className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold cursor-pointer shrink-0"
                      >
                        Pokonaj (+1)
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SUB-PANEL D: UKRYTE MIEJSCA I REJESTR ODKRYĆ */}
          {activeSubPanel === 'registry' && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
                  Ukryte Miejsca i Sekrety Geometrii ({continentData.name})
                </h4>
                <div className="space-y-2.5">
                  {continentData.hiddenPlaces.map((hp) => {
                    const isDiscovered = save.discoveredLocationIds.includes(hp.id);
                    const isSupported = hp.implementationStatus === 'active_in_engine';
                    return (
                      <div
                        key={hp.id}
                        className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{hp.name}</span>
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-zinc-900 text-purple-300 border border-zinc-700">
                              {hp.category}
                            </span>
                            {!isSupported && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Oczekuje na integrację w silniku
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">{hp.description}</p>
                        </div>

                        {isSupported ? (
                          <button
                            disabled={isDiscovered}
                            onClick={() => handleDiscoverHiddenPlace(hp.id, hp.name)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                              isDiscovered
                                ? 'bg-zinc-900 text-sky-400 border-zinc-800'
                                : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-500/40'
                            }`}
                          >
                            {isDiscovered ? 'Odkryto' : 'Zbadaj Sekret'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-zinc-500 italic">
                            Nieaktywne w runtime
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-2">
                  Globalny Rejestr Odkrytych Sławnych Lokacji ({discoveredFamousCount}/16)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_FAMOUS_LOCATIONS_V2.map((loc) => {
                    const disc = isLocationDiscovered(save, loc.id);
                    return (
                      <div
                        key={loc.id}
                        className={`p-2 rounded border text-xs ${
                          disc
                            ? 'bg-sky-950/30 border-sky-500/40 text-sky-200'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                        }`}
                      >
                        <div className="font-mono text-[10px]">{loc.mapPointId}</div>
                        <div className="font-semibold truncate">{loc.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Log ostatnich działań eksploracyjnych */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Kronika Przebiegu Rozgrywki (Live Event Log)
            </div>
            <div className="space-y-1 text-xs font-mono text-zinc-300 max-h-28 overflow-y-auto">
              {actionLog.map((entry, i) => (
                <div key={i} className={i === 0 ? 'text-amber-300 font-semibold' : 'text-zinc-400'}>
                  • {entry}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PRAWA KOLUMNA (5/12): DZIENNIK QUESTÓW (QUEST JOURNAL) */}
        <div className="xl:col-span-5 bg-zinc-900/95 border border-zinc-800 rounded-xl p-4 flex flex-col h-full">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-white">Dziennik Questów World V2</h3>
                <p className="text-xs text-zinc-400">
                  106 przygód: Kampanie Główne, Poboczne, Ukryte i Międzykontynentalne
                </p>
              </div>
            </div>
          </div>

          {/* Filtry Dziennika */}
          <div className="flex flex-wrap gap-1.5 my-3">
            {[
              { id: 'active', label: 'Aktywne' },
              { id: 'available', label: 'Dostępne' },
              { id: 'hidden', label: `Ukryte (${hiddenLockedCount} tajnych)` },
              { id: 'intercontinental', label: 'Międzykontynentalne (10)' },
              { id: 'completed', label: 'Ukończone' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setJournalFilter(tab.id as typeof journalFilter)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  journalFilter === tab.id
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Lista zadań */}
          <div className="space-y-3 overflow-y-auto max-h-[760px] pr-1">
            {journalFilter === 'hidden' && hiddenLockedCount > 0 && (
              <div className="bg-purple-950/20 border border-purple-500/30 rounded-lg p-3 text-xs text-purple-200">
                Na kontynencie <b>{continentData.name}</b> pozostaje jeszcze{' '}
                <b>{hiddenLockedCount}</b> ukrytych przygód. Odblokujesz je odkrywając Sławne
                Lokacje, zdobywając rzadkie przedmioty lub kończąc kluczowe wątki.
              </div>
            )}

            {filteredQuests.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-500">
                Brak zadań w wybranej zakładce dla kontynentu {continentData.name}. Przełącz na
                „Dostępne”, aby rozpocząć nową przygodę.
              </div>
            ) : (
              filteredQuests.map((quest) => {
                const rec = save.quests[quest.id];
                const state = rec?.state ?? 'unavailable';
                const currentStage =
                  quest.stages[rec?.currentStageIndex ?? 0] ?? quest.stages[0];
                const isTracked = save.trackedQuestId === quest.id;

                const catBadge: Record<QuestCategory, string> = {
                  main: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                  side: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                  hidden: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                  intercontinental: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
                };

                return (
                  <div
                    key={quest.id}
                    className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                      isTracked
                        ? 'bg-zinc-950 border-amber-500/60 ring-1 ring-amber-500/30'
                        : 'bg-zinc-950/75 border-zinc-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-amber-400">
                            [{quest.id}]
                          </span>
                          <span
                            className={`text-[10px] uppercase px-2 py-0.5 rounded border font-semibold ${catBadge[quest.category]}`}
                          >
                            {quest.category === 'main'
                              ? 'Główne'
                              : quest.category === 'side'
                                ? 'Poboczne'
                                : quest.category === 'hidden'
                                  ? 'Ukryte'
                                  : 'Międzykontynentalne'}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            Lv.{quest.recommendedLevel} • NPC: <b>{quest.giverName}</b>
                          </span>
                          {quest.repeatable && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 flex items-center gap-1">
                              <RefreshCw className="w-2.5 h-2.5" /> Powtarzalne
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">{quest.title}</h4>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!quest.playableInCurrentRuntime ? (
                          <span className="text-[10px] px-2 py-1 rounded bg-rose-950/60 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Dane Przyszłego Etapu
                          </span>
                        ) : state === 'available' ? (
                          <button
                            onClick={() => {
                              const next = startQuest(save, quest.id);
                              onUpdateSave(next);
                              pushLog(`Rozpoczęto zadanie: [${quest.id}] ${quest.title}`);
                            }}
                            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold cursor-pointer"
                          >
                            Rozpocznij
                          </button>
                        ) : state === 'active' ? (
                          <button
                            onClick={() => onUpdateSave({ ...save, trackedQuestId: quest.id })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                              isTracked
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                            }`}
                          >
                            {isTracked ? 'Śledzone ★' : 'Śledź'}
                          </button>
                        ) : state === 'completed' && quest.repeatable ? (
                          <button
                            onClick={() => {
                              const next = startQuest(save, quest.id);
                              onUpdateSave(next);
                              pushLog(`Ponowiono zlecenie: [${quest.id}] ${quest.title}`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold cursor-pointer"
                          >
                            Powtórz zlecenie
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed">{quest.summary}</p>

                    {!quest.playableInCurrentRuntime && quest.runtimeLimitationNote && (
                      <div className="bg-amber-950/30 border border-amber-500/30 rounded p-2 text-[11px] text-amber-200">
                        <b>Wymaganie silnika:</b> {quest.runtimeLimitationNote}
                      </div>
                    )}

                    {/* Cele bieżącego etapu */}
                    {currentStage && (
                      <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-lg p-2.5 space-y-1.5">
                        <div className="text-[11px] font-semibold text-amber-300 flex items-center justify-between">
                          <span>
                            Etap {(rec?.currentStageIndex ?? 0) + 1}/{quest.stages.length}:{' '}
                            {currentStage.title}
                          </span>
                          {rec && rec.completionCount > 0 && (
                            <span className="text-emerald-400">
                              Ukończono {rec.completionCount}×
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {currentStage.objectives.map((obj) => {
                            const count =
                              state === 'completed'
                                ? obj.targetCount
                                : rec?.objectiveProgress[obj.id] ?? 0;
                            const done = count >= obj.targetCount;
                            return (
                              <div
                                key={obj.id}
                                className="flex items-center justify-between text-xs gap-2"
                              >
                                <span
                                  className={
                                    done ? 'text-emerald-400 line-through' : 'text-zinc-200'
                                  }
                                >
                                  • {obj.description}
                                </span>
                                <span
                                  className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                                    done
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-zinc-800 text-zinc-300'
                                  }`}
                                >
                                  {count}/{obj.targetCount}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Nagrody */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-zinc-400">
                      <div className="flex items-center gap-2">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          Nagroda: <b className="text-zinc-200">+{quest.reward.xp} XP</b>,{' '}
                          <b className="text-yellow-300">+{quest.reward.coins} monet</b>
                          {quest.reward.itemId && (
                            <span className="ml-1 text-emerald-300">
                              • {quest.reward.itemCount ?? 1}× {quest.reward.itemId}
                              {quest.reward.plannedFutureItemId
                                ? ` (plan: ${quest.reward.plannedFutureItemId})`
                                : ''}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
