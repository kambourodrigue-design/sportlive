import React, { useEffect, useState } from 'react';
import { 
  X, 
  Star, 
  Bell, 
  Activity, 
  ListOrdered, 
  BarChart2, 
  Users, 
  ShieldAlert,
  Flame,
  Zap,
  Clock,
  MapPin,
  Check
} from 'lucide-react';
import { Match, MatchEvent, MatchLineup } from '../types';
import { useMatchDetail } from '../hooks/useMatchDetail';

interface MatchDetailModalProps {
  match: Match | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onSimulateGoal: (matchId: string) => void;
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  match,
  onClose,
  isFavorite,
  onToggleFavorite,
  onSimulateGoal,
}) => {
  const [activeTab, setActiveTab] = useState<'tracker' | 'summary' | 'stats' | 'lineups' | 'h2h'>('tracker');
  const [matchAlertsActive, setMatchAlertsActive] = useState<boolean>(true);

  // Vrai match (API) : on charge ses vraies stats / compositions ; match de démonstration : données simulées
  const isReal = !!match && match.id.startsWith('apif-');
  const detail = useMatchDetail(isReal && match ? match.id : null, isReal && match?.isLive ? 120000 : null);

  useEffect(() => {
    if (isReal) setActiveTab('summary'); // le « terrain 2D » est une simulation : pas pour les vrais matchs
  }, [match?.id, isReal]);

  if (!match) return null;

  const emptyLineup: MatchLineup = { formation: '', coach: '', startingXI: [], substitutes: [] };
  const homeLineup = (isReal ? detail.data?.homeLineup : match.homeLineup) ?? emptyLineup;
  const awayLineup = (isReal ? detail.data?.awayLineup : match.awayLineup) ?? emptyLineup;
  const lineupsMissing = isReal && (!detail.data?.homeLineup || !detail.data?.awayLineup);
  const events = isReal && detail.data && detail.data.events.length > 0 ? detail.data.events : match.events;
  const statRows = isReal
    ? detail.data?.stats ?? []
    : [
        { label: 'Possession', val: match.stats.possession, unit: '%' },
        { label: 'Expected Goals (xG)', val: match.stats.xG, unit: '' },
        { label: 'Tirs cadrés', val: match.stats.shotsOnTarget, unit: '' },
        { label: 'Total des tirs', val: match.stats.totalShots, unit: '' },
        { label: 'Corners', val: match.stats.corners, unit: '' },
        { label: 'Fautes', val: match.stats.fouls, unit: '' },
        { label: 'Hors-jeux', val: match.stats.offsides, unit: '' },
        { label: 'Cartons jaunes', val: match.stats.yellowCards, unit: '' },
        { label: 'Arrêts du gardien', val: match.stats.saves, unit: '' },
      ];

  const renderEventIcon = (event: MatchEvent) => {
    switch (event.type) {
      case 'GOAL':
        return <span className="text-sm">⚽</span>;
      case 'YELLOW_CARD':
        return <span className="w-2.5 h-3.5 bg-amber-400 rounded-xs inline-block" />;
      case 'RED_CARD':
        return <span className="w-2.5 h-3.5 bg-red-600 rounded-xs inline-block" />;
      case 'SUBSTITUTION':
        return <span className="text-xs">🔄</span>;
      case 'VAR_CANCELLED':
        return <span className="text-xs font-mono font-bold text-indigo-500">VAR</span>;
      default:
        return <span className="text-xs">⏱️</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Top bar with back / favorite / bell / close */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 truncate">
            <span className="text-base shrink-0">{match.leagueFlag}</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              {match.leagueName} {match.round ? `· ${match.round}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Match alerts toggle */}
            <button
              onClick={() => setMatchAlertsActive(!matchAlertsActive)}
              className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                matchAlertsActive
                  ? 'bg-accent-50 text-accent-600 dark:bg-accent-950/50 dark:text-cyan-300'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title={matchAlertsActive ? "Alertes actives pour ce match" : "Activer alertes"}
            >
              <Bell className="w-4 h-4 fill-current" />
            </button>

            {/* Favorite button */}
            <button
              onClick={() => onToggleFavorite(match.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 transition-colors"
              title="Ajouter aux favoris"
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Big Scoreboard Banner */}
        <div className="p-4 sm:p-6 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950/80 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800 text-center">
          
          {/* Status badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mb-4">
            {match.isLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-accent-600 animate-ping" />
                <span className="text-accent-600 dark:text-cyan-300 font-extrabold uppercase tracking-wide">
                  {match.status === 'HALF_TIME' ? 'Mi-temps' : `${match.minute}' En Direct`}
                </span>
              </>
            ) : match.status === 'FINISHED' ? (
              <span className="text-slate-500 uppercase tracking-wide">Terminé</span>
            ) : (
              <span className="text-slate-500 uppercase tracking-wide">{match.startTime}</span>
            )}
          </div>

          {/* Teams and Scores */}
          <div className="grid grid-cols-7 items-center max-w-lg mx-auto">
            
            {/* Home Team */}
            <div className="col-span-3 flex flex-col items-center">
              <div className="text-3xl sm:text-4xl select-none mb-2 drop-shadow-sm">
                {match.homeTeam.logo}
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white text-center leading-tight">
                {match.homeTeam.name}
              </h3>
              {match.homeTeam.rank && (
                <span className="text-[11px] text-slate-400 mt-0.5">#{match.homeTeam.rank} au classement</span>
              )}
            </div>

            {/* Central Score */}
            <div className="col-span-1 flex flex-col items-center justify-center">
              {match.status !== 'SCHEDULED' ? (
                <div className="flex items-center gap-2 font-black text-3xl sm:text-4xl tracking-tight text-slate-900 dark:text-white tabular-nums">
                  <span className={match.isLive ? 'text-accent-600 dark:text-cyan-300' : ''}>{match.score.home}</span>
                  <span className="text-slate-300 dark:text-slate-600 text-2xl font-light">-</span>
                  <span className={match.isLive ? 'text-accent-600 dark:text-cyan-300' : ''}>{match.score.away}</span>
                </div>
              ) : (
                <span className="text-sm font-semibold text-slate-500">VS</span>
              )}
              {match.score.htHome !== undefined && (
                <span className="text-[11px] text-slate-400 tabular-nums mt-1">
                  ({match.score.htHome} - {match.score.htAway})
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="col-span-3 flex flex-col items-center">
              <div className="text-3xl sm:text-4xl select-none mb-2 drop-shadow-sm">
                {match.awayTeam.logo}
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white text-center leading-tight">
                {match.awayTeam.name}
              </h3>
              {match.awayTeam.rank && (
                <span className="text-[11px] text-slate-400 mt-0.5">#{match.awayTeam.rank} au classement</span>
              )}
            </div>

          </div>

          {/* Quick simulator goal test */}
          {match.isLive && !isReal && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-2">
              <button
                onClick={() => onSimulateGoal(match.id)}
                className="px-3 py-1 rounded-lg bg-accent-600 hover:bg-accent-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Simuler un but sur ce match</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center overflow-x-auto border-b border-slate-200 dark:border-slate-800 px-4 bg-white dark:bg-slate-900 scrollbar-none">
          {!isReal && (
          <button
            onClick={() => setActiveTab('tracker')}
            className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'tracker'
                ? 'border-accent-600 text-accent-600 dark:text-cyan-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Terrain 2D</span>
          </button>
          )}
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'summary'
                ? 'border-accent-600 text-accent-600 dark:text-cyan-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Résumé ({events.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'stats'
                ? 'border-accent-600 text-accent-600 dark:text-cyan-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Statistiques</span>
          </button>
          <button
            onClick={() => setActiveTab('lineups')}
            className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'lineups'
                ? 'border-accent-600 text-accent-600 dark:text-cyan-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Compositions</span>
          </button>
        </div>

        {/* Modal Body / Tab Content */}
        <div className="overflow-y-auto p-4 sm:p-5 flex-1 space-y-4">
          
          {/* TAB 1: 2D PITCH TRACKER */}
          {activeTab === 'tracker' && (
            <div className="space-y-4">
              {/* Pitch Visualizer */}
              <div className="relative w-full aspect-16/9 bg-gradient-to-br from-emerald-800 to-emerald-950 rounded-xl overflow-hidden border border-emerald-700/50 shadow-inner flex items-center justify-center">
                {/* Grass stripes */}
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-[repeating-linear-gradient(90deg,transparent,transparent_30px,rgba(255,255,255,0.08)_30px,rgba(255,255,255,0.08)_60px)]" />
                
                {/* Pitch field lines */}
                <div className="absolute inset-3 border border-white/40 rounded-sm">
                  {/* Halfway line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/40 -translate-x-1/2" />
                  {/* Center circle */}
                  <div className="absolute left-1/2 top-1/2 w-16 h-16 sm:w-20 sm:h-20 border border-white/40 rounded-full -translate-x-1/2 -translate-y-1/2" />
                  {/* Center dot */}
                  <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 bg-white/80 rounded-full -translate-x-1/2 -translate-y-1/2" />
                  
                  {/* Left Penalty box */}
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-12 sm:w-16 border-r border-y border-white/40" />
                  {/* Right Penalty box */}
                  <div className="absolute right-0 top-1/4 bottom-1/4 w-12 sm:w-16 border-l border-y border-white/40" />
                </div>

                {/* Live Ball Position */}
                {match.pitchLive && (
                  <div
                    className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 pointer-events-none z-10"
                    style={{
                      left: `${match.pitchLive.ballPosition.x}%`,
                      top: `${match.pitchLive.ballPosition.y}%`,
                    }}
                  >
                    <span className="absolute inset-0 rounded-full bg-amber-400/60 animate-ping" />
                    <span className="relative block w-5 h-5 bg-white text-black rounded-full shadow-lg border border-slate-900 text-[10px] text-center font-black">
                      ⚽
                    </span>
                  </div>
                )}

                {/* Live Phase Overlay Badge */}
                <div className="absolute bottom-4 left-4 right-4 bg-slate-950/80 backdrop-blur-md rounded-lg p-2.5 flex items-center justify-between text-white text-xs border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
                    <span className="font-bold">
                      {match.pitchLive?.phase || 'En cours de jeu'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-300">
                    {match.pitchLive?.attackingTeam === 'home'
                      ? match.homeTeam.name
                      : match.awayTeam.name}
                  </span>
                </div>
              </div>

              {/* Match info row */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold">Stade</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {match.stadium || 'Stade Municipal'}
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold">Arbitre</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {match.referee || 'Arbitre FIFA'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TIMELINE SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-3">
              {events.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">Aucun événement majeur pour l’instant.</p>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {events.map((event) => (
                    <div key={event.id} className="relative flex items-start gap-3">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0">
                        {renderEventIcon(event)}
                      </div>

                      {/* Event content */}
                      <div className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-accent-600 dark:text-cyan-300 tabular-nums">
                            {event.minute}&apos;
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {event.team === 'home' ? match.homeTeam.shortName : match.awayTeam.shortName}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                          {event.playerName}
                        </p>
                        {event.assistName && (
                          <p className="text-xs text-slate-500">Passe décisive : {event.assistName}</p>
                        )}
                        {event.detail && (
                          <p className="text-xs text-slate-400 mt-0.5">{event.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIVE STATS COMPARISON */}
          {activeTab === 'stats' && (
            <div className="space-y-3">
              {isReal && statRows.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                  {detail.loading ? 'Chargement des statistiques...' : 'Statistiques non disponibles pour ce match.'}
                </p>
              )}
              {statRows.map((stat, i) => {
                const home = stat.val[0];
                const away = stat.val[1];
                const total = (home + away) || 1;
                const homePct = Math.round((home / total) * 100);

                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-900 dark:text-white tabular-nums font-bold">
                        {home}{stat.unit}
                      </span>
                      <span className="text-slate-500 text-[11px] font-medium">{stat.label}</span>
                      <span className="text-slate-900 dark:text-white tabular-nums font-bold">
                        {away}{stat.unit}
                      </span>
                    </div>

                    {/* Progress dual bar */}
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-accent-600 transition-all duration-500 rounded-l-full"
                        style={{ width: `${homePct}%` }}
                      />
                      <div
                        className="h-full bg-slate-400 dark:bg-slate-600 transition-all duration-500 rounded-r-full"
                        style={{ width: `${100 - homePct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: LINEUPS */}
          {activeTab === 'lineups' && lineupsMissing && (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
              {detail.loading ? 'Chargement des compositions...' : "Compositions pas encore disponibles (elles sortent environ 1 h avant le coup d'envoi)."}
            </p>
          )}

          {activeTab === 'lineups' && !lineupsMissing && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                
                {/* Home starting XI */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {match.homeTeam.name}
                    </span>
                    <span className="text-[11px] font-mono text-accent-600 font-bold">
                      {homeLineup.formation}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">Coach : {homeLineup.coach}</p>
                  <div className="space-y-1.5">
                    {homeLineup.startingXI.map((player) => (
                      <div key={player.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[10px] font-mono font-bold text-slate-400 w-4 text-right">
                            {player.number}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {player.name}
                          </span>
                        </div>
                        {player.rating > 0 && (<span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 tabular-nums">
                          {player.rating}
                        </span>)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Away starting XI */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {match.awayTeam.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 font-bold">
                      {awayLineup.formation}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">Coach : {awayLineup.coach}</p>
                  <div className="space-y-1.5">
                    {awayLineup.startingXI.map((player) => (
                      <div key={player.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[10px] font-mono font-bold text-slate-400 w-4 text-right">
                            {player.number}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {player.name}
                          </span>
                        </div>
                        {player.rating > 0 && (<span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 tabular-nums">
                          {player.rating}
                        </span>)}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
