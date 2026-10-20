import React from 'react';
import { 
  Flame, 
  Radio, 
  Star, 
  Newspaper, 
  Trophy 
} from 'lucide-react';
import { MainNavTab } from '../types';

interface BottomNavigationProps {
  activeTab: MainNavTab;
  onTabChange: (tab: MainNavTab) => void;
  liveMatchesCount: number;
  favoritesCount: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  liveMatchesCount,
  favoritesCount,
}) => {
  const tabs = [
    {
      id: 'tous' as MainNavTab,
      label: 'Tous',
      icon: Flame,
      badge: null,
    },
    {
      id: 'direct' as MainNavTab,
      label: 'Direct',
      icon: Radio,
      badge: liveMatchesCount > 0 ? liveMatchesCount : null,
      isLiveBeacon: true,
    },
    {
      id: 'favoris' as MainNavTab,
      label: 'Favoris',
      icon: Star,
      badge: favoritesCount > 0 ? favoritesCount : null,
    },
    {
      id: 'actualites' as MainNavTab,
      label: 'Actualités',
      icon: Newspaper,
      badge: null,
    },
    {
      id: 'classements' as MainNavTab,
      label: 'Championnats',
      icon: Trophy,
      badge: null,
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pointer-events-none" aria-label="Navigation principale">
      <div className="pointer-events-auto max-w-md mx-auto fs-dock grid grid-cols-5 h-[62px] items-stretch px-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative isolate flex flex-col items-center justify-center gap-1 select-none transition-colors ${
                isActive
                  ? 'fs-dock-active text-cyan-700 dark:text-cyan-200 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110' : ''
                  } ${tab.id === 'favoris' && isActive ? 'fill-current' : ''}`}
                />

                {/* Pastille de comptage ou balise « direct » */}
                {tab.badge !== null && (
                  <span className="absolute -top-2 -right-3.5 px-1 min-w-4 rounded-full bg-red-500 text-white text-[9px] font-black text-center tabular-nums leading-4 shadow-[0_0_10px_rgba(255,45,85,0.7)]">
                    {tab.badge}
                  </span>
                )}
                {tab.isLiveBeacon && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping pointer-events-none" />
                )}
              </div>

              <span className="text-[9.5px] leading-none tracking-tight whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
