import { useEffect, useState } from 'react';
import { NewsArticle } from '../types';
import { fetchNews, readCachedNews } from '../services/news';
import { fetchOwnArticles, readCachedOwnArticles } from '../services/articles';

// Actualités = articles de la rédaction (en premier, lisibles dans l'app) + flux RSS (titre, extrait, lien).
// Affichage immédiat des dernières données connues, puis mise à jour toutes les 10 min.
export function useNews() {
  const [rss, setRss] = useState<NewsArticle[]>(() => readCachedNews());
  const [own, setOwn] = useState<NewsArticle[]>(() => readCachedOwnArticles());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [feed, house] = await Promise.all([fetchNews(), fetchOwnArticles()]);
      if (!alive) return;
      if (feed) setRss(feed);
      if (house) setOwn(house);
      setLoaded(true);
    }
    load();
    const timer = setInterval(load, 600000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return { news: [...own, ...rss], loaded };
}
