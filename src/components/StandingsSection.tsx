import React, { useState } from 'react';
import { 
  ALL_COMPETITIONS, 
  STANDINGS_DATA, 
  TOP_SCORERS_DATA, 
  CompetitionItem 
} from '../data/mockData';
import { StandingRow, TopScorer } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Trophy, 
  Flame, 
  Star, 
  ArrowLeft 
} from 'lucide-react';

interface StandingsSectionProps {
  initialCompetitionId?: string;
}

export const StandingsSection: React.FC<StandingsSectionProps> = ({
  initialCompetitionId,
}) => {
  // If activeCompetition is null, we display the Competitions List (Screenshot 171842)
  // If activeCompetition is set, we display the detailed Standings Table (Screenshot 171727)
  const [activeCompetition, setActiveCompetition] = useState<CompetitionItem | null>(() => {
    if (initialCompetitionId) {
      return ALL_COMPETITIONS.find((c) => c.id === initialCompetitionId) || null;
    }
    return null;
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'all' | 'home' | 'away' | 'scorers'>('all');

  // Filter competitions in list mode
  const filteredCompetitions = ALL_COMPETITIONS.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group competitions by category
  const favoriteCompetitions = filteredCompetitions.filter((c) => c.category === 'COMPÉTITIONS FAVORITES');
  const otherCompetitions = filteredCompetitions.filter((c) => c.category !== 'COMPÉTITIONS FAVORITES');

  // When a competition is selected, get its table data
  const currentKey = activeCompetition?.id || 'ligue1';
  const rawTableData: StandingRow[] = STANDINGS_DATA[currentKey] || STANDINGS_DATA.ligue1;
  const scorersData: TopScorer[] = TOP_SCORERS_DATA[currentKey] || TOP_SCORERS_DATA.ligue1 || [];

  // Adapt data for Home/Away modes
  const tableData: StandingRow[] = React.useMemo(() => {
    if (viewMode === 'all') return rawTableData;

    return rawTableData.map((row) => {
      if (viewMode === 'home') {
        const homePlayed = Math.max(1, Math.ceil(row.played / 2));
        const homeWins = Math.max(0, Math.ceil(row.wins * 0.65));
        const homeDraws = Math.max(0, Math.floor(row.draws * 0.5));
        const homeLosses = Math.max(0, homePlayed - (homeWins + homeDraws));
        const homeGF = Math.ceil(row.goalsFor * 0.6);
        const homeGA = Math.floor(row.goalsAgainst * 0.4);
        const homePts = homeWins * 3 + homeDraws;
        return {
          ...row,
          played: homePlayed,
          wins: homeWins,
          draws: homeDraws,
          losses: homeLosses,
          goalsFor: homeGF,
          goalsAgainst: homeGA,
          goalDiff: homeGF - homeGA,
          points: homePts,
        };
      } else {
        // Away mode
        const awayPlayed = Math.max(1, Math.floor(row.played / 2));
        const awayWins = Math.max(0, Math.floor(row.wins * 0.35));
        const awayDraws = Math.max(0, Math.ceil(row.draws * 0.5));
        const awayLosses = Math.max(0, awayPlayed - (awayWins + awayDraws));
        const awayGF = Math.floor(row.goalsFor * 0.4);
        const awayGA = Math.ceil(row.goalsAgainst * 0.6);
        const awayPts = awayWins * 3 + awayDraws;
        return {
          ...row,
          played: awayPlayed,
          wins: awayWins,
          draws: awayDraws,
          losses: awayLosses,
          goalsFor: awayGF,
          goalsAgainst: awayGA,
          goalDiff: awayGF - awayGA,
          points: awayPts,
        };
      }
    });
  }, [rawTableData, viewMode]);

  /* ========================================================
     VIEW 1: LISTE DE TOUS LES CHAMPIONNATS (Screenshot 171842)
     ======================================================== */
  if (!activeCompetition) {
    return (
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-3 pb-24">
        {/* Main Title */}
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h1 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            CLASSEMENTS
          </h1>
          <span className="text-xs text-slate-400">
            {ALL_COMPETITIONS.length} compétitions disponibles
          </span>
        </div>

        {/* Quick Search in competitions */}
        <div className="p-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un championnat ou un pays..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
          </div>
        </div>

        {/* FIFA Section */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-y border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            FIFA
          </span>
        </div>

        {/* Category: COMPÉTITIONS FAVORITES (Exact beige/yellowish bar from screenshot) */}
        <div className="px-4 py-2 bg-amber-50/90 dark:bg-amber-950/30 border-y border-amber-200/60 dark:border-amber-900/40">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
            COMPÉTITIONS FAVORITES
          </span>
        </div>

        {/* List of Favorite Competitions (Matching Screenshot 171842 exactly) */}
        <div className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/70 border-b border-slate-200 dark:border-slate-800 shadow-xs">
          {favoriteCompetitions.map((comp) => (
            <button
              key={comp.id}
              onClick={() => {
                setActiveCompetition(comp);
                setViewMode('all');
              }}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="text-2xl select-none shrink-0" aria-hidden="true">
                  {comp.flag}
                </span>
                <div className="truncate">
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none">
                    {comp.country}
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors truncate">
                    {comp.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-slate-400 group-hover:text-accent-500 transition-colors">
                <span className="text-xs hidden sm:inline font-medium">Voir le classement</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>

        {/* Other / Regional Competitions */}
        {otherCompetitions.length > 0 && (
          <div className="mt-4">
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-y border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                AUTRES COMPÉTITIONS
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/70 border-b border-slate-200 dark:border-slate-800 shadow-xs">
              {otherCompetitions.map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => {
                    setActiveCompetition(comp);
                    setViewMode('all');
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="text-2xl select-none shrink-0">
                      {comp.flag}
                    </span>
                    <div className="truncate">
                      <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none">
                        {comp.country}
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors truncate">
                        {comp.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-slate-400 group-hover:text-accent-500 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ========================================================
     VIEW 2: CLASSEMENT DU CHAMPIONNAT SÉLECTIONNÉ (Screenshot 171727)
     ======================================================== */
  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 space-y-4 pb-24 animate-fade-in">
      
      {/* Back button to return to the list of championships */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveCompetition(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-accent-600 dark:hover:text-accent-400 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tous les championnats</span>
        </button>

        <span className="text-xs font-bold text-slate-500 uppercase">
          {activeCompetition.country}
        </span>
      </div>

      {/* Horizontal League Switcher (Tabs with Flag + Name) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {ALL_COMPETITIONS.map((comp) => {
          const isSelected = comp.id === activeCompetition.id;
          return (
            <button
              key={comp.id}
              onClick={() => setActiveCompetition(comp)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 shadow-xs ${
                isSelected
                  ? 'bg-accent-600 text-white shadow-accent-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700'
              }`}
            >
              <span>{comp.flag}</span>
              <span>{comp.name}</span>
            </button>
          );
        })}
      </div>

      {/* Subtabs Bar (Matching Screenshot 171727: Général, Domicile, Extérieur) */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Général
          </button>
          <button
            onClick={() => setViewMode('home')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'home'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Domicile
          </button>
          <button
            onClick={() => setViewMode('away')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'away'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Extérieur
          </button>
          {scorersData.length > 0 && (
            <button
              onClick={() => setViewMode('scorers')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'scorers'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Buteurs
            </button>
          )}
        </div>

        <span className="text-xs text-slate-400 hidden sm:inline">
          Mis à jour en temps réel
        </span>
      </div>

      {/* VIEW A: TABLE DE CLASSEMENT (Screenshot 171727) */}
      {viewMode !== 'scorers' && (
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 w-8 text-center">#</th>
                <th className="py-3 px-3">ÉQUIPE</th>
                <th className="py-3 px-2 text-center">J</th>
                <th className="py-3 px-2 text-center">G</th>
                <th className="py-3 px-2 text-center">N</th>
                <th className="py-3 px-2 text-center">P</th>
                <th className="py-3 px-2 text-center">DIFF</th>
                <th className="py-3 px-3 text-center font-extrabold text-slate-900 dark:text-white">PTS</th>
                <th className="py-3 px-3 text-center hidden md:table-cell">FORME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {tableData.map((row) => (
                <tr
                  key={row.rank}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Rank with qualification circle */}
                  <td className="py-3 px-3 text-center font-bold">
                    <span
                      className={`inline-block w-5 h-5 rounded-full text-center leading-5 text-[10px] ${
                        row.rank <= 4
                          ? 'bg-accent-600 text-white font-black'
                          : row.rank <= 6
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {row.rank}
                    </span>
                  </td>

                  {/* Team (Matching Screenshot 171727) */}
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base select-none shrink-0">{row.logo}</span>
                      <span className="truncate">{row.team}</span>
                    </div>
                  </td>

                  {/* Stats */}
                  <td className="py-3 px-2 text-center tabular-nums text-slate-600 dark:text-slate-300">{row.played}</td>
                  <td className="py-3 px-2 text-center tabular-nums text-slate-600 dark:text-slate-300">{row.wins}</td>
                  <td className="py-3 px-2 text-center tabular-nums text-slate-600 dark:text-slate-300">{row.draws}</td>
                  <td className="py-3 px-2 text-center tabular-nums text-slate-600 dark:text-slate-300">{row.losses}</td>
                  <td className="py-3 px-2 text-center tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                    {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                  </td>
                  {/* PTS (in bold red tabular text like in screenshot) */}
                  <td className="py-3 px-3 text-center tabular-nums font-black text-sm text-accent-600 dark:text-cyan-300">
                    {row.points}
                  </td>

                  {/* Form W/D/L Pills */}
                  <td className="py-3 px-3 text-center hidden md:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      {row.form.map((res, i) => (
                        <span
                          key={i}
                          className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center text-white ${
                            res === 'W'
                              ? 'bg-emerald-600'
                              : res === 'D'
                              ? 'bg-slate-400'
                              : 'bg-fuchsia-600'
                          }`}
                        >
                          {res}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW B: MEILLEURS BUTEURS */}
      {viewMode === 'scorers' && (
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 w-8 text-center">#</th>
                <th className="py-3 px-3">BUTEUR</th>
                <th className="py-3 px-3">ÉQUIPE</th>
                <th className="py-3 px-3 text-center font-extrabold text-slate-900 dark:text-white">BUTS</th>
                <th className="py-3 px-3 text-center">PASSES D.</th>
                <th className="py-3 px-3 text-center">MATCHS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {scorersData.map((scorer) => (
                <tr
                  key={scorer.rank}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-3 text-center font-bold text-slate-500">
                    {scorer.rank}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                    {scorer.player}
                  </td>
                  <td className="py-3 px-3 text-slate-500">
                    {scorer.team}
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums font-black text-sm text-accent-600 dark:text-cyan-300">
                    {scorer.goals}
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums text-slate-600 dark:text-slate-300">
                    {scorer.assists ?? 0}
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums text-slate-500">
                    {scorer.matchesPlayed ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Qualifications Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 px-2 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-600" />
          <span>Qualification Phase Finale / Ligue des Champions</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
          <span>Qualification Ligue Europa</span>
        </div>
      </div>
    </div>
  );
};
