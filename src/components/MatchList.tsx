import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Star, Trophy } from 'lucide-react';
import { League, Match } from '../types';
import { MatchRow } from './MatchRow';

interface MatchListProps {
  leagues: League[];
  matches: Match[];
  favoriteMatchIds: string[];
  onToggleFavoriteMatch: (id: string) => void;
  onToggleFavoriteLeague: (id: string) => void;
  onSelectMatch: (match: Match) => void;
  onOpenLeagueStandings?: (leagueId: string) => void;
  activeFilter: 'all' | 'live' | 'finished';
  onlyFavorites?: boolean;
}

export const MatchList: React.FC<MatchListProps> = ({
  leagues,
  matches,
  favoriteMatchIds,
  onToggleFavoriteMatch,
  onToggleFavoriteLeague,
  onSelectMatch,
  onOpenLeagueStandings,
  activeFilter,
  onlyFavorites = false,
}) => {
  // Collapsed leagues state
  const [collapsedLeagues, setCollapsedLeagues] = useState<Record<string, boolean>>({});

  const toggleCollapse = (leagueId: string) => {
    setCollapsedLeagues((prev) => ({
      ...prev,
      [leagueId]: !prev[leagueId],
    }));
  };

  // Filter matches
  const filteredMatches = matches.filter((match) => {
    if (onlyFavorites) {
      return favoriteMatchIds.includes(match.id);
    }
    if (activeFilter === 'live') {
      return match.isLive;
    }
    if (activeFilter === 'finished') {
      return match.status === 'FINISHED';
    }
    return true;
  });

  // Group matches by league
  const groupedLeagues = leagues
    .map((league) => {
      const leagueMatches = filteredMatches.filter((m) => m.leagueId === league.id);
      const liveCount = leagueMatches.filter((m) => m.isLive).length;
      return {
        league,
        matches: leagueMatches,
        liveCount,
      };
    })
    .filter((group) => group.matches.length > 0);

  if (groupedLeagues.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
          <Star className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
          {onlyFavorites
            ? 'Aucun match favori'
            : activeFilter === 'live'
            ? 'Aucun match en direct actuellement'
            : 'Aucun match trouvé'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          {onlyFavorites
            ? 'Cliquez sur l’étoile à côté d’un match pour le suivre ici et recevoir des alertes automatiques.'
            : 'Consultez les matchs programmés ou sélectionnez une autre date.'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 space-y-3">
      {groupedLeagues.map(({ league, matches: leagueMatches, liveCount }) => {
        const isCollapsed = collapsedLeagues[league.id];

        return (
          <div
            key={league.id}
            className="rounded-2xl overflow-hidden fs-card border transition-colors"
          >
            {/* League Header (Matching Screenshot 3 & 4) */}
            <div
              onClick={() => toggleCollapse(league.id)}
              className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/50 dark:bg-white/[0.03] border-b border-slate-200/70 dark:border-slate-800 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* League Favorite Star */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavoriteLeague(league.id);
                  }}
                  className="p-1 -m-1 text-slate-300 dark:text-slate-600 hover:text-amber-500 transition-colors"
                  title="Ajouter la ligue aux favoris"
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      league.isFavorite
                        ? 'fill-amber-400 text-amber-400'
                        : ''
                    }`}
                  />
                </button>

                {/* Flag + Country + League Name */}
                <span className="text-base shrink-0" aria-hidden="true">
                  {league.flag}
                </span>
                
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    {league.country} :
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {league.name}
                  </span>
                </div>

                {onOpenLeagueStandings && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLeagueStandings(league.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                    title="Voir le classement de ce championnat"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Right: Live count + Collapse Chevron */}
              <div className="flex items-center gap-2 shrink-0">
                {liveCount > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-red-600 text-white tabular-nums shadow-xs">
                    {liveCount}
                  </span>
                )}
                <span className="text-xs text-slate-400 tabular-nums">
                  {leagueMatches.length}
                </span>
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* Matches list */}
            {!isCollapsed && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {leagueMatches.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    isFavorite={favoriteMatchIds.includes(match.id)}
                    onToggleFavorite={onToggleFavoriteMatch}
                    onSelectMatch={onSelectMatch}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
