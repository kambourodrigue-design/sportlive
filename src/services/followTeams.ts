// « Mes équipes » : équipes suivies (stockées sur l'appareil) + prochains matchs connus, pour les alertes de but
import { useSyncExternalStore } from 'react';
import { Match } from '../types';

export interface FollowedTeam {
  id: string; // identifiant API-Football de l'équipe
  name: string;
}
export interface UpcomingKo {
  id: string; // « apif-123 »
  ko: string; // coup d'envoi ISO
  team: string; // équipe suivie concernée
}

const TEAMS_KEY = 'fs_followed_teams';
const NEXT_KEY = 'fs_team_next';
const MAX_TEAMS = 20;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : le suivi vaut pour cette session seulement */
  }
};

let teams: FollowedTeam[] = Array.isArray(read(TEAMS_KEY, [])) ? read<FollowedTeam[]>(TEAMS_KEY, []).filter((t) => t && typeof t.id === 'string') : [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const koOf = (m: Match): string | null => {
  const t = new Date(`${m.date}T${m.startTime}:00`);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
};

// Mémorise les prochains matchs d'une équipe suivie (pour alerter même si le match n'est pas dans la liste du jour)
export function rememberUpcoming(teamId: string, matches: Match[]) {
  const all = read<UpcomingKo[]>(NEXT_KEY, []).filter((x) => x.team !== teamId);
  for (const m of matches) {
    const ko = koOf(m);
    if (m.id.startsWith('apif-') && ko && m.status !== 'FINISHED') all.push({ id: m.id, ko, team: teamId });
  }
  write(NEXT_KEY, pruneUpcoming(all));
}

const pruneUpcoming = (list: UpcomingKo[]) => {
  const limit = Date.now() - 4 * 3600e3; // un match commencé il y a plus de 4 h n'a plus besoin d'être surveillé
  return list.filter((x) => new Date(x.ko).getTime() > limit && teams.some((t) => t.id === x.team)).slice(0, 60);
};

export const readUpcoming = (): UpcomingKo[] => pruneUpcoming(read<UpcomingKo[]>(NEXT_KEY, []));

export function toggleTeam(team: FollowedTeam) {
  const has = teams.some((t) => t.id === team.id);
  teams = has ? teams.filter((t) => t.id !== team.id) : [...teams, team].slice(-MAX_TEAMS);
  write(TEAMS_KEY, teams);
  emit();
}

export function useFollowedTeams(): { teams: FollowedTeam[]; isFollowed: (id: string) => boolean; toggle: (t: FollowedTeam) => void } {
  const list = useSyncExternalStore(subscribe, () => teams, () => teams);
  return { teams: list, isFollowed: (id) => list.some((t) => t.id === id), toggle: toggleTeam };
}
