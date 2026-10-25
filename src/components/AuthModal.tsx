import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail, Sparkles, User, X } from 'lucide-react';
import { AuthResult } from '../services/auth';

export type AuthMode = 'login' | 'register';

interface AuthModalProps {
  mode: AuthMode | null; // null = fermée
  onClose: () => void;
  onChangeMode: (mode: AuthMode) => void;
  onSubmit: (mode: AuthMode, data: { email: string; password: string; name?: string }) => Promise<AuthResult>;
}

const inputClass =
  'w-full pl-10 pr-3 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500/60 focus:border-accent-500';

export const AuthModal: React.FC<AuthModalProps> = ({ mode, onClose, onChangeMode, onSubmit }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  // Réinitialise le formulaire à chaque ouverture / changement d'onglet
  useEffect(() => {
    if (!mode) return;
    setError(null);
    setPassword('');
    setShowPassword(false);
    const t = setTimeout(() => firstField.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onClose]);

  if (!mode) return null;
  const isRegister = mode === 'register';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (isRegister && password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setLoading(true);
    const r = await onSubmit(mode, { email: email.trim(), password, name: isRegister ? name.trim() : undefined });
    setLoading(false);
    if (r.ok) {
      setPassword('');
      onClose();
    } else {
      setError(r.error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-slide-down"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="mx-auto w-12 h-12 rounded-2xl fs-logo flex items-center justify-center text-white mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 id="auth-title" className="text-xl font-black text-slate-900 dark:text-white">
            {isRegister ? 'Créer mon compte' : 'Se connecter'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isRegister ? 'Gratuit, pour accéder aux pronostics IA.' : 'Accède à tes pronostics IA.'}
          </p>
        </div>

        <div className="px-6">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80" role="tablist">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                type="button"
                onClick={() => onChangeMode(m)}
                className={`py-2 rounded-lg text-xs font-bold transition ${
                  mode === m
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pt-4 pb-6 space-y-3" noValidate>
          {isRegister && (
            <label className="block">
              <span className="sr-only">Prénom ou pseudo</span>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={firstField}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Prénom ou pseudo (facultatif)"
                  autoComplete="nickname"
                  maxLength={40}
                  className={inputClass}
                />
              </div>
            </label>
          )}

          <label className="block">
            <span className="sr-only">Adresse e-mail</span>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={isRegister ? undefined : firstField}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adresse e-mail"
                autoComplete="email"
                inputMode="email"
                className={inputClass}
              />
            </div>
          </label>

          <label className="block">
            <span className="sr-only">Mot de passe</span>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? 'Mot de passe (8 caractères min.)' : 'Mot de passe'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                maxLength={128}
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          {error && (
            <p role="alert" className="rounded-xl px-3 py-2 text-xs font-semibold bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl bg-accent-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRegister ? 'Créer mon compte' : 'Se connecter'}
          </button>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            {isRegister ? 'Déjà inscrit ?' : 'Pas encore de compte ?'}{' '}
            <button
              type="button"
              onClick={() => onChangeMode(isRegister ? 'login' : 'register')}
              className="font-bold text-accent-600 dark:text-cyan-300 hover:underline"
            >
              {isRegister ? 'Se connecter' : 'Créer un compte'}
            </button>
          </p>

          <p className="text-[10px] leading-relaxed text-center text-slate-400 dark:text-slate-500">
            Réservé aux personnes majeures. Les pronostics sont indicatifs et ne garantissent aucun gain. Jouez de façon responsable.
          </p>
        </form>
      </div>
    </div>
  );
};
