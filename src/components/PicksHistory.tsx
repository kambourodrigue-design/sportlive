import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Clock, Flame, History, X } from 'lucide-react';
import { fetchPicksHistory, HistoryEntry, HistoryStats } from '../services/picks';

const REFRESH_MS = 120000; // le taux se met à jour tout seul, comme les scores

const BADGE: Record<HistoryEntry['result'], { label: string; cls: string }> = {
  won: { label: 'Gagné', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30' },
  lost: { label: 'Perdu', cls: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/30' },
  pending: { label: 'En attente', cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 ring-1 ring-slate-500/20' },
  void: { label: 'Annulé', cls: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 ring-1 ring-slate-500/10' },
};

const ResultBadge: React.FC<{ result: HistoryEntry['result'] }> = ({ result }) => {
  const b = BADGE[result];
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${b.cls}`}>
      {result === 'won' && <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />}
      {result === 'lost' && <X className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />}
      {result === 'pending' && <Clock className="w-3 h-3" aria-hidden="true" />}
      {b.label}
    </span>
  );
};

// Anneau du taux de réussite
const RateRing: React.FC<{ rate: number | null }> = ({ rate }) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-16 h-16 shrink-0" role="img" aria-label={rate === null ? 'Taux de réussite pas encore disponible' : `Taux de réussite ${rate} pour cent`}>
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-slate-200 dark:stroke-white/10" />
        {rate !== null && (
          <circle
            cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
            className={rate >= 50 ? 'stroke-emerald-500' : 'stroke-fuchsia-500'}
            strokeDasharray={c} strokeDashoffset={c * (1 - rate / 100)}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-black tabular-nums text-slate-900 dark:text-white">
        {rate === null ? '–' : `${rate}%`}
      </span>
    </div>
  );
};

type Period = 'all' | '30' | '7';

export const PicksHistory: React.FC<{ reloadKey?: string; defaultOpen?: boolean }> = ({ reloadKey, defaultOpen }) => {
  const [data, setData] = useState<{ stats: HistoryStats; entries: HistoryEntry[]; updatedAt?: string } | null>(null);
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [period, setPeriod] = useState<Period>('all');

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      fetchPicksHistory().then((d) => alive && d && setData(d));
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', load);
    };
  }, [reloadKey]);

  if (!data || data.stats.total === 0) return null;
  const { stats, entries } = data;
  const shown = period === 'all' ? { won: stats.won, lost: stats.lost, rate: stats.rate } : period === '30' ? stats.last30 ?? { won: 0, lost: 0, rate: null } : stats.last7 ?? { won: 0, lost: 0, rate: null };
  const settled = shown.won + shown.lost;
  const periods: [Period, string][] = [['all', 'Tout'], ['30', '30 jours'], ['7', '7 jours']];

  return (
    <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-white/10">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
          <History className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-300" />
          Historique des pronostics
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {stats.rate !== null ? (
            <span><strong className="tabular-nums text-slate-900 dark:text-white">{stats.rate}%</strong> de réussite</span>
          ) : (
            <span>{stats.pending} en attente de résultat</span>
          )}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="flex items-center gap-4">
            <RateRing rate={shown.rate} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {settled > 0 ? `${shown.won} gagnés sur ${settled} pronostics vérifiés` : 'Aucun pronostic vérifié sur cette période'}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Période du taux de réussite">
                {periods.map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setPeriod(id)}
                    aria-pressed={period === id}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${period === id ? 'bg-accent-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {stats.form && stats.form.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Forme</span>
              <span className="flex gap-1" aria-label="Derniers résultats, du plus récent au plus ancien">
                {[...stats.form].reverse().map((r, i) => (
                  <span key={i} className={`w-5 h-5 rounded-md flex items-center justify-center text-white ${r === 'won' ? 'bg-emerald-500' : 'bg-fuchsia-500'}`} title={r === 'won' ? 'Gagné' : 'Perdu'}>
                    {r === 'won' ? <Check className="w-3 h-3" strokeWidth={3.5} aria-hidden="true" /> : <X className="w-3 h-3" strokeWidth={3.5} aria-hidden="true" />}
                  </span>
                ))}
              </span>
              {stats.streak && stats.streak.count >= 2 && stats.streak.type === 'won' && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-300"><Flame className="w-3.5 h-3.5" aria-hidden="true" /> {stats.streak.count} d'affilée</span>
              )}
            </div>
          )}

          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            {stats.won} gagnés, {stats.lost} perdus, {stats.pending} en attente{stats.void > 0 ? `, ${stats.void} annulés` : ''}.
            Chaque pronostic est vérifié automatiquement après le match, sur le score à 90 minutes, et le taux se met à jour tout seul.
          </p>
          {stats.byModel && stats.byModel.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Par modèle : {stats.byModel.map((m) => `${m.model === 'claude' ? 'Claude' : 'DeepSeek'} ${m.rate}% (${m.won + m.lost} vérifiés)`).join(' · ')}
            </p>
          )}

          <ul className="mt-2 divide-y divide-slate-200/60 dark:divide-white/5">
            {entries.map((e) => (
              <li key={e.fixtureId} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {e.home} vs {e.away}
                    {e.score ? <span className="ml-1.5 tabular-nums text-slate-500 dark:text-slate-400">({e.score})</span> : null}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {e.market} · confiance {e.confidence}% · {new Date(e.kickoff).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </p>
                </div>
                <ResultBadge result={e.result} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
