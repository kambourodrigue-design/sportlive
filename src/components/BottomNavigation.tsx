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
      label: 'DIRECT',
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 fs-bar fs-bar-bottom border-t transition-colors">
      <div className="max-w-lg mx-auto grid grid-cols-5 h-16 items-center px-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center h-full transition-colors select-none ${
                isActive
                  ? 'text-cyan-600 dark:text-cyan-300 font-extrabold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110' : ''
                  } ${tab.id === 'favoris' && isActive ? 'fill-current' : ''}`}
                />

                {/* Badge count or pulsing beacon */}
                {tab.badge !== null && (
                  <span className="absolute -top-1.5 -right-3 px-1.2 py-0.2 min-w-4 rounded-full bg-red-600 text-white text-[9px] font-black text-center tabular-nums shadow-xs">
                    {tab.badge}
                  </span>
                )}
                {tab.isLiveBeacon && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping pointer-events-none" />
                )}
              </div>

              <span className="text-[10px] tracking-tight mt-1 truncate max-w-full uppercase">
                {tab.label}
              </span>

              {/* Active bar dot */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-red-600 dark:bg-red-500 rounded-b-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
