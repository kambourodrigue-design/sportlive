import { NewsArticle } from '../types';
import { timeAgo } from './news';

// ---------- Articles publiés (affichés dans l'onglet Actualités) ----------
export interface OwnArticle {
  id: string;
  title: string;
  summary: string;
  content: string[];
  category: string;
  imageUrl?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

const OWN_CACHE_KEY = 'fsn_own_articles_v1';

function toNewsArticle(a: OwnArticle): NewsArticle {
  return {
    id: `own-${a.id}`,
    title: a.title,
    summary: a.summary,
    category: a.category,
    timeAgo: timeAgo(a.publishedAt ?? a.createdAt),
    imageUrl: a.imageUrl ?? '',
    author: 'La rédaction',
    views: 0,
    content: a.content,
    publishedAt: a.publishedAt ?? a.createdAt,
  };
}

export function readCachedOwnArticles(): NewsArticle[] {
  try {
    const raw = localStorage.getItem(OWN_CACHE_KEY);
    return raw ? (JSON.parse(raw) as OwnArticle[]).map(toNewsArticle) : [];
  } catch {
    return [];
  }
}

export async function fetchOwnArticles(): Promise<NewsArticle[] | null> {
  try {
    const res = await fetch('/api/articles');
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success || !Array.isArray(json.items)) return null;
    try {
      localStorage.setItem(OWN_CACHE_KEY, JSON.stringify(json.items));
    } catch {
      /* ignoré */
    }
    return (json.items as OwnArticle[]).map(toNewsArticle);
  } catch {
    return null;
  }
}

// ---------- Administration (page /admin) ----------
const TOKEN_KEY = 'fsn_admin_token';

export const getAdminToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setAdminToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearAdminToken = () => localStorage.removeItem(TOKEN_KEY);

export interface AdminResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  error?: string;
  data: T;
}

export async function adminRequest<T = Record<string, unknown>>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
): Promise<AdminResult<T>> {
  try {
    const token = getAdminToken();
    const res = await fetch(path, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; success?: boolean };
    if (res.status === 401 && path !== '/api/admin/login') clearAdminToken();
    return { ok: res.ok && data.success !== false, status: res.status, error: data.error, data };
  } catch {
    return { ok: false, status: 0, error: 'Réseau indisponible.', data: {} as T };
  }
}
