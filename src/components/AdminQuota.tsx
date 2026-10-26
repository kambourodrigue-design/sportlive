import React, { useCallback, useEffect, useState } from 'react';
import { Gauge, Loader2, RefreshCw } from 'lucide-react';
import { adminRequest } from '../services/articles';

interface Quota {
  configured: boolean;
  used?: number;
  limit?: number;
  remaining?: number;
  plan?: string | null;
  resetsAt?: string;
  error?: string;
}

const nf = new Intl.NumberFormat('fr-FR');

// Vert jusqu'à 70 %, orange jusqu'à 90 %, rouge ensuite
const level = (pct: number) =>
  pct >= 90
    ? { bar: 'bg-fuchsia-500', text: 'text-fuchsia-600 dark:text-fuchsia-300', label: 'Quota presque épuisé' }
    : pct >= 70
      ? { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-300', label: 'Quota bien entamé' }
      : { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300', label: 'Quota confortable' };

const untilReset = (iso?: string) => {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
};

export const AdminQuota: React.FC = () => {
  const [q, setQ] = useState<Quota | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const r = await adminRequest<Quota>('/api/admin/quota');
    setBusy(false);
    if (r.ok) {
      setQ(r.data);
      setError('');
    } else setError(r.error ?? 'Quota indisponible.');
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const hasCounter = q?.configured && typeof q.used === 'number' && typeof q.limit === 'number';
  const pct = hasCounter ? Math.min(100, Math.round((q!.used! / q!.limit!) * 100)) : 0;
  const lv = level(pct);

  return (
    <section aria-label="Quota de l'API football" className="rounded-2xl fs-card border p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Gauge className="w-4 h-4 text-cyan-600 dark:text-cyan-300" /> Quota API-Football
        </h2>
        <button
          onClick={load}
          disabled={busy}
          aria-label="Actualiser le quota"
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {error && <p className="text-xs text-fuchsia-600 dark:text-fuchsia-300" role="alert">{error}</p>}
      {!q && !error && <p className="text-xs text-slate-500" role="status">Chargement...</p>}
      {q && !q.configured && <p className="text-xs text-slate-500 dark:text-slate-400">Aucune clé API configurée : le site fonctionne en mode démonstration.</p>}
      {q?.configured && q.error && !hasCounter && <p className="text-xs text-fuchsia-600 dark:text-fuchsia-300" role="alert">{q.error}</p>}

      {hasCounter && (
        <>
          <div className="flex items-end justify-between gap-2">
            <p className="text-2xl font-black tabular-nums">
              {nf.format(q!.used!)}
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400"> / {nf.format(q!.limit!)} requêtes</span>
            </p>
            <p className={`text-sm font-bold tabular-nums ${lv.text}`}>{pct} %</p>
          </div>
          <div
            className="h-2.5 rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${lv.label} : ${pct} % utilisé`}
          >
            <div className={`h-full rounded-full transition-all ${lv.bar}`} style={{ width: `${Math.max(pct, 1)}%` }} />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            <span className={`font-bold ${lv.text}`}>{lv.label}</span> · {nf.format(q!.remaining ?? 0)} restantes aujourd'hui
            {untilReset(q!.resetsAt) && <> · remise à zéro dans {untilReset(q!.resetsAt)} (00h00 UTC)</>}
            {q!.plan && <> · offre {q!.plan}</>}
          </p>
          {(q!.remaining ?? 0) < 15 && (
            <p className="rounded-xl px-3 py-2 text-xs bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300" role="alert">
              Il reste très peu de requêtes : le site sert surtout son cache et les alertes de but peuvent être suspendues jusqu'à la remise à zéro.
            </p>
          )}
        </>
      )}
    </section>
  );
};
