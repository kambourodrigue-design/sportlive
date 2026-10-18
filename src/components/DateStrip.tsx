import React from 'react';
import { getWeekStrip, toLocalISODate } from '../utils/date';
import { Calendar, ListFilter } from 'lucide-react';

interface DateStripProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  liveMatchesCount: number;
  totalMatchesCount: number;
  activeFilter: 'all' | 'live' | 'finished';
  onChangeFilter: (filter: 'all' | 'live' | 'finished') => void;
}

export const DateStrip: React.FC<DateStripProps> = ({
  selectedDate,
  onSelectDate,
  liveMatchesCount,
  totalMatchesCount,
  activeFilter,
  onChangeFilter,
}) => {
  const days = getWeekStrip();

  return (
    <div className="w-full fs-surface border-b border-slate-200 dark:border-slate-800 transition-colors">
      
      {/* Horizontal Date Scroller (Matching Screenshots 4 & 5) */}
      <div className="flex items-center overflow-x-auto scrollbar-none py-2 px-2 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center space-x-1 sm:space-x-2 mx-auto">
          {days.map((item) => {
            const isSelected = selectedDate === item.fullDate;
            return (
              <button
                key={item.fullDate}
                onClick={() => onSelectDate(item.fullDate)}
                className={`relative px-3.5 py-1.5 flex flex-col items-center transition-all min-w-[58px] ${
                  isSelected
                    ? 'text-red-600 dark:text-red-500 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <span className="text-xs uppercase tracking-wider">{item.label}</span>
                <span className="text-xs tabular-nums mt-0.5">{item.dateStr}</span>

                {/* Red active indicator bar */}
                {isSelected && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full" />
                )}
              </button>
            );
          })}

          <button
            onClick={() => onSelectDate(toLocalISODate(new Date()))}
            className="p-2 ml-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Calendrier"
            aria-label="Sélectionner une date personnalisée"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Filter Strip (Matching Screenshot 4) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-slate-500" />
          <h1 className="text-sm font-bold text-slate-900 dark:text-white">
            Tous les matchs
          </h1>
          <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded bg-red-600 text-white tabular-nums shadow-sm shadow-red-500/20">
            {liveMatchesCount}
          </span>
          <span className="text-xs font-medium text-slate-400 tabular-nums">
            {totalMatchesCount}
          </span>
        </div>

        {/* Quick Segmented Filter */}
        <div className="flex items-center max-w-full overflow-x-auto scrollbar-none bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-semibold whitespace-nowrap">
          <button
            onClick={() => onChangeFilter('all')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => onChangeFilter('live')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
              activeFilter === 'live'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>En direct ({liveMatchesCount})</span>
          </button>
          <button
            onClick={() => onChangeFilter('finished')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeFilter === 'finished'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Terminés
          </button>
        </div>
      </div>
    </div>
  );
};
