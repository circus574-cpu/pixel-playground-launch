import React, { useState } from 'react';
import { Navigation, ActiveTab } from './components/Navigation';
import { HeroExplorer } from './components/HeroExplorer';
import { BestiaryExplorer } from './components/BestiaryExplorer';
import { CombatSandbox } from './components/CombatSandbox';
import { WorldAtlas } from './components/WorldAtlas';
import { LoreRules } from './components/LoreRules';
import { WorldV2Explorer } from './components/WorldV2Explorer';
import { HudShowcase } from './components/HudShowcase';
import { HeroRace } from './data/heroes';
import { Monster } from './data/bestiary';
import { loadSaveFromStorage, saveToStorage } from './game/quests/engine';
import { PlayerSaveV5 } from './game/quests/types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('world-v2');
  const [selectedHeroId, setSelectedHeroId] = useState<HeroRace['id']>('planetary');
  const [queuedMonster, setQueuedMonster] = useState<Monster | null>(null);
  const [playerSave, setPlayerSave] = useState<PlayerSaveV5>(() => loadSaveFromStorage());

  const handleUpdateSave = (next: PlayerSaveV5) => {
    setPlayerSave(next);
    saveToStorage(next);
  };

  const handleSelectHeroForCombat = (heroId: HeroRace['id']) => {
    setSelectedHeroId(heroId);
    setActiveTab('combat');
  };

  const handleSpawnMonsterInArena = (monster: Monster) => {
    setQueuedMonster(monster);
    setActiveTab('combat');
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Navigation */}
      <Navigation activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'world-v2' && (
          <WorldV2Explorer save={playerSave} onUpdateSave={handleUpdateSave} />
        )}

        {activeTab === 'hud-ui' && <HudShowcase />}

        {activeTab === 'combat' && (
          <CombatSandbox
            initialHeroId={selectedHeroId}
            queuedMonster={queuedMonster}
            onClearQueuedMonster={() => setQueuedMonster(null)}
          />
        )}

        {activeTab === 'heroes' && (
          <HeroExplorer onSelectForCombat={handleSelectHeroForCombat} />
        )}

        {activeTab === 'bestiary' && (
          <BestiaryExplorer onSpawnInArena={handleSpawnMonsterInArena} />
        )}

        {activeTab === 'atlas' && <WorldAtlas />}

        {activeTab === 'lore' && <LoreRules />}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-800/80 bg-stone-950 py-6 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-400">KI Legends — World V2</span>
            <span>•</span>
            <span>Gałąź: feature/quests-v2 (Save v5)</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-stone-400 font-mono text-[11px]">
            <span>4 Kontynenty</span>
            <span>•</span>
            <span>16 Miast</span>
            <span>•</span>
            <span>16 Sławnych Lokacji</span>
            <span>•</span>
            <span>106 Questów</span>
            <span>•</span>
            <span>40 Potworów Bestiariusza</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
