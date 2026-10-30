import React, { useState } from 'react';
import { BarChart3, CheckCircle2, Clock, ExternalLink, History, Loader2, Lock, LogIn, RefreshCw, Sparkles, UserPlus } from 'lucide-react';
import { AccessInfo, AuthUser, claimPayment } from '../services/auth';
import { AIPicks } from './AIPicks';

interface PronosticsSectionProps {
  user: AuthUser | null;
  checking: boolean;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onSessionLost: () => void;
  onRefresh: () => Promise<void>;
}

const BENEFITS = [
  { icon: Sparkles, text: 'Les matchs les plus sûrs du jour, analysés par IA' },
  { icon: BarChart3, text: 'Probabilités 1-N-2 et niveau de confiance de chaque pronostic' },
  { icon: History, text: 'Historique complet et taux de réussite par modèle' },
];

const nf = new Intl.NumberFormat('fr-FR');
const dateFr = (ms: number) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const daysLeft = (ms: number) => Math.max(1, Math.ceil((ms - Date.now()) / 86400e3));

// Offre d'abonnement : lien de paiement, puis « J'ai payé » pour prévenir l'admin qui active le compte
const PayCard: React.FC<{ access: AccessInfo; expired: boolean; email: string; onRefresh: () => Promise<void> }> = ({ access, expired, email, onRefresh }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function declare(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await claimPayment(note);
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.error);
  }

  return (
    <section className="max-w-3xl mx-auto px-3 sm:px-4 pt-6" aria-label="Abonnement aux pronostics IA">
      <div className="fs-card rounded-3xl border p-6 sm:p-8 text-center">
        <div className="mx-auto w-16 h-16 mb-4 rounded-2xl fs-logo flex items-center justify-center text-white">
          {expired ? <Lock className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">{expired ? 'Ton essai gratuit est terminé' : "Passe à l'abonnement"}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
          Continue à recevoir les pronostics IA du jour, avec l'historique et le taux de réussite.
        </p>
        <p className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
          {nf.format(access.price)} <span className="text-base font-bold">{access.currency}</span>
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400"> / {access.days} jours</span>
        </p>

        <ol className="mt-5 max-w-sm mx-auto space-y-4 text-left text-sm text-slate-700 dark:text-slate-200">
          <li>
            <p className="font-bold mb-2">1. Effectue le paiement</p>
            <a
              href={access.link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-5 py-3 rounded-xl fs-logo text-white font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110"
            >
              Payer {nf.format(access.price)} {access.currency} <ExternalLink className="w-4 h-4" />
            </a>
          </li>
          <li>
            <p className="font-bold mb-1">2. Préviens-nous une fois payé</p>
            {sent ? (
              <p role="status" className="rounded-xl px-3 py-2 text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Demande envoyée. Ton accès sera activé dès que nous aurons vérifié le paiement. Reviens ici ensuite et appuie sur « Actualiser ».
              </p>
            ) : (
              <form onSubmit={declare} className="space-y-2">
                <input
                  type="text"
                  value={note}
                  maxLength={200}
                  onChange={(e) => setNote(e.target.value)}
                  aria-label="Numéro ou nom utilisé pour le paiement"
                  placeholder="Numéro ou nom utilisé pour payer (facultatif)"
                  className="w-full rounded-xl px-3 py-3 text-sm bg-white/80 dark:bg-white/[0.06] border border-slate-300/70 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                {error && (
                  <p role="alert" className="rounded-xl px-3 py-2 text-xs bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} J'ai payé
                </button>
              </form>
            )}
          </li>
          <li>
            <p className="font-bold mb-2">3. Actualise ton accès</p>
            <button
              onClick={async () => {
                setBusy(true);
                await onRefresh();
                setBusy(false);
              }}
              disabled={busy}
              className="w-full px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" /> Actualiser
            </button>
          </li>
        </ol>
        <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
          Compte concerné : <strong>{email}</strong>. Pas de renouvellement automatique. L'activation est manuelle : compte quelques minutes à quelques heures.
        </p>
      </div>
    </section>
  );
};

export const PronosticsSection: React.FC<PronosticsSectionProps> = ({ user, checking, onOpenAuth, onSessionLost, onRefresh }) => {
  const [showPay, setShowPay] = useState(false);

  if (checking) {
    return (
      <section className="max-w-3xl mx-auto px-3 sm:px-4 pt-6" aria-busy="true" aria-label="Pronostics IA">
        <div className="h-64 rounded-3xl bg-slate-200/60 dark:bg-white/[0.04] animate-pulse" />
      </section>
    );
  }

  if (!user) {
    return (
      <section className="max-w-3xl mx-auto px-3 sm:px-4 pt-6" aria-label="Pronostics IA">
        <div className="fs-card rounded-3xl border p-6 sm:p-8 text-center">
          <div className="relative mx-auto w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-2xl fs-logo flex items-center justify-center text-white">
              <Sparkles className="w-8 h-8" />
            </div>
            <span className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-accent-600 dark:text-cyan-300" />
            </span>
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Pronostics <span className="fs-text-gradient">IA</span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
            Cette section est réservée aux membres. Crée ton compte pour profiter de 5 jours d'essai gratuit, ou connecte-toi.
          </p>

          <ul className="mt-5 space-y-2.5 text-left max-w-md mx-auto">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                <span className="mt-0.5 p-1.5 rounded-lg bg-accent-500/15 text-accent-600 dark:text-cyan-300 shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              onClick={() => onOpenAuth('register')}
              className="px-5 py-3 rounded-xl bg-accent-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110"
            >
              <UserPlus className="w-4 h-4" />
              Créer un compte (5 jours gratuits)
            </button>
            <button
              onClick={() => onOpenAuth('login')}
              className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LogIn className="w-4 h-4" />
              Se connecter
            </button>
          </div>
        </div>
      </section>
    );
  }

  const access = user.access;
  // Essai terminé : offre d'abonnement à la place des pronostics
  if (access.status === 'expired') {
    return (
      <div>
        <PayCard access={access} expired email={user.email} onRefresh={onRefresh} />
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Bonjour <strong className="text-slate-900 dark:text-white">{user.name}</strong>, voici les pronostics IA du moment.
        </p>
        {access.status === 'trial' && access.payments && access.until && (
          <button
            onClick={() => setShowPay((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
          >
            <Clock className="w-3.5 h-3.5" /> Essai gratuit : {daysLeft(access.until)} jour{daysLeft(access.until) > 1 ? 's' : ''} restant{daysLeft(access.until) > 1 ? 's' : ''} · S'abonner
          </button>
        )}
        {access.status === 'premium' && access.until && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> Abonnement actif jusqu'au {dateFr(access.until)}
          </span>
        )}
      </div>
      {showPay && access.status === 'trial' && <PayCard access={access} expired={false} email={user.email} onRefresh={onRefresh} />}
      <AIPicks onAuthLost={onSessionLost} onAccessLost={() => void onRefresh()} defaultHistoryOpen />
    </div>
  );
};

// Bandeau compact affiché sur l'onglet « Tous » : mène à la section Pronostics IA
export const PicksTeaser: React.FC<{ loggedIn: boolean; onOpen: () => void }> = ({ loggedIn, onOpen }) => (
  <section className="max-w-7xl mx-auto px-2 sm:px-4 pt-3" aria-label="Pronostics IA">
    <button onClick={onOpen} className="w-full fs-card rounded-2xl border p-3.5 flex items-center gap-3 text-left">
      <span className="p-2 rounded-xl fs-logo text-white shrink-0">
        <Sparkles className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-slate-900 dark:text-white">Pronostics IA</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          {loggedIn ? 'Voir les matchs les plus sûrs du jour' : 'Connecte-toi pour débloquer les pronostics du jour'}
        </span>
      </span>
      {!loggedIn && <Lock className="w-4 h-4 text-accent-600 dark:text-cyan-300 shrink-0" />}
    </button>
  </section>
);
