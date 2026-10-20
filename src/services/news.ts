import { NewsArticle } from '../types';

const CACHE_KEY = 'fsn_news_cache_v1';

export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Hier' : `Il y a ${days} j`;
}

interface ApiNewsItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  link: string;
  publishedAt: string;
  source: string;
}

function toArticle(item: ApiNewsItem): NewsArticle {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    category: item.category,
    timeAgo: timeAgo(item.publishedAt),
    imageUrl: '', // on n'affiche pas les photos de la source (droits)
    author: item.source,
    views: 0,
    content: item.summary ? [item.summary] : [],
    sourceUrl: item.link,
    sourceName: item.source,
    publishedAt: item.publishedAt,
  };
}

export function readCachedNews(): NewsArticle[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const c = JSON.parse(raw) as { ts: number; items: ApiNewsItem[] };
    return Date.now() - c.ts < 6 * 3600e3 ? c.items.map(toArticle) : [];
  } catch {
    return [];
  }
}

export async function fetchNews(): Promise<NewsArticle[] | null> {
  try {
    const res = await fetch('/api/news');
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success || !Array.isArray(json.items)) return null;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: json.items }));
    } catch {
      /* ignoré */
    }
    return (json.items as ApiNewsItem[]).map(toArticle);
  } catch {
    return null;
  }
}
