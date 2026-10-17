import { useEffect, useState } from 'react';
import { Match } from '../types';
import { fetchFixturesByDate } from '../services/apiFootball';
import { toLocalISODate } from '../utils/date';

// Charge les matchs du jour choisi (uniquement si l'API réelle est configurée)
export function useDayFixtures(date: string, enabled: boolean) {
  const [dayMatches, setDayMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setDayMatches([]);
    setError(null);

    async function load() {
      setLoading(true);
      const result = await fetchFixturesByDate(date);
      if (!alive) return;
      if (result.ok) {
        setDayMatches(result.matches);
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
