import React from 'react';
import { Link } from '../router';

const GROUPS = [
  {
    title: 'ScoreAfrica',
    links: [
      { to: '/a-propos', label: 'À propos' },
      { to: '/contact', label: 'Contact' },
      { to: '/jeu-responsable', label: 'Jeu responsable' },
    ],
  },
  {
    title: 'Informations légales',
    links: [
      { to: '/conditions', label: "Conditions d'utilisation" },
      { to: '/confidentialite', label: 'Confidentialité' },
      { to: '/cookies', label: 'Cookies' },
    ],
  },
];

export const Footer: React.FC = () => (
  <footer className="mt-10 border-t border-slate-200/70 dark:border-white/10 fs-surface">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid gap-x-6 gap-y-8 grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr]">
      <div className="col-span-2 sm:col-span-1">
        <p className="font-black font-display text-lg tracking-wide text-slate-900 dark:text-white">
          SCORE<span className="fs-text-gradient">AFRICA</span>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400 max-w-sm">
          Résultats en direct du football, du basket et du tennis, avec une couverture dédiée aux championnats africains, des classements et des pronostics IA.
        </p>
      </div>
      {GROUPS.map((g) => (
        <nav key={g.title} aria-label={g.title}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">{g.title}</p>
          <ul className="space-y-2">
            {g.links.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-sm text-slate-700 dark:text-slate-300 hover:text-accent-600 dark:hover:text-cyan-300">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
    <div className="border-t border-slate-200/70 dark:border-white/10">
      <p className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
        © {new Date().getFullYear()} ScoreAfrica. Données sportives fournies par API-Football / API-Sports. Les pronostics sont indicatifs et ne garantissent aucun gain. Réservé aux personnes majeures. Jouez de façon responsable.
      </p>
    </div>
  </footer>
);
