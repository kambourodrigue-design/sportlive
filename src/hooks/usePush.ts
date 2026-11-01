import { useCallback, useEffect, useRef, useState } from 'react';
import { Match } from '../types';
import { koOf, readUpcoming } from '../services/followTeams';
import { PushFavorite, currentSubscription, disablePush, enablePush, pushSupported, syncFavorites } from '../services/push';

const KO_KEY = 'fs_fav_ko';

const readKo = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(KO_KEY) || '{}');
  } catch {
    return {};
  }
};

// Alertes de but pour les matchs favoris et les matchs des équipes suivies (matchs réels uniquement : identifiant « apif-… »)
export function usePush(favoriteMatchIds: string[], knownMatches: Match[], followedTeamIds: string[] = []) {
  const supported = pushSupported();
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const permission = supported ? Notification.permission : 'denied';
  const favRef = useRef<PushFavorite[]>([]);
  const teamKey = followedTeamIds.join(',');

  // Coup d'envoi des matchs à surveiller : mémorisé dès que le match a été affiché, pour pouvoir le surveiller plus tard
  useEffect(() => {
    const ko = readKo();
    const wanted = new Set(favoriteMatchIds.filter((id) => id.startsWith('apif-')));
    let changed = false;
    for (const m of knownMatches) {
      if (!m.id.startsWith('apif-')) continue;
      const byTeam = m.status !== 'FINISHED' && (followedTeamIds.includes(m.homeTeam.id) || followedTeamIds.includes(m.awayTeam.id));
      if (byTeam) wanted.add(m.id);
      if (!wanted.has(m.id)) continue;
      const iso = koOf(m);
      if (iso && ko[m.id] !== iso) {
        ko[m.id] = iso;
        changed = true;
      }
    }
    // Prochains matchs des équipes suivies, mémorisés depuis la page de l'équipe
    for (const u of readUpcoming()) {
      if (followedTeamIds.includes(u.team)) {
        wanted.add(u.id);
        if (!ko[u.id]) {
          ko[u.id] = u.ko;
          changed = true;
        }
      }
    }
    for (const id of Object.keys(ko)) {
      const old = Date.now() - new Date(ko[id]).getTime() > 4 * 3600e3;
      if (!wanted.has(id) || old) {
        delete ko[id];
        changed = true;
      }
    }
    if (changed) {
      try {
        localStorage.setItem(KO_KEY, JSON.stringify(ko));
      } catch {
        /* ignoré */
      }
    }
    favRef.current = [...wanted]
      .filter((id) => /^apif-\d+$/.test(id) && ko[id])
      .map((id) => ({ id: parseInt(id.slice(5), 10), ko: ko[id] }))
      .sort((x, y) => x.ko.localeCompare(y.ko))
      .slice(0, 40);
  }, [favoriteMatchIds, knownMatches, teamKey]);

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    currentSubscription().then((s) => alive && setSubscribed(Boolean(s) && Notification.permission === 'granted'));
    return () => {
      alive = false;
    };
  }, [supported]);

  // Le serveur doit connaître les favoris à jour
  const favKey = favoriteMatchIds.join(',') + '|' + knownMatches.length + '|' + teamKey;
  useEffect(() => {
    if (!subscribed) return;
    const t = setTimeout(() => syncFavorites(favRef.current), 1500);
    return () => clearTimeout(t);
  }, [subscribed, favKey]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    const r = await enablePush(favRef.current);
    setSubscribed(r.ok);
    if (!r.ok) setError(r.error ?? 'Erreur');
    setBusy(false);
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    await disablePush();
    setSubscribed(false);
    setBusy(false);
  }, []);

  return { supported, permission, subscribed, busy, error, enable, disable };
}
