import React, { useState } from 'react';
import { ArrowLeft, Check, Share2, Star } from 'lucide-react';
import { goBack } from '../router';

interface PageHeaderProps {
  sport?: string;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  shareTitle: string;
}

// En-tête des pages de détail sur mobile (retour, sport, partage, favori) ; sur ordinateur la barre du site reste affichée
export const PageHeader: React.FC<PageHeaderProps> = ({ sport = 'Football', favorite, onToggleFavorite, shareTitle }) => {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* partage annulé */
    }
  };

  return (
    <div className="md:hidden sticky top-0 z-40 fs-bar fs-bar-top border-b">
      <div className="h-14 px-2 flex items-center justify-between">
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={() => goBack('/')} className="p-2.5 rounded-lg text-slate-700 dark:text-slate-200" aria-label="Retour">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <span className="text-lg font-extrabold text-slate-900 dark:text-white truncate">{sport}</span>
        </div>
        <div className="flex items-center">
          <button onClick={share} className="p-2.5 rounded-lg text-slate-700 dark:text-slate-200" aria-label="Partager cette page">
            {copied ? <Check className="w-6 h-6 text-emerald-500" /> : <Share2 className="w-6 h-6" />}
          </button>
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className="p-2.5 rounded-lg text-slate-700 dark:text-slate-200"
              aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              aria-pressed={favorite}
            >
              <Star className={`w-6 h-6 ${favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
          )}
        </div>
      </div>
      {copied && (
        <p role="status" className="absolute right-3 top-14 mt-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-lg">
          Lien copié
        </p>
      )}
    </div>
  );
};

interface TabBarProps<T extends string> {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}

// Onglets façon Flashscore : majuscules, défilement horizontal, soulignement de l'onglet actif
export function TabBar<T extends string>({ tabs, active, onChange }: TabBarProps<T>) {
  return (
    <div className="sticky top-14 md:top-16 z-30 fs-bar border-b">
      <div className="flex overflow-x-auto scrollbar-none px-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={`shrink-0 px-4 py-3.5 text-[13px] font-bold uppercase tracking-wide border-b-[3px] -mb-px whitespace-nowrap ${
              active === t.id
                ? 'border-accent-500 text-accent-600 dark:text-cyan-300'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Bandeau de section gris (ex. « 1. MI-TEMPS »)
export const SectionBand: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div className="flex items-center justify-between px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-white/[0.05]">
    <h2>{title}</h2>
    {right && <span className="tabular-nums text-slate-700 dark:text-slate-200">{right}</span>}
  </div>
);
