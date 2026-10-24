import React, { useState, useMemo } from 'react';
import { MONSTERS, Monster, WORLDS } from '../data/bestiary';
import { 
  Search, 
  Swords, 
  Shield, 
  Heart, 
  Zap, 
  Compass, 
  Skull, 
  Award, 
  Layers, 
  Filter, 
  Sparkles,
  Eye,
  AlertTriangle,
  Gift,
  X
} from 'lucide-react';

interface BestiaryExplorerProps {
  onSpawnInArena?: (monster: Monster) => void;
}

export const BestiaryExplorer: React.FC<BestiaryExplorerProps> = ({ onSpawnInArena }) => {
  const [selectedWorld, setSelectedWorld] = useState<string>('all');
  const [selectedArchetype, setSelectedArchetype] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'level' | 'hp' | 'atk' | 'xp'>('level');
  const [inspectingMonster, setInspectingMonster] = useState<Monster | null>(null);

  const archetypes = useMemo(() => {
    const set = new Set(MONSTERS.map((m) => m.archetype));
    return Array.from(set).sort();
  }, []);

  const filteredMonsters = useMemo(() => {
    return MONSTERS.filter((m) => {
      const matchWorld = selectedWorld === 'all' || m.world === selectedWorld;
      const matchArchetype = selectedArchetype === 'all' || m.archetype === selectedArchetype;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.skills.some((s) => s.toLowerCase().includes(q)) ||
        m.weakness.toLowerCase().includes(q) ||
        m.loot.toLowerCase().includes(q);
      return matchWorld && matchArchetype && matchQuery;
    }).sort((a, b) => {
      if (sortBy === 'level') return a.level - b.level;
      if (sortBy === 'hp') return b.stats.hp - a.stats.hp;
      if (sortBy === 'atk') return b.stats.atk - a.stats.atk;
      if (sortBy === 'xp') return b.stats.xp - a.stats.xp;
      return 0;
    });
  }, [selectedWorld, selectedArchetype, searchQuery, sortBy]);

  return (
    <div className="space-y-8 text-stone-100">
      {/* Header */}
      <div className="border-b border-stone-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-emerald-400">
            <Skull className="w-4 h-4" />
            Ki Legends Complete Bestiary
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white mt-1">
            40 Continental Beasts & Guardians
          </h2>
          <p className="text-sm text-stone-400 mt-1">
            Full combat statistics, AI behaviors, weaknesses, and loot matrices from the owner's design archive.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 bg-stone-900 border border-stone-800 rounded-xl text-xs font-mono text-stone-300">
            Showing <span className="font-bold text-emerald-400">{filteredMonsters.length}</span> of {MONSTERS.length} Beasts
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5 backdrop-blur-sm space-y-4">
        {/* World Select Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedWorld('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedWorld === 'all'
                ? 'bg-stone-100 text-stone-950 shadow-md'
                : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-white hover:border-stone-700'
            }`}
          >
            All Continents ({MONSTERS.length})
          </button>
          {Object.entries(WORLDS).map(([key, w]) => {
            const count = MONSTERS.filter((m) => m.world === key).length;
            const isSelected = selectedWorld === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedWorld(key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isSelected
                    ? 'border-transparent text-white shadow-lg'
                    : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:text-white hover:border-stone-700'
                }`}
                style={{
                  backgroundColor: isSelected ? w.color : undefined,
                  boxShadow: isSelected ? `0 0 16px ${w.color}40` : undefined,
                }}
              >
                <span>{w.name}</span>
                <span className="opacity-75 text-[11px] font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Secondary Filters: Search, Archetype, Sort */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by monster name, skill, weakness, or loot..."
              className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Archetype Filter */}
          <div className="md:col-span-4 flex items-center gap-2 bg-stone-950 border border-stone-800 rounded-xl px-3 py-1">
            <Filter className="w-4 h-4 text-stone-500 shrink-0" />
            <span className="text-xs text-stone-400 font-mono">Archetype:</span>
            <select
              value={selectedArchetype}
              onChange={(e) => setSelectedArchetype(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer w-full"
            >
              <option value="all" className="bg-stone-900">All Types</option>
              {archetypes.map((arch) => (
                <option key={arch} value={arch} className="bg-stone-900">
                  {arch.toUpperCase()} ({MONSTERS.filter((m) => m.archetype === arch).length})
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="md:col-span-3 flex items-center gap-2 bg-stone-950 border border-stone-800 rounded-xl px-3 py-1">
            <span className="text-xs text-stone-400 font-mono">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer w-full"
            >
              <option value="level" className="bg-stone-900">Level (Low to High)</option>
              <option value="hp" className="bg-stone-900">Highest HP</option>
              <option value="atk" className="bg-stone-900">Highest Attack</option>
              <option value="xp" className="bg-stone-900">Highest XP Yield</option>
            </select>
          </div>
        </div>
      </div>

      {/* Monster Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredMonsters.map((monster) => {
          const worldMeta = WORLDS[monster.world];
          return (
            <div
              key={monster.id}
              onClick={() => setInspectingMonster(monster)}
              className="group bg-stone-900/50 hover:bg-stone-900/90 border border-stone-800 hover:border-stone-700 rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-0.5"
            >
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: `${worldMeta.color}30`, color: worldMeta.color, border: `1px solid ${worldMeta.color}50` }}
                  >
                    {monster.world}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-stone-950 rounded-md border border-stone-800 text-stone-400 text-[11px] font-mono">
                      {monster.archetype}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-700/60 text-amber-300 font-bold text-xs rounded-md font-mono">
                      Lv.{monster.level}
                    </span>
                  </div>
                </div>

                {/* Name & Archetype */}
                <h3 className="font-extrabold text-base text-white group-hover:text-emerald-400 transition-colors">
                  {monster.name}
                </h3>
                <p className="text-xs text-stone-400 line-clamp-2 mt-1">
                  {monster.behavior}
                </p>

                {/* Stats Matrix */}
                <div className="grid grid-cols-4 gap-1.5 my-3 bg-stone-950/70 p-2 rounded-xl border border-stone-800/80 text-center font-mono">
                  <div>
                    <div className="text-[10px] text-rose-400">HP</div>
                    <div className="text-xs font-bold text-white">{monster.stats.hp}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-amber-400">ATK</div>
                    <div className="text-xs font-bold text-white">{monster.stats.atk}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-400">DEF</div>
                    <div className="text-xs font-bold text-white">{monster.stats.def}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-cyan-400">XP</div>
                    <div className="text-xs font-bold text-white">{monster.stats.xp}</div>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Facts & Actions */}
              <div className="pt-2 border-t border-stone-800/60 flex items-center justify-between text-xs">
                <span className="text-[11px] text-stone-400 truncate max-w-[170px]">
                  Weak: <span className="text-rose-300">{monster.weakness.split(';')[0]}</span>
                </span>
                <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold text-[11px]">
                  Inspect <Eye className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Monster Detail Modal */}
      {inspectingMonster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-stone-900 border border-stone-700 max-w-2xl w-full rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-stone-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase"
                    style={{
                      backgroundColor: `${WORLDS[inspectingMonster.world].color}20`,
                      color: WORLDS[inspectingMonster.world].color,
                      border: `1px solid ${WORLDS[inspectingMonster.world].color}60`
                    }}
                  >
                    Continent of {WORLDS[inspectingMonster.world].name}
                  </span>
                  <span className="px-2.5 py-0.5 bg-amber-950 border border-amber-600/70 text-amber-300 font-bold text-xs rounded-full font-mono">
                    Level {inspectingMonster.level}
                  </span>
                  <span className="px-2 py-0.5 bg-stone-800 text-stone-300 text-xs rounded-full font-mono">
                    Size: {inspectingMonster.size}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white">{inspectingMonster.name}</h3>
                <div className="text-xs text-stone-400 font-mono mt-0.5">
                  Archetype: {inspectingMonster.archetype.toUpperCase()} • Scale Factor: {inspectingMonster.scale}
                </div>
              </div>

              <button
                onClick={() => setInspectingMonster(null)}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Core Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-rose-400 font-mono mb-1">
                  <Heart className="w-3.5 h-3.5" /> Hit Points
                </div>
                <div className="text-2xl font-black text-white">{inspectingMonster.stats.hp}</div>
              </div>
              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-amber-400 font-mono mb-1">
                  <Swords className="w-3.5 h-3.5" /> Attack Power
                </div>
                <div className="text-2xl font-black text-white">{inspectingMonster.stats.atk}</div>
              </div>
              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-emerald-400 font-mono mb-1">
                  <Shield className="w-3.5 h-3.5" /> Defense Rating
                </div>
                <div className="text-2xl font-black text-white">{inspectingMonster.stats.def}</div>
              </div>
              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-cyan-400 font-mono mb-1">
                  <Award className="w-3.5 h-3.5" /> Experience Yield
                </div>
                <div className="text-2xl font-black text-white">+{inspectingMonster.stats.xp}</div>
              </div>
            </div>

            {/* Behavioral Matrix */}
            <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-400" />
                Combat Behavior & AI Script
              </div>
              <p className="text-sm text-stone-200 leading-relaxed">
                {inspectingMonster.behavior}
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 text-xs font-mono text-stone-400 border-t border-stone-800/80">
                <div>Agro Radius: <span className="text-white font-bold">{inspectingMonster.agro} px</span></div>
                <div>Attack Range: <span className="text-white font-bold">{inspectingMonster.range} px</span></div>
                <div>Movement Speed: <span className="text-white font-bold">{inspectingMonster.speed}x</span></div>
              </div>
            </div>

            {/* Skills & Weakness */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-2">
                <div className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  Special Abilities
                </div>
                <ul className="space-y-1.5">
                  {inspectingMonster.skills.map((s, idx) => (
                    <li key={idx} className="text-xs text-stone-300 flex items-start gap-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-2">
                <div className="text-xs font-mono uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Weakness & Counters
                </div>
                <p className="text-xs text-rose-200 leading-relaxed">
                  {inspectingMonster.weakness}
                </p>

                <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 pt-2">
                  <Gift className="w-4 h-4" />
                  Loot Drops
                </div>
                <p className="text-xs text-stone-300">
                  {inspectingMonster.loot}
                </p>
              </div>
            </div>

            {/* Design Spec */}
            <div className="p-3.5 bg-stone-950/60 rounded-xl border border-stone-800/80 text-xs space-y-1">
              <div className="font-mono text-stone-400">Design Specification:</div>
              <div className="text-stone-300 italic">{inspectingMonster.design}</div>
              <div className="text-[11px] text-stone-400 font-mono mt-1">
                Color Palette: {inspectingMonster.palette}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setInspectingMonster(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-400 hover:text-white transition-colors cursor-pointer"
              >
                Close
              </button>
              {onSpawnInArena && (
                <button
                  onClick={() => {
                    const m = inspectingMonster;
                    setInspectingMonster(null);
                    onSpawnInArena(m);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
                >
                  <Swords className="w-4 h-4" />
                  Spawn {inspectingMonster.name} in Arena
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
