import { useCallback, useEffect, useRef, useState } from 'react';
import { Match } from '../types';
import { PushFavorite, currentSubscription, disablePush, enablePush, pushSupported, syncFavorites } from '../services/push';

const KO_KEY = 'fs_fav_ko';

const readKo = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(KO_KEY) || '{}');
  } catch {
    return {};
  }
};

// Alertes de but pour les matchs favoris (matchs réels uniquement : identifiant « apif-… »)
export function usePush(favoriteMatchIds: string[], knownMatches: Match[]) {
  const supported = pushSupported();
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const permission = supported ? Notification.permission : 'denied';
  const favRef = useRef<PushFavorite[]>([]);

  // Coup d'envoi des favoris : mémorisé dès que le match a été affiché, pour pouvoir le surveiller plus tard
  useEffect(() => {
    const ko = readKo();
    let changed = false;
    for (const m of knownMatches) {
      if (!m.id.startsWith('apif-') || !favoriteMatchIds.includes(m.id)) continue;
      const t = new Date(`${m.date}T${m.startTime}:00`);
      if (Number.isNaN(t.getTime())) continue;
      const iso = t.toISOString();
      if (ko[m.id] !== iso) {
        ko[m.id] = iso;
        changed = true;
      }
    }
    for (const id of Object.keys(ko)) {
      if (!favoriteMatchIds.includes(id)) {
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
    favRef.current = favoriteMatchIds
      .filter((id) => /^apif-\d+$/.test(id) && ko[id])
      .map((id) => ({ id: parseInt(id.slice(5), 10), ko: ko[id] }));
  }, [favoriteMatchIds, knownMatches]);

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    currentSubscription().then((s) => alive && setSubscribed(Boolean(s) && Notification.permission === 'granted'));
    return () => {
      alive = false;
    };
  }, [supported]);

  // Le serveur doit connaître les favoris à jour
  const favKey = favoriteMatchIds.join(',') + '|' + knownMatches.length;
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
