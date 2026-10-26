import React from 'react';
import { Star, Bell, Activity } from 'lucide-react';
import { Match } from '../types';
import { Link, matchUrl, teamUrl } from '../router';
import { Logo } from './Logo';
import { ShareButton } from './ShareButton';
import { teamLogoUrl } from '../services/football';

interface MatchRowProps {
  match: Match;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onSelectMatch: (match: Match) => void;
  onQuickAlertToggle?: (matchId: string) => void;
}

// Nom d'équipe cliquable (page équipe) pour les vrais matchs
const TeamName: React.FC<{ real: boolean; id: string; name: string; className: string }> = ({ real, id, name, className }) =>
  real && /^\d+$/.test(id) ? (
    <Link to={teamUrl(id)} onClick={(e) => e.stopPropagation()} className={`${className} hover:text-accent-600 dark:hover:text-cyan-300`}>
      {name}
    </Link>
  ) : (
    <span className={className}>{name}</span>
  );

export const MatchRow: React.FC<MatchRowProps> = ({
  match,
  isFavorite,
  onToggleFavorite,
  onSelectMatch,
  onQuickAlertToggle,
}) => {
  const isReal = match.id.startsWith('apif-');
  const isGoalHighlighted = match.lastGoalHighlight && (Date.now() - match.lastGoalHighlight.timestamp < 12000);

  const renderStatus = () => {
    if (match.status === 'HALF_TIME') {
      return (
        <span className="text-xs font-bold text-accent-600 dark:text-cyan-300 whitespace-nowrap">
          Mi-temps
        </span>
      );
    }
    if (match.status === 'FINISHED') {
      return (
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
          Terminé
        </span>
      );
    }
    if (match.status === 'SCHEDULED') {
      return (
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
          {match.startTime}
        </span>
      );
    }
    // Live minutes
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-accent-600 dark:text-cyan-300 tabular-nums whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-600 dark:bg-accent-500 animate-ping inline-block" />
        {match.periodLabel ?? `${match.minute}'`}
      </span>
    );
  };

  return (
    <div
      onClick={() => onSelectMatch(match)}
      className={`group relative flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 transition-all cursor-pointer border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
        isGoalHighlighted ? 'bg-amber-50/70 dark:bg-amber-950/20' : 'bg-transparent'
      } ${match.isLive ? 'fs-live-row' : ''}`}
    >
      {/* Goal flash glow indicator */}
      {isGoalHighlighted && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-accent-600 animate-pulse" />
      )}

      {/* Left: Star Button */}
      <div className="flex items-center pr-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(match.id);
          }}
          className="p-1 -m-1 rounded-full text-slate-300 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
          title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-label="Favori"
        >
          <Star
            className={`w-4 h-4 transition-transform group-hover:scale-110 ${
              isFavorite
                ? 'fill-amber-400 text-amber-400 dark:fill-amber-400 dark:text-amber-400'
                : ''
            }`}
          />
        </button>
      </div>

      {/* Middle: Teams List (Flashscore 2-row layout) */}
      <div className="flex-1 min-w-0 pr-4">
        {/* Home Team */}
        <div className="flex items-center justify-between py-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <Logo src={isReal ? teamLogoUrl(match.homeTeam.id) : undefined} fallback={match.homeTeam.logo} size={20} />
            <TeamName
              real={isReal}
              id={match.homeTeam.id}
              name={match.homeTeam.name}
              className={`text-sm truncate font-medium ${
                match.score.home > match.score.away && match.status === 'FINISHED'
                  ? 'font-bold text-slate-900 dark:text-white'
                  : 'text-slate-800 dark:text-slate-200'
              }`}
            />
            {/* Red card pill if applicable */}
            {match.hasRedCard && match.hasRedCard.home > 0 && (
              <span className="px-1 py-0.2 text-[10px] font-bold rounded bg-accent-600 text-white shrink-0 shadow-xs">
                {match.hasRedCard.home}
              </span>
            )}
          </div>
        </div>

        {/* Away Team */}
        <div className="flex items-center justify-between py-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <Logo src={isReal ? teamLogoUrl(match.awayTeam.id) : undefined} fallback={match.awayTeam.logo} size={20} />
            <TeamName
              real={isReal}
              id={match.awayTeam.id}
              name={match.awayTeam.name}
              className={`text-sm truncate font-medium ${
                match.score.away > match.score.home && match.status === 'FINISHED'
                  ? 'font-bold text-slate-900 dark:text-white'
                  : 'text-slate-800 dark:text-slate-200'
              }`}
            />
            {/* Red card pill if applicable */}
            {match.hasRedCard && match.hasRedCard.away > 0 && (
              <span className="px-1 py-0.2 text-[10px] font-bold rounded bg-accent-600 text-white shrink-0 shadow-xs">
                {match.hasRedCard.away}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Status & Scores (Matching Screenshot 3) */}
      <div className="flex items-center gap-3 shrink-0">
        
        {/* Status / Minute */}
        <div className="w-16 text-right flex justify-end">
          {renderStatus()}
        </div>

        {/* Scores Block */}
        {match.status !== 'SCHEDULED' ? (
          <div className="flex flex-col items-center justify-center font-bold text-sm w-7 tabular-nums">
            <span
              className={`transition-all ${
                match.isLive
                  ? 'text-accent-600 dark:text-cyan-300 font-extrabold'
                  : 'text-slate-900 dark:text-white'
              } ${isGoalHighlighted && match.lastGoalHighlight?.team === 'home' ? 'scale-125 text-amber-500' : ''}`}
            >
              {match.score.home}
            </span>
            <span
              className={`transition-all ${
                match.isLive
                  ? 'text-accent-600 dark:text-cyan-300 font-extrabold'
                  : 'text-slate-900 dark:text-white'
              } ${isGoalHighlighted && match.lastGoalHighlight?.team === 'away' ? 'scale-125 text-amber-500' : ''}`}
            >
              {match.score.away}
            </span>
          </div>
        ) : (
          <div className="w-7 text-center text-slate-300 dark:text-slate-700 font-mono text-xs">
            -
          </div>
        )}

        {/* Quick action buttons on hover */}
        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onQuickAlertToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickAlertToggle(match.id);
              }}
              className="p-1 text-slate-400 hover:text-accent-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              title="Configurer alertes du match"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
          )}
          {isReal && (
            <ShareButton
              direct
              size="sm"
              title={`${match.homeTeam.name} - ${match.awayTeam.name}`}
              text={match.status === 'SCHEDULED' ? `${match.leagueName} à ${match.startTime}` : `${match.score.home}-${match.score.away} · ${match.leagueName}`}
              path={matchUrl(match.id)}
              className="flex"
            />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectMatch(match);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            title="Terrain 2D & Stats en direct"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
