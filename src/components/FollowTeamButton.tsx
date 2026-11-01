import React from 'react';
import { Bell, BellRing } from 'lucide-react';
import { FollowedTeam, useFollowedTeams } from '../services/followTeams';

// Bouton « Suivre » : l'équipe rejoint « Mes équipes » et ses matchs déclenchent des alertes de but
export const FollowTeamButton: React.FC<{ team: FollowedTeam; className?: string }> = ({ team, className = '' }) => {
  const { isFollowed, toggle } = useFollowedTeams();
  const on = isFollowed(team.id);
  return (
    <button
      type="button"
      onClick={() => toggle(team)}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
        on
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
          : 'bg-accent-600 text-white border-transparent hover:brightness-110'
      } ${className}`}
    >
      {on ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
      {on ? 'Équipe suivie' : 'Suivre'}
    </button>
  );
};
