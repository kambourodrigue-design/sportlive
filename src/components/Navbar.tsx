import React from 'react';
import { 
  Bell, 
  ChevronDown, 
  Moon, 
  Play, 
  Pause, 
  Search, 
  SlidersHorizontal, 
  Sun, 
  Zap, 
  FastForward,
  Flame
} from 'lucide-react';
import { SportId, SportInfo } from '../types';
import { InstallButton } from './InstallButton';

interface NavbarProps {
  sports: SportInfo[];
  activeSport: SportId;
  onOpenSportSelector: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  unreadNotificationsCount: number;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  simulationSpeed: number;
  onChangeSpeed: () => void;
  onTriggerGoal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  sports,
  activeSport,
  onOpenSportSelector,
  onOpenSearch,
  onOpenNotifications,
  onOpenSettings,
  isDarkMode,
  onToggleTheme,
  unreadNotificationsCount,
  isSimulating,
  onToggleSimulation,
  simulationSpeed,
  onChangeSpeed,
  onTriggerGoal,
}) => {
  const currentSport = sports.find((s) => s.id === activeSport) || sports[0];

  return (
    <header className="sticky top-0 z-40 w-full fs-bar fs-bar-top border-b transition-colors">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 h-16 flex items-center justify-between gap-1 sm:gap-4">
        
        {/* Left: Brand + Sport selector button */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="hidden min-[420px]:flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-8 h-8 rounded-lg fs-logo text-white flex items-center justify-center font-black text-lg font-display">
                F
              </span>
              <span className="hidden sm:inline font-black font-display tracking-wide">FLASH<span className="fs-text-gradient">SCORE</span></span>
            </span>
          </div>

          {/* Sport Selector Trigger (Matching Screenshot 1) */}
          <button
            onClick={onOpenSportSelector}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 min-w-0 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 transition-all text-slate-900 dark:text-slate-100 text-sm font-semibold border border-slate-200/60 dark:border-slate-700"
            title="Changer de sport"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="capitalize truncate max-w-[72px] sm:max-w-none">{currentSport.name}</span>
            <span className="px-1.5 py-0.2 text-[11px] font-bold rounded bg-red-600 text-white tabular-nums">
              {currentSport.liveCount}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Center / Right: Action buttons */}
        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
          
          {/* Quick Simulation Trigger */}
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={onToggleSimulation}
              className="p-1 rounded text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title={isSimulating ? "Mettre en pause la simulation" : "Reprendre la simulation"}
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-500" />}
            </button>
            <button
              onClick={onChangeSpeed}
              className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              title="Vitesse du direct"
            >
              {simulationSpeed}x
            </button>
            <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 mx-0.5"></div>
            <button
              onClick={onTriggerGoal}
              className="flex items-center gap-1 px-2 py-0.5 rounded font-medium text-[11px] bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="Simuler un but en direct avec alerte sonore"
            >
              <Zap className="w-3 h-3" />
              <span>Simuler un But</span>
            </button>
          </div>

          <InstallButton />

          {/* Search Trigger */}
          <button
            onClick={onOpenSearch}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-sm"
            aria-label="Rechercher des équipes ou matchs"
          >
            <Search className="w-4 h-4" />
            <span className="hidden lg:inline text-xs text-slate-500">Rechercher...</span>
          </button>

          {/* Theme Switcher (Light / Dark Mode) */}
          <button
            onClick={onToggleTheme}
            className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={isDarkMode ? "Activer le mode clair" : "Activer le mode nuit"}
            title={isDarkMode ? "Passer en mode clair" : "Passer en mode nuit"}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Notification Center Trigger */}
          <button
            onClick={onOpenNotifications}
            className="relative p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Notifications en direct"
            title="Historique des alertes en direct"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Notification Settings Modal Trigger */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 sm:p-2 max-[340px]:hidden rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Paramètres des alertes"
            title="Personnaliser les alertes sonores et visuelles"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
