import React from 'react';
import { Swords, Skull, Users, Globe, BookOpen, Sparkles, Compass, Layout } from 'lucide-react';

export type ActiveTab =
  | 'world-v2'
  | 'hud-ui'
  | 'combat'
  | 'heroes'
  | 'bestiary'
  | 'atlas'
  | 'lore';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    {
      id: 'world-v2' as const,
      label: 'World V2 & Questy',
      sublabel: '106 Przygód • 16 Miast',
      icon: Compass,
      badge: 'NOWE V2',
    },
    {
      id: 'hud-ui' as const,
      label: 'Grafiki HUD / UI',
      sublabel: '3 Plansze • 29 Węzłów',
      icon: Layout,
      badge: 'Makiety',
    },
    {
      id: 'combat' as const,
      label: 'Arena Walki',
      sublabel: 'PvE Playground',
      icon: Swords,
    },
    {
      id: 'heroes' as const,
      label: 'Rasy (4)',
      sublabel: '8-Dir Sprites',
      icon: Users,
    },
    {
      id: 'bestiary' as const,
      label: 'Bestiariusz (40)',
      sublabel: 'Kanon Właściciela',
      icon: Skull,
    },
    {
      id: 'atlas' as const,
      label: 'Atlas Planety',
      sublabel: '4 Kontynenty',
      icon: Globe,
    },
    {
      id: 'lore' as const,
      label: 'Księga Przygody',
      sublabel: 'Zasady & Kanon',
      icon: BookOpen,
    },
  ];

  return (
    <nav className="border-b border-stone-800 bg-stone-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-500 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <Sparkles className="w-5 h-5 text-stone-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-white">KI LEGENDS</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 border border-amber-600/60 text-amber-300">
                  WORLD V2
                </span>
              </div>
              <p className="text-[11px] text-stone-400 -mt-0.5 font-mono hidden md:block">
                feature/quests-v2 • Żyjąca Planeta, Eksploracja i Przygody
              </p>
            </div>
          </div>

          {/* Tab Links */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-stone-800/95 text-white shadow-md ring-1 ring-amber-500/50'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-stone-400'}`} />
                  <div className="text-left">
                    <div className="leading-tight">{tab.label}</div>
                  </div>
                  {tab.badge && (
                    <span className="hidden lg:inline px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono rounded">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};
