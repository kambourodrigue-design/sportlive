import React, { useState } from 'react';
import { Search, X, ChevronRight, Star } from 'lucide-react';
import { Match } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: Match[];
  onSelectMatch: (match: Match) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  matches,
  onSelectMatch,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filtered = query.trim()
    ? matches.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(query.toLowerCase()) ||
          m.awayTeam.name.toLowerCase().includes(query.toLowerCase()) ||
          m.leagueName.toLowerCase().includes(query.toLowerCase()) ||
          m.events.some((e) => e.playerName.toLowerCase().includes(query.toLowerCase()))
      )
    : matches.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une équipe, un match, un championnat..."
            autoFocus
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-500"
            >
              ESC
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="p-2 max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
            {query.trim() ? `Résultats (${filtered.length})` : 'Matchs à la une'}
          </p>

          {filtered.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              Aucun résultat pour « {query} »
            </p>
          ) : (
            filtered.map((match) => (
              <button
                key={match.id}
                onClick={() => {
                  onSelectMatch(match);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="text-lg select-none">{match.leagueFlag}</span>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {match.homeTeam.name} vs {match.awayTeam.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {match.leagueName} · {match.isLive ? `${match.minute}' En direct` : match.startTime}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {match.status !== 'SCHEDULED' && (
                    <span className="text-xs font-bold text-red-600 tabular-nums">
                      {match.score.home} - {match.score.away}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
