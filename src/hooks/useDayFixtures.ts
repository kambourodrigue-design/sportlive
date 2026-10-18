import { useEffect, useState } from 'react';
import { Match } from '../types';
import { fetchFixturesByDate } from '../services/apiFootball';
import { toLocalISODate } from '../utils/date';

// Charge les matchs du jour choisi (uniquement si l'API réelle est configurée)
const CACHE_KEY = 'fsn_day_cache_v1';

function readDayCache(date: string): Match[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { date: string; ts: number; matches: Match[] };
    return c.date === date && Date.now() - c.ts < 6 * 3600e3 ? c.matches : null;
  } catch {
    return null;
  }
}

function writeDayCache(date: string, matches: Match[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ date, ts: Date.now(), matches }));
  } catch {
    /* quota dépassé : on ignore */
  }
}

export function useDayFixtures(date: string, enabled: boolean) {
  const [dayMatches, setDayMatches] = useState<Match[]>(() => (enabled ? readDayCache(date) ?? [] : []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setDayMatches(readDayCache(date) ?? []); // affichage immédiat des dernières données connues, puis rafraîchissement
    setError(null);

    async function load() {
      setLoading(true);
      const result = await fetchFixturesByDate(date);
      if (!alive) return;
      if (result.ok) {
        setDayMatches(result.matches);
        writeDayCache(date, result.matches);
        setError(null);
      } else {
        setError(result.apiError || 'Impossible de charger les matchs de ce jour.');
      }
      setLoading(false);
    }

    load();
    // Aujourd'hui : rafraîchissement toutes les 5 min (le direct est déjà suivi à part, chaque minute)
    const timer = date === toLocalISODate(new Date()) ? setInterval(load, 300000) : undefined;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [date, enabled]);

  return { dayMatches, loading, error };
}
