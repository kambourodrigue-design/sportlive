import React, { useMemo, useState } from 'react';
import { Check, ClipboardCopy, Ticket } from 'lucide-react';
import { AiPick } from '../services/picks';
import { ShareButton } from './ShareButton';

const fmt = (n: number) => n.toFixed(2).replace('.', ',');
const hour = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

// Choisit les paris « Sûr » encore à venir, les plus fiables d'abord (3 au maximum : un coupon long perd vite en probabilité)
export function buildCoupon(picks: AiPick[], now = Date.now()): AiPick[] {
  return picks
    .filter((p) => p.tier === 'safe' && typeof p.odds === 'number' && p.odds > 1 && new Date(p.kickoff).getTime() > now)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

export const DailyCoupon: React.FC<{ picks: AiPick[] }> = ({ picks }) => {
  const [copied, setCopied] = useState(false);
  const legs = useMemo(() => buildCoupon(picks), [picks]);
  if (legs.length < 2) return null;

  const total = legs.reduce((n, p) => n * (p.odds as number), 1);
  const chance = Math.round(legs.reduce((n, p) => n * (p.confidence / 100), 1) * 100); // probabilité que tout passe (estimation)
  const text = [
    `Coupon du jour ScoreAfrica`,
    ...legs.map((p, i) => `${i + 1}. ${p.home} vs ${p.away} : ${p.market} (cote ${fmt(p.odds as number)})`),
    `Cote totale : ${fmt(total)}`,
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${window.location.origin}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* copie impossible : le partage reste disponible */
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
          <Ticket className="w-4 h-4 text-emerald-600 dark:text-emerald-300" /> Coupon du jour
        </h3>
        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-black tabular-nums" title="Produit des cotes de chaque sélection">
          Cote totale {fmt(total)}
        </span>
      </div>
      <ol className="space-y-1.5">
        {legs.map((p) => (
          <li key={p.fixtureId} className="flex items-start justify-between gap-2 text-xs">
            <span className="min-w-0">
              <span className="block font-bold text-slate-900 dark:text-white truncate">{p.home} vs {p.away}</span>
              <span className="text-slate-500 dark:text-slate-400">{p.market} · {hour(p.kickoff)}</span>
            </span>
            <span className="shrink-0 font-black tabular-nums text-slate-900 dark:text-white">{fmt(p.odds as number)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Chance estimée que toutes les sélections passent : environ {chance}%. Un combiné est plus risqué qu'un pari simple : mise peu.
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-300/70 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardCopy className="w-3.5 h-3.5" />} {copied ? 'Coupon copié' : 'Copier le coupon'}
        </button>
        <ShareButton variant="pill" size="sm" align="left" label="Partager" title="Coupon du jour ScoreAfrica" text={text.split('\n').slice(1).join(' | ')} path="/" />
      </div>
    </div>
  );
};
