import React, { useState } from 'react';
import { HERO_RACES, HeroRace } from '../data/heroes';
import { RACE_SKILL_TREES, getBaseStatsAtLevel } from '../data/progression';
import {
  Shield,
  Zap,
  Heart,
  Swords,
  Sparkles,
  Flame,
  Crosshair,
  Award,
  Layers,
  Eye,
  Lock,
  Check,
  RotateCcw,
  X,
} from 'lucide-react';

interface HudShowcaseModalProps {
  initialRaceId?: HeroRace['id'];
  onClose?: () => void;
  embedded?: boolean;
}

export const HudShowcaseModal: React.FC<HudShowcaseModalProps> = ({
  initialRaceId = 'planetary',
  onClose,
  embedded = false,
}) => {
  const [previewRaceId, setPreviewRaceId] = useState<HeroRace['id']>(initialRaceId);
  const [activeBoard, setActiveBoard] = useState<'combat_hud' | 'skill_tree' | 'equipment'>('combat_hud');
  const [simulatedResource, setSimulatedResource] = useState<number>(76);
  const [simulatedShield, setSimulatedShield] = useState<boolean>(true);
  const [simulatedUlt, setSimulatedUlt] = useState<boolean>(false);

  const hero = HERO_RACES.find((h) => h.id === previewRaceId) || HERO_RACES[0];
  const treeSpec = RACE_SKILL_TREES[previewRaceId];
  const statsLv14 = getBaseStatsAtLevel(previewRaceId, 14);

  const raceTheme = {
    planetary: {
      border: 'border-emerald-500/60',
      glow: 'shadow-emerald-500/20',
      bgAccent: 'bg-emerald-500',
      textAccent: 'text-emerald-400',
      badgeBg: 'bg-emerald-950/80',
      resourceLabel: 'SERIA CIOSU SZLAKU (3-HIT ×1.3)',
      resourceSub: 'Adaptacja (Las): +30% Reg. Ki',
    },
    sage: {
      border: 'border-amber-500/60',
      glow: 'shadow-amber-500/20',
      bgAccent: 'bg-amber-500',
      textAccent: 'text-amber-400',
      badgeBg: 'bg-amber-950/80',
      resourceLabel: 'AKTYWNE KRĘGI ŚWIATŁA (5.0s)',
      resourceSub: 'Wrogowie w kręgu: −40% Ruchu · −10% DMG',
    },
    android: {
      border: 'border-cyan-500/60',
      glow: 'shadow-cyan-500/20',
      bgAccent: 'bg-cyan-500',
      textAccent: 'text-cyan-400',
      badgeBg: 'bg-cyan-950/80',
      resourceLabel: `ŁADUNEK RDZENIA (${simulatedResource} / 100)`,
      resourceSub: simulatedResource >= 100 ? 'PRZEGRZANIE! (2.0s blokady)' : 'Wyładowanie C1: ×' + (1 + simulatedResource / 50).toFixed(2) + ' DMG',
    },
    legend: {
      border: 'border-rose-500/60',
      glow: 'shadow-rose-500/20',
      bgAccent: 'bg-rose-500',
      textAccent: 'text-rose-400',
      badgeBg: 'bg-rose-950/80',
      resourceLabel: `ŻAR PYRY (${simulatedResource} / 100)`,
      resourceSub: `Premia Obrażeń: +${(simulatedResource * 0.1).toFixed(1)}% · Ostatni Płomień Gotowy`,
    },
  }[previewRaceId];

  return (
    <div className={embedded ? 'space-y-6' : 'fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto'}>
      <div className={`w-full max-w-6xl bg-stone-950 border border-stone-800 rounded-2xl overflow-hidden shadow-2xl ${embedded ? '' : 'my-auto'}`}>
        {/* Top Studio Control Header */}
        <div className="px-6 py-4 bg-stone-900/90 border-b border-stone-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-emerald-400">
              WZORNIK GRAFICZNY HUD / UI · CIEMNY STYL ANIME RPG
            </div>
            <h3 className="text-xl font-bold text-white mt-0.5">
              Wizualizacja Interfejsu Bojowego Ki Legends (Etap 2)
            </h3>
          </div>

          {/* Board Switcher */}
          <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
            <button
              onClick={() => setActiveBoard('combat_hud')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeBoard === 'combat_hud'
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              1. Zdjęcie HUD Walki (60° Top-Down)
            </button>
            <button
              onClick={() => setActiveBoard('skill_tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeBoard === 'skill_tree'
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              2. Makieta Drzewka 29 Węzłów
            </button>
            <button
              onClick={() => setActiveBoard('equipment')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeBoard === 'equipment'
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              3. Makieta Ekwipunku i Matematyki
            </button>
          </div>

          {/* Race Theme Selector */}
          <div className="flex items-center gap-1.5">
            {HERO_RACES.map((r) => (
              <button
                key={r.id}
                onClick={() => setPreviewRaceId(r.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                  previewRaceId === r.id
                    ? 'bg-stone-800 text-white border-stone-600'
                    : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-white'
                }`}
                style={previewRaceId === r.id ? { borderColor: r.accentColor } : undefined}
              >
                {r.polishName}
              </button>
            ))}
            {onClose && (
              <button
                onClick={onClose}
                className="ml-2 p-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-700 cursor-pointer"
                title="Zamknij podgląd"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* BOARD 1: FULL ANIME RPG IN-GAME COMBAT HUD MOCKUP OVER REAL SCENE */}
        {activeBoard === 'combat_hud' && (
          <div className="p-6 space-y-4">
            {/* Interactive HUD State Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-stone-900/60 border border-stone-800/80 px-4 py-2.5 rounded-xl text-xs">
              <div className="flex items-center gap-3 text-stone-300">
                <span className="font-semibold text-white">Symulacja Stanów HUD:</span>
                <span>Zasób rasy ({simulatedResource}%):</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={simulatedResource}
                  onChange={(e) => setSimulatedResource(Number(e.target.value))}
                  className="w-28 accent-emerald-500 cursor-pointer"
                />
                <button
                  onClick={() => setSimulatedShield((v) => !v)}
                  className={`px-2.5 py-1 rounded border font-mono cursor-pointer ${
                    simulatedShield ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300' : 'bg-stone-950 border-stone-800 text-stone-500'
                  }`}
                >
                  Warstwa Tarczy: {simulatedShield ? 'AKTYWNA (+18%)' : 'BRAK'}
                </button>
                <button
                  onClick={() => setSimulatedUlt((v) => !v)}
                  className={`px-2.5 py-1 rounded border font-mono cursor-pointer ${
                    simulatedUlt ? 'bg-amber-950/70 border-amber-500/60 text-amber-300' : 'bg-stone-950 border-stone-800 text-stone-500'
                  }`}
                >
                  Forma Poz. 20 [T]: {simulatedUlt ? 'AKTYWNA' : 'GOTOWA'}
                </button>
              </div>
              <div className="text-stone-400 font-mono">
                Kamera: 60° Ortho Top-Down · Kontur Anime · Dynamiczny Akcent: <span style={{ color: hero.accentColor }}>{hero.polishName}</span>
              </div>
            </div>

            {/* 16:9 HIGH-RESOLUTION VISUAL HUD FRAME OVER REAL ANIME WORLD ASSETS */}
            <div
              className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border-2 border-stone-800 shadow-2xl select-none"
              style={{
                backgroundImage: 'url(/art/candidates/anime-v1/grass-seamless-256.png)',
                backgroundRepeat: 'repeat',
                backgroundSize: '180px 180px',
              }}
            >
              {/* Subtle atmospheric lighting vignette */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/70 pointer-events-none" />

              {/* WORLD SCENE PROPS (Cottage + Oak Topdown from anime-v1) */}
              <img
                src="/art/candidates/anime-v1/cottage.webp"
                alt="Verdant Cottage"
                referrerPolicy="no-referrer"
                className="absolute top-[10%] left-[26%] w-52 h-52 object-contain drop-shadow-2xl pointer-events-none"
              />
              <img
                src="/art/candidates/anime-v1/oak-topdown.webp"
                alt="Verdant Oak"
                referrerPolicy="no-referrer"
                className="absolute top-[14%] right-[24%] w-48 h-48 object-contain drop-shadow-2xl pointer-events-none"
              />

              {/* SAGE LIGHT CIRCLE / AURA EFFECT ON GROUND */}
              {previewRaceId === 'sage' && (
                <div className="absolute top-[48%] left-[44%] -translate-x-1/2 -translate-y-1/2 w-56 h-36 rounded-full border-2 border-amber-400/70 bg-amber-400/15 shadow-[0_0_40px_rgba(245,158,11,0.35)] pointer-events-none flex items-center justify-center">
                  <div className="w-44 h-28 rounded-full border border-dashed border-amber-300/60" />
                </div>
              )}

              {/* HERO SPRITE IN CENTER-LEFT */}
              <div className="absolute top-[50%] left-[44%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
                {/* Level 20 Transformation Aura if toggled */}
                {simulatedUlt && (
                  <div
                    className="absolute -inset-6 rounded-full opacity-45 blur-md"
                    style={{ backgroundColor: hero.accentColor }}
                  />
                )}
                {/* Floating Crit/Combo Combat Text */}
                <div className="mb-1 px-2 py-0.5 rounded bg-stone-950/90 border border-amber-400/70 text-[11px] font-mono font-bold text-amber-300 shadow-lg">
                  {previewRaceId === 'planetary' && '3. CIOS SZLAKU! ×1.3 (CRIT -86)'}
                  {previewRaceId === 'sage' && 'KRĄG SPOWOLNIENIA −40%'}
                  {previewRaceId === 'android' && `NAMIERZONY CEL! +15% KRYT`}
                  {previewRaceId === 'legend' && 'PRZEŁAMANIE TARCZY! (OGŁUSZENIE 1.2s)'}
                </div>
                <div className="w-12 h-4 bg-black/55 rounded-full blur-[2px] translate-y-16" />
                <img
                  src={hero.views['down-right']}
                  alt={hero.polishName}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.8)] relative z-10"
                />
              </div>

              {/* TARGETED MONSTER IN CENTER-RIGHT WITH DIRECTIONAL BACKSTAB & TELEGRAPH */}
              <div className="absolute top-[52%] left-[63%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
                {/* Monster Floating Plate */}
                <div className="mb-1.5 bg-stone-950/90 border border-stone-700 px-2.5 py-1 rounded-lg shadow-lg text-center">
                  <div className="text-[10px] font-bold text-white flex items-center gap-1.5">
                    <span>Magmowy Krab</span>
                    <span className="text-amber-400 font-mono">Poz. 8</span>
                  </div>
                  <div className="w-28 bg-stone-800 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-rose-500 h-full w-[65%]" />
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1 text-[9px] font-mono">
                    <span className="text-orange-400">Podpalenie 3s</span>
                    <span>·</span>
                    <span className="text-cyan-300">Znak +10%</span>
                  </div>
                </div>
                {/* Directional Armor / Backstab Arc */}
                <div className="relative w-16 h-16 rounded-full border-2 border-rose-500/70 bg-rose-950/40 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-rose-700 border border-white/60 shadow-inner" />
                  <span className="absolute -bottom-5 text-[9px] font-mono text-emerald-300 bg-stone-950/90 px-1.5 py-0.5 rounded border border-emerald-500/40 whitespace-nowrap">
                    Tył odsłonięty: +40% DMG
                  </span>
                </div>
              </div>

              {/* ========================================================= */}
              {/* TOP-LEFT HUD: ANIME CHARACTER STATUS & CLASS CORE GAUGE   */}
              {/* ========================================================= */}
              <div className={`absolute top-4 left-4 w-80 bg-stone-950/90 backdrop-blur-md border ${raceTheme.border} rounded-xl p-3.5 shadow-2xl`}>
                <div className="flex items-center gap-3">
                  {/* Portrait Box */}
                  <div
                    className="w-14 h-14 rounded-lg bg-stone-900 border-2 overflow-hidden shrink-0 relative flex items-center justify-center"
                    style={{ borderColor: hero.accentColor }}
                  >
                    <img
                      src={hero.views.down}
                      alt={hero.polishName}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-contain"
                    />
                    <span className="absolute bottom-0 right-0 bg-stone-950/95 text-[10px] font-mono font-bold px-1 rounded-tl text-amber-400 border-t border-l border-stone-700">
                      Poz.14
                    </span>
                  </div>

                  {/* Name, Story Rank & XP */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-white truncate">{hero.polishName}</span>
                      <span className="text-[11px] font-mono text-stone-400">Powiernik Głosu</span>
                    </div>

                    {/* HP Bar + Shield Layer */}
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-rose-400 font-bold">HP</span>
                        <span className="text-stone-200 tabular-nums">
                          {statsLv14.hp} / {statsLv14.hp}
                          {simulatedShield && <span className="text-cyan-300 ml-1">(+{Math.round(statsLv14.hp * 0.18)} Tarcza)</span>}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-stone-800 rounded-sm overflow-hidden flex mt-0.5 border border-stone-700/80">
                        <div className="bg-gradient-to-r from-rose-600 to-rose-500 h-full w-[78%]" />
                        {simulatedShield && <div className="bg-cyan-300 h-full w-[22%]" />}
                      </div>
                    </div>

                    {/* KI Bar */}
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-cyan-400 font-bold">KI</span>
                        <span className="text-stone-200 tabular-nums">
                          {statsLv14.ki} / {statsLv14.ki} <span className="text-stone-400">(+{statsLv14.kiRegenPerSec}/s)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-stone-800 rounded-sm overflow-hidden mt-0.5 border border-stone-700/80">
                        <div className="bg-gradient-to-r from-cyan-600 to-sky-400 h-full w-[84%]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* CLASS CORE MECHANIC WIDGET */}
                <div className="mt-3 pt-2.5 border-t border-stone-800/90">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className={`font-bold ${raceTheme.textAccent}`}>{raceTheme.resourceLabel}</span>
                    <span className="text-stone-400 tabular-nums">{statsLv14.attackIntervalMs} ms · {statsLv14.critChancePct}% Kryt</span>
                  </div>

                  {previewRaceId === 'planetary' ? (
                    <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                      <div className="h-2 rounded-sm bg-emerald-500" />
                      <div className="h-2 rounded-sm bg-emerald-500" />
                      <div className="h-2 rounded-sm bg-amber-400 border border-white/60" />
                    </div>
                  ) : (
                    <div className="w-full h-2 bg-stone-800 rounded-sm overflow-hidden mt-1.5 border border-stone-700">
                      <div
                        className="h-full transition-all duration-150"
                        style={{
                          width: `${simulatedResource}%`,
                          backgroundColor: previewRaceId === 'android' && simulatedResource >= 85 ? '#f43f5e' : hero.accentColor,
                        }}
                      />
                    </div>
                  )}
                  <div className="text-[10px] text-stone-400 font-mono mt-1 truncate">
                    {raceTheme.resourceSub}
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* TOP-RIGHT HUD: TARGET / BOSS INSPECTION & WEAKNESS PLATE  */}
              {/* ========================================================= */}
              <div className="absolute top-4 right-4 w-72 bg-stone-950/90 backdrop-blur-md border border-stone-700/90 rounded-xl p-3.5 shadow-2xl">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Magmowy Krab · Pyra</span>
                  <span className="font-mono text-amber-400">Poz. 8</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-stone-300 mt-1">
                  <span>HP: 260 / 396</span>
                  <span>ATK: 25 · DEF: 28</span>
                </div>
                <div className="w-full h-2.5 bg-stone-800 rounded-sm overflow-hidden mt-1 border border-stone-700">
                  <div className="bg-gradient-to-r from-red-600 to-orange-500 h-full w-[65%]" />
                </div>
                <div className="mt-2 pt-2 border-t border-stone-800 space-y-1 text-[10px] font-mono">
                  <div className="text-emerald-300">
                    Słabość: Atak w tył (+40% DMG) · Zimno (+30%)
                  </div>
                  <div className="text-rose-300">
                    Aktywne Statusy: Podpalenie (2.4s) · Oznaczenie (+10% DMG)
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* BOTTOM HUD: ANIME SKILL HOTBAR (R, Q, E, C, T) + POTIONS  */}
              {/* ========================================================= */}
              <div className="absolute bottom-4 inset-x-4 flex flex-wrap items-end justify-between gap-3">
                {/* Left: Quick XP & Movement Speed Readout */}
                <div className="bg-stone-950/90 backdrop-blur-md border border-stone-800 rounded-xl px-3.5 py-2.5 text-[11px] font-mono space-y-1">
                  <div className="text-amber-400 font-bold">
                    XP: 5 980 / 6 860 (Poz. 14 → 15)
                  </div>
                  <div className="text-stone-300">
                    Ruch: <span className="text-emerald-400 font-bold">{statsLv14.moveSpeedUnits} j./s</span> (+65% bazowej)
                  </div>
                </div>

                {/* Center: 5 Main Combat Abilities + 2 Consumables */}
                <div className={`bg-stone-950/95 backdrop-blur-md border ${raceTheme.border} rounded-2xl p-2 flex items-center gap-2 shadow-2xl`}>
                  {[
                    { key: 'SPACJA', code: 'R', node: treeSpec.nodes.find((n) => n.code === 'R')! },
                    { key: 'Q', code: 'A4', node: treeSpec.nodes.find((n) => n.code === 'A4')! },
                    { key: 'E', code: 'B4', node: treeSpec.nodes.find((n) => n.code === 'B4')! },
                    { key: 'C', code: 'C4', node: treeSpec.nodes.find((n) => n.code === 'C4')! },
                    { key: 'T', code: 'T', node: treeSpec.nodes.find((n) => n.code === 'T')! },
                  ].map((slot) => (
                    <div
                      key={slot.key}
                      className={`w-24 rounded-xl p-2 border flex flex-col justify-between ${
                        slot.code === 'T'
                          ? 'bg-amber-950/50 border-amber-500/70'
                          : 'bg-stone-900/90 border-stone-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-stone-950 text-white font-bold border border-stone-700">
                          {slot.key}
                        </span>
                        <span className="text-cyan-300">
                          {slot.node.kiCost > 0 ? `${slot.node.kiCost} Ki` : '0 Ki'}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-white truncate mt-1.5">
                        {slot.node.name}
                      </div>
                      <div className="text-[9px] font-mono text-stone-400 mt-0.5">
                        {slot.node.cooldown}s CD
                      </div>
                    </div>
                  ))}

                  <div className="h-12 w-px bg-stone-800 mx-1" />

                  {/* Consumable Belt Slots */}
                  <div className="w-20 rounded-xl p-2 bg-rose-950/40 border border-rose-700/50 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="px-1 rounded bg-stone-950 text-rose-300 font-bold">1</span>
                      <span className="text-rose-300">6s CD</span>
                    </div>
                    <div className="text-[10px] font-bold text-white truncate mt-1.5">Mikstura HP</div>
                    <div className="text-[9px] font-mono text-stone-400">+45% HP</div>
                  </div>

                  <div className="w-20 rounded-xl p-2 bg-emerald-950/40 border border-emerald-700/50 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="px-1 rounded bg-stone-950 text-emerald-300 font-bold">2</span>
                      <span className="text-emerald-300">30s CD</span>
                    </div>
                    <div className="text-[10px] font-bold text-white truncate mt-1.5">Tonik U-12</div>
                    <div className="text-[9px] font-mono text-stone-400">Oczyszcza</div>
                  </div>
                </div>

                {/* Right: Slide-Over Drawer Quick Triggers */}
                <div className="bg-stone-950/90 backdrop-blur-md border border-stone-800 rounded-xl p-2 flex items-center gap-2 text-xs font-mono">
                  <button
                    onClick={() => setActiveBoard('skill_tree')}
                    className="px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-emerald-300 font-bold cursor-pointer"
                  >
                    [K] Drzewko (29)
                  </button>
                  <button
                    onClick={() => setActiveBoard('equipment')}
                    className="px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-300 font-bold cursor-pointer"
                  >
                    [I] Ekwipunek (7)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOARD 2: 29-NODE SKILL TREE VISUAL ARCHITECTURE */}
        {activeBoard === 'skill_tree' && (
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-stone-900/70 border border-stone-800 p-4 rounded-xl">
              <div>
                <div className="text-xs font-mono text-emerald-400">
                  ARCHITEKTURA DRZEWKA ROZWOJU · {treeSpec.raceName.toUpperCase()} ({treeSpec.worldName})
                </div>
                <div className="text-sm text-stone-300 mt-0.5">
                  29 węzłów (R + 3 gałęzie × 9 węzłów + Transformacja T) · Pary wykluczające na poziomie 13: <span className="text-amber-300 font-mono">A7/A8, B7/B8, C7/C8</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="px-3 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-amber-400 font-bold">
                  Limit Kampanii: 20 / 29 Punktów
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-stone-300">
                  Reset do poz. 10: Darmowy (potem 50 × poz.)
                </span>
              </div>
            </div>

            {/* Root & Apex Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['R', 'T'].map((code) => {
                const node = treeSpec.nodes.find((n) => n.code === code)!;
                return (
                  <div
                    key={code}
                    className={`p-4 rounded-xl border ${
                      code === 'T' ? 'bg-amber-950/25 border-amber-500/50' : 'bg-stone-900/80 border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-white">
                        [{node.code}] {node.name} ({code === 'R' ? 'Zdolność Początkowa Poz. 1' : 'Transformacja Poz. 20'})
                      </span>
                      <span className="text-cyan-300">
                        {node.kiCost} Ki · {node.cooldown}s CD
                      </span>
                    </div>
                    <p className="text-xs text-stone-300 mt-1.5">{node.effectText}</p>
                  </div>
                );
              })}
            </div>

            {/* 3 Branches Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {(['A', 'B', 'C'] as const).map((branchKey) => {
                const branchNodes = treeSpec.nodes.filter((n) => n.branch === branchKey);
                return (
                  <div key={branchKey} className="bg-stone-900/60 border border-stone-800 rounded-xl p-4 space-y-2.5">
                    <div className="text-sm font-bold text-white border-b border-stone-800 pb-2 flex items-center justify-between">
                      <span>{treeSpec.branches[branchKey]}</span>
                      <span className="text-xs font-mono text-stone-400">9 węzłów</span>
                    </div>

                    <div className="space-y-2">
                      {branchNodes.map((n) => {
                        const isExclusive = Boolean(n.excludes);
                        return (
                          <div
                            key={n.code}
                            className={`p-2.5 rounded-lg border text-xs ${
                              isExclusive
                                ? 'bg-amber-950/20 border-amber-600/50'
                                : n.type === 'active'
                                ? 'bg-stone-950 border-stone-700'
                                : 'bg-stone-950/60 border-stone-800/80'
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono">
                              <span className="font-bold text-white">
                                {n.code} · {n.name}
                              </span>
                              <span className="text-[11px] text-stone-400">
                                Poz.{n.levelReq} {n.excludes ? `(Wyklucza ${n.excludes})` : ''}
                              </span>
                            </div>
                            <div className="text-stone-300 mt-1 leading-snug">{n.effectText}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BOARD 3: 7-SLOT EQUIPMENT & COMBAT MATHS VERIFICATION */}
        {activeBoard === 'equipment' && (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-stone-900/60 border border-stone-800 rounded-xl p-5 space-y-4">
              <div className="text-xs font-mono text-amber-400">
                7 SLOTÓW EKWIPUNKU + ULEPSZENIA (+1 / +2 / +3)
              </div>
              <h4 className="text-lg font-bold text-white">
                Struktura Ekwipunku Bojowego (Rozdz. 13–14 Księgi Przygody)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800">
                  <div className="font-mono text-emerald-400 font-bold">1. Broń Rasowa (T1–T6) +1/+2/+3</div>
                  <div className="text-stone-300 mt-1">
                    W-V1..6 / W-A1..6 / W-N1..6 / W-P1..6 (+4 do +34 ATK) oraz 8 broni z własną historią (U-W01..08).
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800">
                  <div className="font-mono text-cyan-400 font-bold">2–6. Pięć Slotów Pancerza (T1–T6) +1/+2</div>
                  <div className="text-stone-300 mt-1">
                    Głowa (A-H), Korpus (A-C), Dłonie (A-G), Nogi (A-L), Stopy (A-B) — łącznie do +27 DEF i +120 HP.
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800">
                  <div className="font-mono text-amber-400 font-bold">7–8. Amulet i Pierścień (J-01..12)</div>
                  <div className="text-stone-300 mt-1">
                    Premie do szansy krytyku (+1% do +2% Kryt. pp), regeneracji Ki (+0,15 do +0,35 KI/s) oraz HP/DEF.
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800">
                  <div className="font-mono text-rose-400 font-bold">Pas Użytkowy (U-01..16)</div>
                  <div className="text-stone-300 mt-1">
                    Mikstury HP (wspólny CD 6 s), Napary Ki, Jedzenie 300 s (+40 HP / +0,25 KI/s) i Toniki oczyszczające (CD 30 s).
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-stone-900/60 border border-stone-800 rounded-xl p-5 space-y-4">
              <div className="text-xs font-mono text-emerald-400">
                PUNKT KONTROLNY MATEMATYKI WALKI (STR. 85 PDF)
              </div>
              <h4 className="text-lg font-bold text-white">
                Weryfikacja Wzoru Obrażeń i Statystyk
              </h4>
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 font-mono text-xs space-y-2 text-stone-300">
                <div>• Wzór: <span className="text-white">DMG = max(1, round(ATK × Mnożnik − 0.5 × DEF))</span></div>
                <div>• Test z Księgi Przygody (Rozdz. 18, str. 85):</div>
                <div className="pl-3 text-emerald-300">
                  Planetarny Poz. 10 (48 ATK) + Broń W-V4 (+21 ATK) = 69 ATK
                </div>
                <div className="pl-3 text-amber-300">
                  Przeciw celowi z 24 DEF: 69 − (0.5 × 24) = 57 obrażeń
                </div>
                <div>• Przyrost szybkości: <span className="text-white">+5% bazowej na poziom do 20</span></div>
                <div>• Próg XP: <span className="text-white">100 + 60 × (L − 1)</span> (Poz. 20 = 12 160 XP)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
