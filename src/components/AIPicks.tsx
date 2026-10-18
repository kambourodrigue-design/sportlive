import React, { useEffect, useState } from 'react';
import { Sparkles, Clock } from 'lucide-react';
import { fetchPicks, readCachedPicks, PicksResult } from '../services/picks';
import { PicksHistory } from './PicksHistory';

const formatKickoff = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

export const AIPicks: React.FC = () => {
  const [result, setResult] = useState<PicksResult | null>(() => readCachedPicks());

  useEffect(() => {
    let alive = true;
    fetchPicks().then((r) => {
      if (!alive) return;
      // En cas d'erreur réseau, on garde les pronostics déjà affichés
      setResult((prev) => (r.state === 'error' && prev?.state === 'ok' ? prev : r));
    });
    return () => {
      alive = false;
    };
  }, []);

  const hint =
    result?.state === 'demo'
      ? 'Mode démo : ajoutez API_FOOTBALL_KEY et ANTHROPIC_API_KEY pour activer les pronostics.'
      : result?.state === 'no-ai'
        ? 'Ajoutez ANTHROPIC_API_KEY pour activer les pronostics IA.'
        : result?.state === 'empty'
          ? "Aucun match n'est assez fiable pour le moment. Revenez plus tard."
          : result?.state === 'error'
            ? 'Pronostics indisponibles pour le moment.'
            : null;

  return (
    <section className="max-w-7xl mx-auto px-2 sm:px-4 pt-3" aria-label="Pronostics IA">
      <div className="rounded-2xl fs-card border p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Sparkles className="w-4 h-4 text-cyan-500 dark:text-cyan-300" />
            Pronostics IA : les matchs les plus sûrs
          </h2>
        </div>

        {result === null && (
          <div className="grid gap-2.5 sm:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-200/60 dark:bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        )}

        {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}

        {result?.state === 'ok' && (
          <div className="grid gap-2.5 sm:grid-cols-3">
            {result.picks.map((p) => (
              <article
                key={p.fixtureId}
                className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="truncate">{p.league}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatKickoff(p.kickoff)}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {p.home} vs {p.away}
                </h3>
                <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">{p.market}</p>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Confiance</span>
                    <span className="font-bold tabular-nums text-slate-900 dark:text-white">{p.confidence}%</span>
                  </div>
                  <div
                    className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={p.confidence}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                      style={{ width: `${p.confidence}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{p.reasoning}</p>
                {p.model && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Analysé par {p.model === 'claude' ? 'Claude' : 'DeepSeek'}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}

        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
          Analyses indicatives générées par IA, sans aucune garantie de résultat. Jouez de façon responsable.
        </p>

        <PicksHistory reloadKey={result?.state ?? 'loading'} />
      </div>
    </section>
  );
};
