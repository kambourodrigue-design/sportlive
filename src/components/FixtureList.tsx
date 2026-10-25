import React from 'react';
import { Match } from '../types';
import { Link, matchUrl } from '../router';
import { Logo } from './Logo';
import { teamLogoUrl } from '../services/football';

const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const statusText = (m: Match) => {
  if (m.isLive) return m.status === 'HALF_TIME' ? 'Mi-temps' : `${m.minute}'`;
  if (m.status === 'FINISHED') return 'Terminé';
  if (m.status === 'POSTPONED') return 'Reporté';
  return m.startTime;
};

export const FixtureRow: React.FC<{ match: Match }> = ({ match }) => {
  const showScore = match.status !== 'SCHEDULED' && match.status !== 'POSTPONED';
  const real = match.id.startsWith('apif-');
  return (
    <Link
      to={matchUrl(match.id)}
      className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-100/70 dark:hover:bg-white/[0.04] rounded-lg"
    >
      <span
        className={`w-12 shrink-0 text-xs font-bold tabular-nums ${
          match.isLive ? 'text-accent-600 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {statusText(match)}
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        {[match.homeTeam, match.awayTeam].map((t, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <Logo src={real ? teamLogoUrl(t.id) : undefined} fallback={t.logo} size={18} />
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{t.name}</span>
          </div>
        ))}
      </div>
      {showScore && (
        <div className="flex flex-col gap-1 text-sm font-black tabular-nums text-right shrink-0">
          <span className={match.isLive ? 'text-accent-600 dark:text-cyan-300' : 'text-slate-900 dark:text-white'}>{match.score.home}</span>
          <span className={match.isLive ? 'text-accent-600 dark:text-cyan-300' : 'text-slate-900 dark:text-white'}>{match.score.away}</span>
        </div>
      )}
    </Link>
  );
};

interface FixtureListProps {
  matches: Match[];
  order?: 'asc' | 'desc';
  showLeague?: boolean;
  emptyText?: string;
}

export const FixtureList: React.FC<FixtureListProps> = ({ matches, order = 'asc', showLeague = false, emptyText = 'Aucun match à afficher.' }) => {
  if (matches.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>;
  }
  const dates = [...new Set(matches.map((m) => m.date))].sort();
  if (order === 'desc') dates.reverse();
  return (
    <div>
      {dates.map((d) => (
        <section key={d}>
          <h3 className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-white/[0.03] border-y border-slate-200/60 dark:border-white/5">
            {dayLabel(d)}
          </h3>
          <div className="p-1 divide-y divide-slate-100 dark:divide-white/5">
            {matches
              .filter((m) => m.date === d)
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((m) => (
                <div key={m.id}>
                  {showLeague && (
                    <p className="px-3.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {m.leagueCountry} · {m.leagueName}
                    </p>
                  )}
                  <FixtureRow match={m} />
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
};
