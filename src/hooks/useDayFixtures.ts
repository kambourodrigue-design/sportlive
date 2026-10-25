import { useEffect, useState } from 'react';
import { Match, SportId } from '../types';
import { fetchFixturesByDate } from '../services/apiFootball';
import { fetchGamesByDate, API_SPORTS } from '../services/apiSports';
import { toLocalISODate } from '../utils/date';

// Charge les matchs du jour choisi (uniquement si l'API réelle est configurée)
const CACHE_KEY = 'fsn_day_cache_v2';

function readDayCache(date: string, sport: SportId): Match[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { sport: SportId; date: string; ts: number; matches: Match[] };
    return c.sport === sport && c.date === date && Date.now() - c.ts < 6 * 3600e3 ? c.matches : null;
  } catch {
    return null;
  }
}

function writeDayCache(date: string, sport: SportId, matches: Match[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ sport, date, ts: Date.now(), matches }));
  } catch {
    /* quota dépassé : on ignore */
  }
}

export function useDayFixtures(date: string, enabled: boolean, sport: SportId = 'football') {
  const [dayMatches, setDayMatches] = useState<Match[]>(() => (enabled ? readDayCache(date, sport) ?? [] : []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setDayMatches(readDayCache(date, sport) ?? []); // affichage immédiat des dernières données connues, puis rafraîchissement
    setError(null);

    async function load() {
      if (sport !== 'football' && !API_SPORTS.includes(sport)) {
        setDayMatches([]);
        setError("Ce sport n'est pas inclus dans API-Sports (football, basket, rugby, hockey et handball le sont).");
        setLoading(false);
        return;
      }
      setLoading(true);
      const result = sport === 'football' ? await fetchFixturesByDate(date) : await fetchGamesByDate(sport, date);
      if (!alive) return;
      if (result.ok) {
        setDayMatches(result.matches);
        writeDayCache(date, sport, result.matches);
        setError(null);
      } else {
        setError(result.apiError || 'Impossible de charger les matchs de ce jour.');
      }
      setLoading(false);
    }

    load();
    // Aujourd'hui : résultats rafraîchis toutes les 2 minutes (tous les sports)
    const every = 120000;
    const timer = date === toLocalISODate(new Date()) ? setInterval(load, every) : undefined;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [date, enabled, sport]);

  return { dayMatches, loading, error };
}
