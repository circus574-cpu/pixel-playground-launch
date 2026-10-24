import React, { useState, useEffect } from 'react';
import { HERO_RACES, HeroRace, Direction } from '../data/heroes';
import { 
  Shield, 
  Zap, 
  RotateCw, 
  Play, 
  Pause, 
  Sparkles, 
  Heart, 
  Flame, 
  Cpu, 
  Wind, 
  Crosshair, 
  ChevronRight,
  Info
} from 'lucide-react';

const DIRECTIONS: { key: Direction; label: string; angle: number }[] = [
  { key: 'up', label: 'North', angle: 0 },
  { key: 'up-right', label: 'NE', angle: 45 },
  { key: 'right', label: 'East', angle: 90 },
  { key: 'down-right', label: 'SE', angle: 135 },
  { key: 'down', label: 'South', angle: 180 },
  { key: 'down-left', label: 'SW', angle: 225 },
  { key: 'left', label: 'West', angle: 270 },
  { key: 'up-left', label: 'NW', angle: 315 },
];

interface HeroExplorerProps {
  onSelectForCombat?: (heroId: HeroRace['id']) => void;
}

export const HeroExplorer: React.FC<HeroExplorerProps> = ({ onSelectForCombat }) => {
  const [selectedRaceId, setSelectedRaceId] = useState<HeroRace['id']>('planetary');
  const [currentDirection, setCurrentDirection] = useState<Direction>('down');
  const [isRotating, setIsRotating] = useState(false);
  const [activeAnim, setActiveAnim] = useState<'idle' | 'walk' | 'attack' | 'skill' | 'hit' | 'death'>('walk');
  const [animFrameIndex, setAnimFrameIndex] = useState(0);
  const [isAnimPlaying, setIsAnimPlaying] = useState(true);
  const [viewMode, setViewMode] = useState<'masters' | 'animation' | 'sheet'>('masters');

  const hero = HERO_RACES.find((h) => h.id === selectedRaceId) || HERO_RACES[0];

  // Auto rotation loop
  useEffect(() => {
    if (!isRotating) return;
    const interval = setInterval(() => {
      setCurrentDirection((prev) => {
        const idx = DIRECTIONS.findIndex((d) => d.key === prev);
        const nextIdx = (idx + 1) % DIRECTIONS.length;
        return DIRECTIONS[nextIdx].key;
      });
    }, 450);
    return () => clearInterval(interval);
  }, [isRotating]);

  // Animation frame loop for Planetary motion
  useEffect(() => {
    if (!isAnimPlaying || viewMode !== 'animation' || !hero.motionFrames) return;
    const frames = hero.motionFrames[activeAnim] || [];
    if (frames.length === 0) return;

    const interval = setInterval(() => {
      setAnimFrameIndex((prev) => (prev + 1) % frames.length);
    }, 120);
    return () => clearInterval(interval);
  }, [isAnimPlaying, viewMode, activeAnim, hero]);

  return (
    <div className="space-y-8 text-stone-100">
      {/* Top Banner & Hero Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-emerald-400">
            <Sparkles className="w-4 h-4" />
            Ki Legends Production Masters
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white mt-1">
            Playable Races & Master Renders
          </h2>
          <p className="text-sm text-stone-400 mt-1">
            Inspect the 8-directional sprite masters, combat capabilities, and motion matrices.
          </p>
        </div>

        {onSelectForCombat && (
          <button
            onClick={() => onSelectForCombat(hero.id)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-950/40 transition-all text-white cursor-pointer"
          >
            Deploy {hero.name} to Stage 2
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Race Selector Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {HERO_RACES.map((r) => {
          const isSelected = r.id === selectedRaceId;
          return (
            <button
              key={r.id}
              onClick={() => {
                setSelectedRaceId(r.id);
                if (r.id !== 'planetary' && viewMode === 'animation') {
                  setViewMode('masters');
                }
              }}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-stone-900/90 border-emerald-500/80 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/50'
                  : 'bg-stone-900/40 border-stone-800 hover:border-stone-700 hover:bg-stone-900/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase tracking-widest text-stone-400">
                  {r.homeworld}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: r.accentColor }}
                />
              </div>
              <div className="font-bold text-lg text-white">{r.name}</div>
              <div className="text-xs text-stone-400 mt-0.5">{r.polishName}</div>
              <div className="text-xs text-stone-500 mt-2 line-clamp-1">{r.combatRole}</div>
            </button>
          );
        })}
      </div>

      {/* Hero Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Visual Turntable & Motion Viewer */}
        <div className="lg:col-span-6 bg-stone-900/60 border border-stone-800 rounded-2xl p-6 backdrop-blur-sm">
          {/* View Mode Switcher */}
          <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-6">
            <div className="flex items-center gap-1.5 p-1 bg-stone-950 rounded-lg border border-stone-800/80 text-xs">
              <button
                onClick={() => setViewMode('masters')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'masters'
                    ? 'bg-stone-800 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                8-Direction Turntable
              </button>
              {hero.hasMotionFrames && (
                <button
                  onClick={() => setViewMode('animation')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    viewMode === 'animation'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Motion Frames
                </button>
              )}
              <button
                onClick={() => setViewMode('sheet')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'sheet'
                    ? 'bg-stone-800 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Master Sheet
              </button>
            </div>

            {viewMode === 'masters' && (
              <button
                onClick={() => setIsRotating(!isRotating)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  isRotating
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                    : 'bg-stone-800/80 border-stone-700 text-stone-300 hover:bg-stone-700'
                }`}
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                {isRotating ? 'Auto Orbiting' : 'Auto Rotate'}
              </button>
            )}
          </div>

          {/* Central Character Stage */}
          <div className="relative aspect-square max-h-[380px] w-full mx-auto flex items-center justify-center bg-radial from-stone-800/40 via-stone-950/80 to-stone-950 rounded-xl border border-stone-800 overflow-hidden">
            {/* Grid Floor Effect */}
            <div 
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage: 'radial-gradient(circle at center, #10b981 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            />

            {/* Masters 8-Direction View */}
            {viewMode === 'masters' && (
              <div className="relative z-10 flex flex-col items-center justify-center">
                <img
                  src={hero.views[currentDirection]}
                  alt={`${hero.name} facing ${currentDirection}`}
                  className="max-h-[300px] object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)] filter transition-all duration-150"
                  onError={(e) => {
                    // Fallback to preview gif if direct view fails
                    (e.currentTarget as HTMLImageElement).src = hero.previewGif;
                  }}
                />
                <div className="mt-3 px-3 py-1 bg-stone-900/90 border border-stone-700 rounded-full text-xs font-mono text-emerald-400">
                  Facing: {currentDirection.toUpperCase()}
                </div>
              </div>
            )}

            {/* Motion Frames View */}
            {viewMode === 'animation' && hero.motionFrames && (
              <div className="relative z-10 flex flex-col items-center justify-center">
                <img
                  src={hero.motionFrames[activeAnim][animFrameIndex] || hero.previewGif}
                  alt={`${hero.name} ${activeAnim} animation frame ${animFrameIndex}`}
                  className="max-h-[290px] object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = hero.previewGif;
                  }}
                />
                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-stone-900 border border-stone-700 rounded-full text-xs font-mono text-stone-300">
                    Action: {activeAnim.toUpperCase()}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-700/60 rounded-full text-xs font-mono text-emerald-400">
                    Frame {animFrameIndex + 1}/{hero.motionFrames[activeAnim]?.length || 8}
                  </span>
                </div>
              </div>
            )}

            {/* Master Sheet Full Texture */}
            {viewMode === 'sheet' && (
              <div className="relative z-10 w-full h-full p-4 overflow-auto flex items-center justify-center">
                <img
                  src={hero.masterSheet}
                  alt={`${hero.name} Master Sheet`}
                  className="max-h-full max-w-full object-contain rounded-lg border border-stone-700 shadow-xl"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = hero.previewGif;
                  }}
                />
              </div>
            )}
          </div>

          {/* Direction Controls (Compass) */}
          {viewMode === 'masters' && (
            <div className="mt-6">
              <div className="text-xs text-stone-400 mb-2 font-mono text-center">
                SELECT SPRITE ANGLE
              </div>
              <div className="grid grid-cols-4 gap-2">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => {
                      setIsRotating(false);
                      setCurrentDirection(d.key);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer ${
                      currentDirection === d.key
                        ? 'bg-emerald-900/60 border-emerald-500 text-emerald-200 shadow-sm'
                        : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                    }`}
                  >
                    {d.key}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Animation Controls */}
          {viewMode === 'animation' && hero.motionFrames && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-stone-400 font-mono">ANIMATION SEQUENCE</div>
                <button
                  onClick={() => setIsAnimPlaying(!isAnimPlaying)}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  {isAnimPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isAnimPlaying ? 'Pause' : 'Play'}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['walk', 'attack', 'skill', 'idle', 'hit', 'death'] as const).map((anim) => (
                  <button
                    key={anim}
                    onClick={() => {
                      setActiveAnim(anim);
                      setAnimFrameIndex(0);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-medium capitalize border transition-all cursor-pointer ${
                      activeAnim === anim
                        ? 'bg-emerald-900/60 border-emerald-500 text-emerald-200 shadow-sm'
                        : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                    }`}
                  >
                    {anim}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Lore, Stats & Skills */}
        <div className="lg:col-span-6 space-y-6">
          {/* Header & Lore */}
          <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded bg-stone-800 text-stone-300 text-xs font-mono font-semibold">
                Class: {hero.combatRole}
              </span>
              <span className="px-2.5 py-1 rounded bg-stone-800 text-stone-300 text-xs font-mono font-semibold">
                Origin: {hero.homeworld}
              </span>
            </div>
            <h3 className="text-2xl font-black text-white">{hero.tagline}</h3>
            <p className="text-sm text-stone-300 mt-3 leading-relaxed">{hero.lore}</p>
          </div>

          {/* Combat Attributes */}
          <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 backdrop-blur-sm">
            <h4 className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              Base Combat Profile
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-stone-950/60 p-3.5 rounded-xl border border-stone-800/80">
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                  <Heart className="w-3.5 h-3.5" />
                  Health Pool
                </div>
                <div className="text-2xl font-black text-white mt-1">{hero.baseStats.hp}</div>
                <div className="w-full bg-stone-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full"
                    style={{ width: `${(hero.baseStats.hp / 200) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-stone-950/60 p-3.5 rounded-xl border border-stone-800/80">
                <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium">
                  <Zap className="w-3.5 h-3.5" />
                  Ki Capacity
                </div>
                <div className="text-2xl font-black text-white mt-1">{hero.baseStats.ki}</div>
                <div className="w-full bg-stone-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full rounded-full"
                    style={{ width: `${(hero.baseStats.ki / 180) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-stone-950/60 p-3.5 rounded-xl border border-stone-800/80">
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                  <Flame className="w-3.5 h-3.5" />
                  Base Attack
                </div>
                <div className="text-2xl font-black text-white mt-1">{hero.baseStats.atk}</div>
                <div className="w-full bg-stone-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${(hero.baseStats.atk / 30) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-stone-950/60 p-3.5 rounded-xl border border-stone-800/80">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <Shield className="w-3.5 h-3.5" />
                  Defense
                </div>
                <div className="text-2xl font-black text-white mt-1">{hero.baseStats.def}</div>
                <div className="w-full bg-stone-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${(hero.baseStats.def / 25) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-stone-950/60 p-3.5 rounded-xl border border-stone-800/80">
                <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
                  <Wind className="w-3.5 h-3.5" />
                  Base Speed
                </div>
                <div className="text-2xl font-black text-white mt-1">{hero.baseStats.speed}x</div>
                <div className="w-full bg-stone-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${hero.baseStats.speed * 70}%` }}
                  />
                </div>
              </div>

              <div className="bg-stone-950/60 p-3.5 rounded-xl border border-stone-800/80">
                <div className="flex items-center gap-1.5 text-xs text-purple-400 font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  Ki Regen /s
                </div>
                <div className="text-2xl font-black text-white mt-1">+{hero.baseStats.kiRegen}</div>
                <div className="w-full bg-stone-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full"
                    style={{ width: `${(hero.baseStats.kiRegen / 20) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 p-3 bg-stone-950/40 rounded-xl border border-stone-800 text-xs text-stone-400">
              <Info className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Owner Progression Rule: Movement speed scales +5% base per level up to level 20.</span>
            </div>
          </div>

          {/* Active Skills */}
          <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 backdrop-blur-sm">
            <h4 className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyan-400" />
              Ki Techniques & Keybindings
            </h4>

            <div className="space-y-3">
              {hero.skills.map((skill) => (
                <div
                  key={skill.name}
                  className="p-4 bg-stone-950/60 rounded-xl border border-stone-800 hover:border-stone-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-stone-800 text-white font-mono font-bold text-xs flex items-center justify-center border border-stone-700">
                          {skill.key}
                        </span>
                        <span className="font-bold text-white text-base">{skill.name}</span>
                        <span className="text-xs text-stone-400">({skill.polishName})</span>
                      </div>
                      <p className="text-xs text-stone-300 mt-1.5 leading-relaxed">
                        {skill.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0 ml-4">
                      <div className="text-xs font-mono font-semibold text-cyan-400">
                        {skill.cost} Ki
                      </div>
                      <div className="text-[11px] font-mono text-stone-400 mt-0.5">
                        {skill.cooldown}s CD
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
