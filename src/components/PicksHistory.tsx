import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { fetchPicksHistory, HistoryEntry, HistoryStats } from '../services/picks';

const RESULT_LABEL: Record<HistoryEntry['result'], string> = {
  won: 'Gagné',
  lost: 'Perdu',
  pending: 'En attente',
  void: 'Annulé',
};

const RESULT_STYLE: Record<HistoryEntry['result'], string> = {
  won: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  lost: 'bg-red-500/15 text-red-700 dark:text-red-300',
  pending: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  void: 'bg-slate-500/10 text-slate-500 dark:text-slate-400',
};

export const PicksHistory: React.FC = () => {
  const [data, setData] = useState<{ stats: HistoryStats; entries: HistoryEntry[] } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPicksHistory().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  if (!data || data.stats.total === 0) return null;
  const { stats, entries } = data;
  const settled = stats.won + stats.lost;

  return (
    <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
          <History className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-300" />
          Historique des pronostics
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {stats.rate !== null ? (
            <span>
              <strong className="tabular-nums text-slate-900 dark:text-white">{stats.rate}%</strong> de réussite sur {settled}
            </span>
          ) : (
            <span>{stats.pending} en attente de résultat</span>
          )}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
            {stats.won} gagnés, {stats.lost} perdus, {stats.pending} en attente
            {stats.void > 0 ? `, ${stats.void} annulés` : ''}. Les paris sont jugés sur le score à 90 minutes.
          </p>
          <ul className="divide-y divide-slate-200/60 dark:divide-white/5">
            {entries.map((e) => (
              <li key={e.fixtureId} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {e.home} vs {e.away}
                    {e.score ? <span className="ml-1.5 tabular-nums text-slate-500 dark:text-slate-400">({e.score})</span> : null}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {e.market} · confiance {e.confidence}% ·{' '}
                    {new Date(e.kickoff).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold ${RESULT_STYLE[e.result]}`}>
                  {RESULT_LABEL[e.result]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
