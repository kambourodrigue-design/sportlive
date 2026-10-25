import React from 'react';
import { BarChart3, History, Lock, LogIn, Sparkles, UserPlus } from 'lucide-react';
import { AuthUser } from '../services/auth';
import { AIPicks } from './AIPicks';

interface PronosticsSectionProps {
  user: AuthUser | null;
  checking: boolean;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onSessionLost: () => void;
}

const BENEFITS = [
  { icon: Sparkles, text: 'Les matchs les plus sûrs du jour, analysés par IA' },
  { icon: BarChart3, text: 'Probabilités 1-N-2 et niveau de confiance de chaque pronostic' },
  { icon: History, text: 'Historique complet et taux de réussite par modèle' },
];

export const PronosticsSection: React.FC<PronosticsSectionProps> = ({ user, checking, onOpenAuth, onSessionLost }) => {
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
            Cette section est réservée aux membres. Crée ton compte gratuit ou connecte-toi pour y accéder.
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
              Créer un compte gratuit
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

  return (
    <div>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Bonjour <strong className="text-slate-900 dark:text-white">{user.name}</strong>, voici les pronostics IA du moment.
        </p>
      </div>
      <AIPicks onAuthLost={onSessionLost} defaultHistoryOpen />
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
