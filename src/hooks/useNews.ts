import { useEffect, useState } from 'react';
import { NewsArticle } from '../types';
import { fetchNews, readCachedNews } from '../services/news';

// Vraies actualités (flux RSS). Affichage immédiat des dernières connues, puis mise à jour toutes les 10 min.
export function useNews() {
  const [news, setNews] = useState<NewsArticle[]>(() => readCachedNews());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const items = await fetchNews();
      if (!alive) return;
      if (items) setNews(items);
      setLoaded(true);
    }
    load();
    const timer = setInterval(load, 600000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return { news, loaded };
}
