import { useEffect, useState } from 'react';
import { fetchMatchDetail, MatchDetail } from '../services/matchDetail';

// Vraies statistiques / compositions / événements d'un match (football). Rafraîchi si le match est en direct.
export function useMatchDetail(matchId: string | null, refreshMs: number | null) {
  const [data, setData] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(null);
    if (!matchId) return;
    let alive = true;
    async function load() {
      setLoading(true);
      const d = await fetchMatchDetail(matchId as string);
      if (!alive) return;
      if (d) setData(d);
      setLoading(false);
    }
    load();
    const timer = refreshMs ? setInterval(load, refreshMs) : undefined;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [matchId, refreshMs]);

  return { data, loading };
}
