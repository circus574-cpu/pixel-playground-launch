import React, { useState } from 'react';
import {
  Sparkles,
  Shield,
  Sword,
  Zap,
  Maximize2,
  Layers,
  Sliders,
  CheckCircle2,
  Flame,
  Wind,
  Cpu,
  Leaf,
} from 'lucide-react';
import { ContinentId } from '../game/worlds/types';
import { RACE_CORE_MECHANICS, SKILL_TREES_BY_RACE } from '../data/skillTrees';

const RACE_VISUALS: Record<
  ContinentId,
  {
    name: string;
    heroSprite: string;
    bgArt: string;
    primaryHex: string;
    borderClass: string;
    badgeClass: string;
    glowClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  verdant: {
    name: 'Planetarni — Verdantia',
    heroSprite: '/art/production/heroes/verdant/painted-v1/idle.png',
    bgArt: '/art/candidates/anime-v1/01-verdantia-clearing.png',
    primaryHex: '#10b981',
    borderClass: 'border-emerald-500/50',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    glowClass: 'shadow-emerald-500/20',
    icon: Leaf,
  },
  pyra: {
    name: 'Legendy — Pyra',
    heroSprite: '/art/production/heroes/pyra/painted-v1/idle.png',
    bgArt: '/art/candidates/anime-v1/02-verdantia-shrine.png',
    primaryHex: '#f97316',
    borderClass: 'border-orange-500/50',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    glowClass: 'shadow-orange-500/20',
    icon: Flame,
  },
  aether: {
    name: 'Mędrcy — Aetheria',
    heroSprite: '/art/production/heroes/aether/painted-v1/idle.png',
    bgArt: '/art/candidates/anime-v1/03-verdantia-stream.png',
    primaryHex: '#38bdf8',
    borderClass: 'border-sky-500/50',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    glowClass: 'shadow-sky-500/20',
    icon: Wind,
  },
  nexus: {
    name: 'Androidy — Nexus-9',
    heroSprite: '/art/production/heroes/nexus/painted-v1/idle.png',
    bgArt: '/art/candidates/anime-v1/04-verdantia-canopy-road.png',
    primaryHex: '#d946ef',
    borderClass: 'border-fuchsia-500/50',
    badgeClass: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
    glowClass: 'shadow-fuchsia-500/20',
    icon: Cpu,
  },
};

