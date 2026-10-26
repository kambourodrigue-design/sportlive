import React from 'react';
import { BellRing, Check, Loader2 } from 'lucide-react';
import { usePush } from '../hooks/usePush';
import { needsHomeScreenInstall } from '../services/push';

type PushState = ReturnType<typeof usePush>;

// Carte « Alertes de but même site fermé » (réglages et onglet Favoris)
export const PushCard: React.FC<{ push: PushState; compact?: boolean }> = ({ push, compact }) => {
  const { supported, permission, subscribed, busy, error, enable, disable } = push;
  const iosInstall = supported ? needsHomeScreenInstall() : /iphone|ipad|ipod/i.test(navigator.userAgent);

  let hint = 'Reçois une notification à chaque but de tes matchs favoris, même quand le site est fermé.';
  if (!supported) hint = iosInstall ? "Sur iPhone, ajoute d'abord ScoreAfrica à l'écran d'accueil (Partager, puis « Sur l'écran d'accueil »), puis rouvre-le depuis l'icône." : "Ce navigateur ne gère pas les notifications. Essaie Chrome ou Firefox.";
  else if (iosInstall) hint = "Sur iPhone, ajoute d'abord ScoreAfrica à l'écran d'accueil (Partager, puis « Sur l'écran d'accueil »), puis active les alertes depuis l'icône.";
  else if (permission === 'denied' && !subscribed) hint = 'Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur, puis reviens ici.';
  else if (subscribed) hint = 'Alertes actives sur cet appareil : tu reçois chaque but de tes matchs favoris (matchs réels).';

  const disabled = busy || !supported || iosInstall || (permission === 'denied' && !subscribed);

  return (
    <div className={`rounded-2xl border border-cyan-500/30 bg-cyan-500/5 ${compact ? 'p-3' : 'p-4'} flex items-start gap-3`}>
      <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 shrink-0">
        <BellRing className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Alertes de but, même site fermé</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>
        {subscribed && <p className="text-[11px] text-slate-400 mt-1">Le score est vérifié toutes les 2 minutes : la notification peut arriver avec un léger retard.</p>}
        {error && <p className="text-xs text-fuchsia-600 dark:text-fuchsia-300 mt-1" role="alert">{error}</p>}
      </div>
      <button
        onClick={subscribed ? disable : enable}
        disabled={disabled}
        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50 ${
          subscribed ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-accent-600 text-white'
        }`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : subscribed ? <Check className="w-3.5 h-3.5" /> : null}
        {subscribed ? 'Activées' : 'Activer'}
      </button>
    </div>
  );
};
