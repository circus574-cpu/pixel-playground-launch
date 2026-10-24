import React, { useState } from 'react';
import { WORLDS } from '../data/bestiary';
import { BIOME_ASSETS, BiomeAsset } from '../data/worlds';
import { 
  Globe, 
  MapPin, 
  TreePine, 
  Flame, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  Compass, 
  ZoomIn, 
  X,
  BookOpen
} from 'lucide-react';

export const WorldAtlas: React.FC = () => {
  const [selectedWorldKey, setSelectedWorldKey] = useState<string>('verdant');
  const [activeCategory, setActiveCategory] = useState<'all' | 'texture' | 'object' | 'candidate'>('all');
  const [inspectingAsset, setInspectingAsset] = useState<BiomeAsset | null>(null);

  const world = WORLDS[selectedWorldKey as keyof typeof WORLDS] || WORLDS.verdant;

  const filteredAssets = BIOME_ASSETS.filter((a) => {
    const matchesWorld = a.world === 'all' || a.world === selectedWorldKey;
    const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
    return matchesWorld && matchesCategory;
  });

  return (
    <div className="space-y-8 text-stone-100">
      {/* Header */}
      <div className="border-b border-stone-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-emerald-400">
            <Globe className="w-4 h-4" />
            Ki Legends Planetary Atlas
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white mt-1">
            Continents, Biomes & Production Nature Assets
          </h2>
          <p className="text-sm text-stone-400 mt-1">
            Explore the four planetary continents, terrain tiles, environmental props, and anime candidate textures.
          </p>
        </div>
      </div>

      {/* World Cards Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(WORLDS).map(([key, w]) => {
          const isSelected = selectedWorldKey === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedWorldKey(key)}
              className={`p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-stone-900 border-white/30 shadow-xl ring-2'
                  : 'bg-stone-900/40 border-stone-800 hover:border-stone-700 hover:bg-stone-900/70'
              }`}
              style={{
                borderColor: isSelected ? w.color : undefined,
                boxShadow: isSelected ? `0 10px 25px ${w.color}25` : undefined,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: `${w.color}40`, border: `1px solid ${w.color}` }}
                >
                  CONTINENT
                </span>
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: w.color }}
                />
              </div>

              <h3 className="text-xl font-black text-white">{w.name}</h3>
              <p className="text-xs text-stone-300 font-medium mt-0.5">{w.title}</p>
              <div className="text-xs text-stone-400 mt-3 line-clamp-2 leading-relaxed">
                {w.theme}
              </div>

              <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-400">
                <span>Inhabitants:</span>
                <span className="text-white font-semibold">{w.primaryRace}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Continent Dossier */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-800 pb-4">
          <div>
            <span
              className="text-xs font-mono uppercase tracking-widest font-bold"
              style={{ color: world.color }}
            >
              Geographical Dossier
            </span>
            <h3 className="text-2xl font-black text-white mt-0.5">{world.name}: {world.title}</h3>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-stone-950 px-3.5 py-2 rounded-xl border border-stone-800 text-stone-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Safe City Bounds: ~4000 × 2500 units (zero hostile spawns)</span>
          </div>
        </div>

        <p className="text-sm text-stone-300 leading-relaxed max-w-4xl">
          {world.theme}. As established in the Ki Legends world design, each continent features an extensive wild expanse surrounding a safe fortified city. Curved roads and courtyards are baked seamlessly into the chunk textures, preserving collision independence for seamless exploration.
        </p>

        {/* Category Filter for Assets */}
        <div className="flex items-center gap-2 pt-2">
          <span className="text-xs text-stone-400 font-mono mr-1">Asset Types:</span>
          {(['all', 'texture', 'object', 'candidate'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-stone-100 text-stone-950 font-bold'
                  : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-white'
              }`}
            >
              {cat === 'candidate' ? 'Anime Candidates' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredAssets.map((asset) => (
          <div
            key={asset.id}
            onClick={() => setInspectingAsset(asset)}
            className="group bg-stone-900/50 hover:bg-stone-900/90 border border-stone-800 hover:border-stone-700 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-xl"
          >
            {/* Image Preview Box */}
            <div className="relative aspect-video w-full bg-stone-950 flex items-center justify-center overflow-hidden border-b border-stone-800">
              <img
                src={asset.path}
                alt={asset.name}
                className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  // Fallback placeholder
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="absolute top-2 right-2 px-2 py-0.5 bg-stone-950/80 backdrop-blur-sm rounded text-[10px] font-mono text-stone-400 border border-stone-800">
                {asset.category}
              </span>
            </div>

            {/* Asset Info */}
            <div className="p-4 space-y-2">
              <h4 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">
                {asset.name}
              </h4>
              <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">
                {asset.description}
              </p>
              <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-stone-500">
                <span className="capitalize">{asset.world} World</span>
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  View <ZoomIn className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen Asset Inspection Modal */}
      {inspectingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-stone-900 border border-stone-700 max-w-3xl w-full rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-stone-800 pb-3">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">
                  {inspectingAsset.category.toUpperCase()} • {inspectingAsset.world.toUpperCase()}
                </span>
                <h3 className="text-2xl font-black text-white mt-0.5">{inspectingAsset.name}</h3>
              </div>
              <button
                onClick={() => setInspectingAsset(null)}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full max-h-[460px] bg-stone-950 rounded-xl border border-stone-800 overflow-hidden flex items-center justify-center p-4">
              <img
                src={inspectingAsset.path}
                alt={inspectingAsset.name}
                className="max-h-[420px] max-w-full object-contain drop-shadow-2xl"
              />
            </div>

            <p className="text-sm text-stone-300 leading-relaxed bg-stone-950/60 p-4 rounded-xl border border-stone-800">
              {inspectingAsset.description}
            </p>

            <div className="flex items-center justify-between text-xs font-mono text-stone-400 pt-1">
              <span>File Path: <code className="text-stone-300">{inspectingAsset.path}</code></span>
              <button
                onClick={() => setInspectingAsset(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-medium cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