export const HudShowcase: React.FC = () => {
  const [selectedRace, setSelectedRace] = useState<ContinentId>('verdant');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('V-ZENIT');

  const vis = RACE_VISUALS[selectedRace];
  const core = RACE_CORE_MECHANICS[selectedRace];
  const nodes = SKILL_TREES_BY_RACE[selectedRace];
  const activeNode = nodes.find((n) => n.id === selectedNodeId) || nodes[nodes.length - 1];
  const RaceIcon = vis.icon;

  const handleRaceSwitch = (r: ContinentId) => {
    setSelectedRace(r);
    const prefix = r === 'verdant' ? 'V' : r === 'pyra' ? 'P' : r === 'aether' ? 'A' : 'N';
    setSelectedNodeId(`${prefix}-ZENIT`);
  };

  return (
    <div className="space-y-8">
      {/* Nagłówek i przełącznik motywu rasy */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            Wizualne Plansze Koncepcyjne & Makiety HUD/UI (Styl Ciemny Anime RPG)
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Dynamiczny Interfejs KI Legends — 3 Plansze Projektowe z Zasobami Produkcyjnymi
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Przełącz rasę poniżej, aby zobaczyć dynamiczny kolor HUD-u, portret bohatera
            (`painted-v1`), rdzeń bojowy oraz szuflady boczne `[K]` (29 węzłów) i `[I]` (7 slotów).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['verdant', 'pyra', 'aether', 'nexus'] as ContinentId[]).map((r) => {
            const rv = RACE_VISUALS[r];
            const Icon = rv.icon;
            return (
              <button
                key={r}
                onClick={() => handleRaceSwitch(r)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  selectedRace === r
                    ? `${rv.badgeClass} ring-1 ring-white/20`
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {rv.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          PLANSZA 1: GŁÓWNY HUD BOJOWY ANIME RPG (ARENA + KOMPAS + SZUFLADY)
      ===================================================================== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            Plansza 1: Główny HUD Bojowy i Eksploracyjny (Kamera Oddalona + Pełny Ekran + Szybkie Szuflady)
          </h3>
          <span className="text-xs text-zinc-400 font-mono">16:9 Live Render Board</span>
        </div>

        <div
          className={`relative w-full aspect-[16/9] min-h-[420px] rounded-2xl border-2 ${vis.borderClass} overflow-hidden bg-zinc-950 shadow-2xl`}
        >
          {/* Tło lasu anime-v1 z przyciemnieniem */}
          <img
            src={vis.bgArt}
            alt="Tło Świata"
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/35 to-zinc-950/75" />

          {/* GÓRNY LEWY RÓG: Ramka Bohatera + Paski HP / KI / Miernik Rdzenia Rasy */}
          <div className="absolute top-4 left-4 bg-zinc-950/90 backdrop-blur-md border border-zinc-700/80 rounded-xl p-3 flex items-center gap-3.5 w-80 shadow-lg">
            <div
              className={`relative w-16 h-16 rounded-xl border-2 ${vis.borderClass} bg-zinc-900 overflow-hidden shrink-0`}
            >
              <img
                src={vis.heroSprite}
                alt={vis.name}
                className="w-full h-full object-contain scale-125"
              />
              <span className="absolute bottom-0 right-0 px-1.5 py-0.2 bg-zinc-950 text-[10px] font-black text-amber-300 border-t border-l border-zinc-700">
                Lv.20
              </span>
            </div>

            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{vis.name}</span>
                <span className="text-[10px] font-mono text-emerald-400">SPEED 195</span>
              </div>

              {/* Pasek HP */}
              <div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-300 mb-0.5">
                  <span>HP (Życie)</span>
                  <span>
                    {core.statsLv20.hp} / {core.statsLv20.hp}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 w-full" />
                </div>
              </div>

              {/* Pasek KI */}
              <div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-300 mb-0.5">
                  <span>KI (+{core.statsLv20.kiRegen}/s)</span>
                  <span>
                    {core.statsLv20.ki} / {core.statsLv20.ki}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-sky-600 to-cyan-300 w-4/5" />
                </div>
              </div>

              {/* Unikalny Miernik Rdzenia Rasy */}
              <div className="pt-0.5 flex items-center justify-between text-[10px]">
                <span className="text-amber-300 font-semibold truncate">{core.coreName}</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                  MAX STACK
                </span>
              </div>
            </div>
          </div>

          {/* GÓRNY ŚRODEK: Kompas Śledzonego Zadania + Wskaźnik Strefy */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-950/90 backdrop-blur-md border border-amber-500/40 rounded-xl px-4 py-2 text-center hidden md:block">
            <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">
              Śledzony Cel • 180m na Północny-Wschód
            </div>
            <div className="text-xs font-bold text-white">
              [O-V04] Szepty przy Starym Moście — Odkryj Most Splątanych Korzeni (bridge-6)
            </div>
          </div>

          {/* GÓRNY PRAWY RÓG: Przyciski Szybkich Szuflad [K], [I], [J] oraz Fullscreen HUD */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <div className="bg-zinc-950/90 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <span>[K]</span> Drzewko 29 Węzłów
            </div>
            <div className="bg-zinc-950/90 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <span>[I]</span> Ekwipunek (7)
            </div>
            <div className="bg-zinc-950/90 border border-zinc-700 rounded-lg p-1.5 text-zinc-200">
              <Maximize2 className="w-4 h-4" />
            </div>
          </div>

          {/* ŚRODEK SCENY: Wizualizacja Walki Bohatera + Floating Combat Text + Znacznik NPC */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative flex items-center gap-20">
              {/* Bohater */}
              <div className="relative flex flex-col items-center">
                <div className="px-2.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-[11px] font-bold text-emerald-300 mb-1">
                  +Tarcza Kory (120)
                </div>
                <img
                  src={vis.heroSprite}
                  alt="Hero"
                  className="w-28 h-28 object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                />
                <div className="text-xs font-bold text-white bg-zinc-950/80 px-2 py-0.5 rounded mt-1">
                  Adept KI (Ty)
                </div>
              </div>

              {/* Efekt uderzenia i Floating Combat Text */}
              <div className="flex flex-col items-center">
                <div className="text-2xl font-black text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] animate-pulse">
                  KRYT! -284 KI
                </div>
                <div className="text-xs font-bold text-rose-400 bg-zinc-950/90 px-2 py-0.5 rounded border border-rose-500/40 mt-1">
                  Status: Korzenie (2.0s) + Podpalenie
                </div>
              </div>

              {/* Cel / Boss */}
              <div className="relative flex flex-col items-center">
                <div className="w-32 bg-zinc-950/90 border border-rose-500/50 rounded p-1 mb-1">
                  <div className="text-[10px] font-bold text-rose-300 flex justify-between">
                    <span>Pradawny Drzewiec</span>
                    <span>Lv.12</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded overflow-hidden mt-0.5">
                    <div className="h-full bg-rose-500 w-3/5" />
                  </div>
                </div>
                <img
                  src="/art/production/enemies/verdant/painted-v1/pradawny-drzewiec.png"
                  alt="Enemy"
                  className="w-28 h-28 object-contain drop-shadow-[0_0_20px_rgba(244,63,94,0.45)]"
                />
              </div>
            </div>
          </div>

          {/* DOLNY PASEK UMIEJĘTNOŚCI (ACTION BAR) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-950/95 backdrop-blur-md border border-zinc-700/90 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-2xl">
            {[
              { key: 'LPM', name: 'Atak Podstawowy', desc: '100% ATK', cd: 'Gotowe' },
              {
                key: 'Q',
                name: core.activeSkillName,
                desc: 'Umiejętność Rdzenia Rasy',
                cd: `${core.activeSkillCooldownSec}s`,
                highlight: true,
              },
              { key: 'E', name: 'Technika Gałęzi I', desc: 'Węzeł Stopnia 3', cd: '4s' },
              { key: 'R', name: 'Arcymistrzostwo', desc: 'Węzeł Stopnia 6', cd: '12s' },
              { key: '1', name: 'Mikstura Żywicy', desc: '+85 HP', cd: 'x4' },
            ].map((slot) => (
              <div
                key={slot.key}
                className={`w-28 p-2 rounded-xl border text-left ${
                  slot.highlight
                    ? `${vis.badgeClass} ring-1 ring-white/20`
                    : 'bg-zinc-900/90 border-zinc-800 text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="px-1.5 py-0.2 rounded bg-zinc-950 text-amber-300 font-bold">
                    [{slot.key}]
                  </span>
                  <span className="text-zinc-400">{slot.cd}</span>
                </div>
                <div className="text-xs font-bold truncate mt-1">{slot.name}</div>
                <div className="text-[10px] text-zinc-400 truncate">{slot.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================================
          PLANSZA 2 & 3: SZUFLADA DRZEWKA 29 WĘZŁÓW ORAZ SZUFLADA EKWIPUNKU 7 SLOTÓW
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PLANSZA 2: INTERAKTYWNA MAKIETA DRZEWKA 29 WĘZŁÓW (7/12) */}
        <div className="lg:col-span-7 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Plansza 2: Szuflada Boczna [K] — Bez Przerywania Walki
              </span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RaceIcon className="w-4 h-4 text-amber-400" />
                Drzewko 29 Węzłów ({vis.name}): 4 Gałęzie × 6 Stopni + 5 Węzłów Mostowych
              </h3>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-950 text-emerald-300 border border-zinc-800">
              29 / 29 Węzłów Kanonicznych
            </span>
          </div>

          {/* Siatka 4 gałęzi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((branchNum) => {
              const branchNodes = nodes.filter(
                (n) => n.branch === branchNum && n.type !== 'bridge' && !n.id.endsWith('ZENIT'),
              );
              return (
                <div
                  key={branchNum}
                  className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 space-y-2"
                >
                  <div className="text-xs font-bold text-amber-300 flex justify-between">
                    <span>
                      Gałąź {branchNum}: {branchNodes[0]?.branchName}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">6 węzłów</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {branchNodes.map((node) => {
                      const isSel = selectedNodeId === node.id;
                      return (
                        <button
                          key={node.id}
                          onClick={() => setSelectedNodeId(node.id)}
                          className={`h-9 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                            isSel
                              ? `${vis.badgeClass} ring-2 ring-white/40`
                              : node.type === 'keystone'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : node.type === 'active'
                                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                  : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                          }`}
                          title={node.name}
                        >
                          T{node.tier}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 5 Węzłów Mostowych + Korona Przebudzenia (Węzeł 29) */}
          <div className="bg-zinc-950/90 border border-amber-500/30 rounded-xl p-3 space-y-2">
            <div className="text-xs font-bold text-amber-300">
              5 Węzłów Mostowych i Szczytowych (Łączenie Ścieżek — Węzły 25..29):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {nodes
                .filter((n) => n.type === 'bridge' || n.id.endsWith('ZENIT'))
                .map((bNode) => (
                  <button
                    key={bNode.id}
                    onClick={() => setSelectedNodeId(bNode.id)}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      selectedNodeId === bNode.id
                        ? 'bg-amber-500/25 text-amber-200 border-amber-400 ring-1 ring-amber-400'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-amber-400">{bNode.id}</div>
                    <div className="text-xs font-bold truncate">{bNode.name}</div>
                  </button>
                ))}
            </div>
          </div>

          {/* Szczegóły wybranego węzła */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-mono text-amber-400">
                Węzeł [{activeNode.id}] • Typ: {activeNode.type.toUpperCase()}
              </div>
              <div className="text-sm font-bold text-white">{activeNode.name}</div>
              <div className="text-xs text-zinc-300 mt-0.5">{activeNode.effectSummary}</div>
            </div>
            <div className="text-xs font-mono text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
              Wymaga: {activeNode.parentIds.length ? activeNode.parentIds.join(', ') : 'Start gałęzi'}
            </div>
          </div>
        </div>

        {/* PLANSZA 3: SZUFLADA EKWIPUNKU (7 SLOTÓW) I TABELA PROGRESJI LV 1-20 (5/12) */}
        <div className="lg:col-span-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
              Plansza 3: Szuflada Ekwipunku [I] & Model Obrażeń (Aneks 22.10.2026)
            </span>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
              <Sliders className="w-4 h-4 text-sky-400" />7 Slotów Ekwipunku + Statystyki Lv.1 → Lv.20
            </h3>
          </div>

          {/* 7 Slotów Ekwipunku */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { slot: '1. Broń (Weapon)', item: 'Ostrze Żywego Korzenia (sword)', stat: '+28 ATK' },
              { slot: '2. Pancerz (Armor)', item: 'Zbroja Kory Strażnika (vest)', stat: '+34 OBR' },
              { slot: '3. Hełm (Helm)', item: 'Korona Świtu KI', stat: '+65 HP, +20 KI' },
              { slot: '4. Buty (Boots)', item: 'Nagolenniki Wiatru', stat: '+10% Ruchu' },
              { slot: '5. Relikt (Relic)', item: 'Kamerton Siedmiu Oktaw', stat: '+18 Mocy KI' },
              { slot: '6. Pierścień (Ring)', item: 'Sygnet Kalderionu', stat: '+6% Kryt' },
              {
                slot: '7. Rdzeń KI (Core)',
                item: `${core.coreName}`,
                stat: 'Pasyw + Aktyw Rasy',
              },
            ].map((eq, i) => (
              <div
                key={i}
                className="bg-zinc-950/90 border border-zinc-800 rounded-lg p-2.5 flex flex-col justify-between"
              >
                <div className="text-[10px] uppercase text-zinc-400 font-semibold">{eq.slot}</div>
                <div className="text-xs font-bold text-white truncate mt-0.5">{eq.item}</div>
                <div className="text-[11px] font-mono text-emerald-400 mt-0.5">{eq.stat}</div>
              </div>
            ))}
          </div>

          {/* Tabela Porównawcza Lv.1 vs Lv.20 + Formuła Obrażeń */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-2.5 text-xs">
            <div className="font-bold text-amber-300 flex items-center justify-between">
              <span>Kanoniczna Tabela Statystyk ({vis.name})</span>
              <span className="font-mono text-[10px] text-zinc-400">Aneks 22.10.2026</span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-[11px] border-b border-zinc-800 pb-1 text-zinc-400">
              <span>Parametr</span>
              <span>Poziom 1</span>
              <span>Poziom 20</span>
            </div>
            {[
              { label: 'HP (Życie)', v1: core.baseStatsLv1.hp, v20: core.statsLv20.hp },
              { label: 'KI / Regen', v1: `${core.baseStatsLv1.ki} (+${core.baseStatsLv1.kiRegen})`, v20: `${core.statsLv20.ki} (+${core.statsLv20.kiRegen})` },
              { label: 'ATK / Moc KI', v1: `${core.baseStatsLv1.atk} / ${core.baseStatsLv1.kiPower}`, v20: `${core.statsLv20.atk} / ${core.statsLv20.kiPower}` },
              { label: 'OBR / ODP', v1: `${core.baseStatsLv1.def} / ${core.baseStatsLv1.res}`, v20: `${core.statsLv20.def} / ${core.statsLv20.res}` },
              { label: 'Szybkość (+5%/lv)', v1: core.baseStatsLv1.speed, v20: core.statsLv20.speed },
            ].map((row, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2 font-mono text-xs">
                <span className="text-zinc-300">{row.label}</span>
                <span className="text-zinc-400">{row.v1}</span>
                <span className="text-emerald-300 font-bold">{row.v20}</span>
              </div>
            ))}

            <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-200 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Wzór Redukcji Obrażeń: <code className="text-amber-300">100 / (100 + OBR_ef)</code>
              </div>
              <div>
                Przebicie pancerza i odporności jest ograniczone do maks. <b>40%</b>, a szansa
                krytyczna do maks. <b>50%</b> (mnożnik 1.50×).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
