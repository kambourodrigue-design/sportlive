import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MinusCircle, Play, Sparkles } from 'lucide-react';
import { adminRequest } from '../services/articles';

interface Diag {
  ts: number;
  trigger: 'visite' | 'auto' | 'admin';
  status: 'ok' | 'empty' | 'error';
  reason: string;
  fixtures: number;
  analyzed: number;
  withOdds: number;
  candidates: number;
  aiKept: number;
  model?: string;
  quotaRemaining: number | null;
  ms: number;
}
interface DiagResponse {
  diag: Diag | null;
  cached?: number | null;
  aiConfigured?: boolean;
  configured?: boolean;
}

const WHO = { visite: 'visiteur', auto: 'tâche automatique', admin: 'toi (admin)' } as const;
const dateFr = (ms: number) => new Date(ms).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// « Pourquoi n'y a-t-il pas de pronostics ? » : résultat de la dernière génération + bouton pour la relancer
export const AdminPicksDiag: React.FC = () => {
  const [data, setData] = useState<DiagResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const r = await adminRequest<DiagResponse>('/api/admin/picks-diag');
    if (r.ok) {
      setData(r.data);
      setError('');
    } else setError(r.error ?? 'Diagnostic indisponible.');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run() {
    setBusy(true);
    setNote('');
    const r = await adminRequest<DiagResponse & { count?: number }>('/api/admin/picks-refresh', 'POST');
    setBusy(false);
    if (r.data?.diag) setData((d) => ({ ...(d ?? { diag: null }), diag: r.data.diag }));
    if (r.ok) setNote(`Terminé : ${r.data.count ?? 0} pronostic(s).`);
    else setNote(r.error ?? 'Échec de la génération.');
    load();
  }

  const d = data?.diag ?? null;
  const Icon = d?.status === 'ok' ? CheckCircle2 : d?.status === 'error' ? AlertTriangle : MinusCircle;
  const tone = d?.status === 'ok' ? 'text-emerald-600 dark:text-emerald-300' : d?.status === 'error' ? 'text-fuchsia-600 dark:text-fuchsia-300' : 'text-amber-600 dark:text-amber-300';

  return (
    <section aria-label="Diagnostic des pronostics" className="rounded-2xl fs-card border p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-300" /> Dernière génération des pronostics
        </h2>
        <button
          onClick={run}
          disabled={busy || data?.configured === false || data?.aiConfigured === false}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-600 text-white text-xs font-bold disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Relancer maintenant
        </button>
      </div>

      {error && <p className="text-xs text-fuchsia-600 dark:text-fuchsia-300" role="alert">{error}</p>}
      {!data && !error && <p className="text-xs text-slate-500" role="status">Chargement...</p>}
      {data?.configured === false && <p className="text-xs text-slate-500">Clé API football absente : pas de pronostics.</p>}
      {data?.configured !== false && data?.aiConfigured === false && <p className="text-xs text-slate-500">Aucune clé IA (DEEPSEEK_API_KEY ou ANTHROPIC_API_KEY) : pas de pronostics.</p>}
      {data && !d && !error && <p className="text-xs text-slate-500 dark:text-slate-400">Aucune génération enregistrée pour l'instant. Appuie sur « Relancer maintenant » (utilise environ 20 requêtes API).</p>}

      {d && (
        <>
          <p className={`flex items-start gap-2 text-sm font-semibold ${tone}`}>
            <Icon className="w-4 h-4 mt-0.5 shrink-0" /> <span>{d.reason}</span>
          </p>
          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {[
              ['Matchs trouvés', d.fixtures],
              ['Analysés', d.analyzed],
              ['Avec cotes', d.withOdds],
              ['Paris retenus', d.candidates],
              ['Validés par l\'IA', d.aiKept],
            ].map(([label, v]) => (
              <div key={label as string} className="rounded-xl bg-slate-100/70 dark:bg-white/[0.05] py-2">
                <dd className="text-lg font-black tabular-nums">{v}</dd>
                <dt className="text-[10px] text-slate-500 dark:text-slate-400">{label}</dt>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {dateFr(d.ts)} · lancé par {WHO[d.trigger]} · {Math.round(d.ms / 100) / 10} s
            {d.model && <> · modèle {d.model === 'claude' ? 'Claude' : 'DeepSeek'}</>}
            {typeof d.quotaRemaining === 'number' && <> · quota restant {d.quotaRemaining}</>}
            {typeof data?.cached === 'number' && <> · en cache aujourd'hui : {data.cached}</>}
          </p>
        </>
      )}
      {note && <p className="text-xs text-slate-600 dark:text-slate-300" role="status">{note}</p>}
    </section>
  );
};
