import React from 'react';
import { 
  X, 
  ArrowUpDown, 
  Flame, 
  Activity, 
  Dribbble, 
  Shield, 
  Zap, 
  Award 
} from 'lucide-react';
import { SportId, SportInfo } from '../types';

interface SportSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sports: SportInfo[];
  activeSport: SportId;
  onSelectSport: (sportId: SportId) => void;
}

export const SportSelectorModal: React.FC<SportSelectorModalProps> = ({
  isOpen,
  onClose,
  sports,
  activeSport,
  onSelectSport,
}) => {
  if (!isOpen) return null;

  const getSportIcon = (id: SportId) => {
    switch (id) {
      case 'football':
        return <Flame className="w-5 h-5 text-accent-500" />;
      case 'tennis':
        return <Activity className="w-5 h-5 text-lime-500" />;
      case 'basketball':
        return <Dribbble className="w-5 h-5 text-orange-500" />;
      case 'rugby':
        return <Shield className="w-5 h-5 text-amber-600" />;
      case 'hockey':
        return <Zap className="w-5 h-5 text-sky-500" />;
      case 'handball':
        return <Award className="w-5 h-5 text-purple-500" />;
      default:
        return <Flame className="w-5 h-5 text-accent-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header (Matching Screenshot 1) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Choisissez le sport
            </h2>
          </div>
          <button 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Trier"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* Section Header */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
            Sports préférés
          </span>
        </div>

        {/* Sports List */}
        <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {sports.map((sport) => {
            const isSelected = sport.id === activeSport;
            return (
              <button
                key={sport.id}
                onClick={() => {
                  onSelectSport(sport.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors text-left ${
                  isSelected
                    ? 'bg-accent-50/60 dark:bg-accent-950/20 font-semibold text-slate-900 dark:text-white'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-2 rounded-xl ${isSelected ? 'bg-accent-100 dark:bg-accent-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    {getSportIcon(sport.id)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold capitalize">
                      {sport.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {sport.totalCount} matchs programmés
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {sport.liveCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-accent-600 text-white tabular-nums shadow-sm shadow-accent-500/20">
                      {sport.liveCount}
                    </span>
                  )}
                  <span className="text-xs font-medium text-slate-400 tabular-nums w-8 text-right">
                    {sport.totalCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Flux de données et cotes en direct actualisés en continu
          </p>
        </div>
      </div>
    </div>
  );
};
