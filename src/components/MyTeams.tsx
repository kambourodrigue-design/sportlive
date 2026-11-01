import React from 'react';
import { BellRing, X } from 'lucide-react';
import { Link, teamUrl } from '../router';
import { useFollowedTeams } from '../services/followTeams';

// Bandeau « Mes équipes » de l'onglet Favoris
export const MyTeams: React.FC = () => {
  const { teams, toggle } = useFollowedTeams();
  return (
    <div className="max-w-7xl mx-auto mt-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
        <BellRing className="w-3.5 h-3.5 text-accent-600 dark:text-cyan-300" /> Mes équipes ({teams.length})
      </p>
      {teams.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Ouvre la page d'une équipe (touche son nom dans un match) et appuie sur « Suivre » : tu recevras une alerte à chaque but de ses matchs.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <li key={t.id} className="inline-flex items-center rounded-full border border-slate-300/70 dark:border-white/15 text-xs font-semibold text-slate-800 dark:text-slate-100">
              <Link to={teamUrl(t.id)} className="pl-3 pr-1.5 py-1.5 hover:underline">{t.name}</Link>
              <button type="button" onClick={() => toggle(t)} aria-label={`Ne plus suivre ${t.name}`} className="pr-2 pl-1 py-1.5 text-slate-400 hover:text-fuchsia-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
