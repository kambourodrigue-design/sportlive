import React, { useEffect, useRef, useState } from 'react';
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
  Flame,
  LogIn,
  LogOut
} from 'lucide-react';
import { AuthUser } from '../services/auth';
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
  user: AuthUser | null;
  authChecking: boolean;
  onOpenAuth: () => void;
  onSignOut: () => void;
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
  user,
  authChecking,
  onOpenAuth,
  onSignOut,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);
  const currentSport = sports.find((s) => s.id === activeSport) || sports[0];

  return (
    <header className="sticky top-0 z-40 w-full fs-bar fs-bar-top border-b transition-colors">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 h-16 flex items-center justify-between gap-1 sm:gap-4">
        
        {/* Left: Brand + Sport selector button */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="hidden min-[420px]:flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-8 h-8 rounded-lg fs-logo text-white flex items-center justify-center font-black text-lg font-display">
                S
              </span>
              <span className="hidden sm:inline font-black font-display tracking-wide">SCORE<span className="fs-text-gradient">AFRICA</span></span>
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
            {currentSport.liveCount > 0 && (
              <span className="px-1.5 py-0.2 text-[11px] font-bold rounded bg-accent-600 text-white tabular-nums">
                {currentSport.liveCount}
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Center / Right: Action buttons */}
        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
          
          {/* Quick Simulation Trigger */}
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={onToggleSimulation}
              className="p-1 rounded text-slate-700 dark:text-slate-300 hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
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
              className="flex items-center gap-1 px-2 py-0.5 rounded font-medium text-[11px] bg-accent-600 hover:bg-accent-700 text-white transition-colors"
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
            className="max-[340px]:hidden p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-sm"
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
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent-600 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
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

          {/* Compte : bouton « Se connecter » ou menu du membre */}
          {!authChecking && !user && (
            <button
              onClick={onOpenAuth}
              className="ml-0.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-600 text-white text-xs font-bold whitespace-nowrap hover:brightness-110"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden min-[400px]:inline">Se connecter</span>
              <span className="hidden min-[350px]:inline min-[400px]:hidden">Connexion</span>
              <span className="sr-only min-[350px]:hidden">Se connecter</span>
            </button>
          )}
          {user && (
            <div className="relative ml-0.5" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="w-8 h-8 rounded-full fs-logo text-white text-sm font-black flex items-center justify-center uppercase"
                aria-label="Mon compte"
                aria-expanded={menuOpen}
              >
                {user.name.charAt(0)}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-2 animate-fade-in z-50">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                    className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <LogOut className="w-4 h-4" />
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
