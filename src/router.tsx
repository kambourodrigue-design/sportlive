import React, { useSyncExternalStore } from 'react';

// Petit routeur maison (History API) : pas de dépendance, vraies adresses partageables.
const EVENT = 'sa:navigate';

function subscribe(cb: () => void) {
  window.addEventListener('popstate', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname, () => '/');
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === window.location.pathname + window.location.search) return;
  if (opts.replace) window.history.replaceState({}, '', to);
  else window.history.pushState({}, '', to);
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo({ top: 0 });
}

export function goBack(fallback = '/') {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}

interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
}

export const Link: React.FC<LinkProps> = ({ to, onClick, children, ...rest }) => (
  <a
    href={to}
    {...rest}
    onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(to);
    }}
  >
    {children}
  </a>
);

export type Route =
  | { name: 'home' }
  | { name: 'league'; id: string }
  | { name: 'team'; id: string }
  | { name: 'match'; id: string }
  | { name: 'article'; id: string }
  | { name: 'page'; slug: string }
  | { name: 'notfound' };

export const STATIC_SLUGS = ['a-propos', 'contact', 'confidentialite', 'conditions', 'cookies', 'jeu-responsable'] as const;

export function matchRoute(path: string): Route {
  const clean = path.replace(/\/+$/, '') || '/';
  if (clean === '/') return { name: 'home' };
  const seg = clean.split('/').filter(Boolean).map(decodeURIComponent);
  if (seg[0] === 'championnat' && seg[1]) return { name: 'league', id: seg[1] };
  if (seg[0] === 'equipe' && seg[1]) return { name: 'team', id: seg[1] };
  if (seg[0] === 'match' && seg[1]) return { name: 'match', id: seg[1] };
  if (seg[0] === 'actualites' && seg[1]) return { name: 'article', id: seg[1] };
  if (seg.length === 1 && (STATIC_SLUGS as readonly string[]).includes(seg[0])) return { name: 'page', slug: seg[0] };
  return { name: 'notfound' };
}

export const leagueUrl = (id: string | number) => `/championnat/${encodeURIComponent(String(id))}`;
export const teamUrl = (id: string | number) => `/equipe/${encodeURIComponent(String(id))}`;
export const matchUrl = (id: string) => `/match/${encodeURIComponent(id)}`;

export const slugify = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'article';

// Les articles de la rédaction (id « own-… ») ont une adresse avec le titre, utile pour Google ; les autres gardent l'identifiant seul
export const articleUrl = (a: { id: string; title: string }) => `/actualites/${encodeURIComponent(a.id)}${a.id.startsWith('own-') ? `/${slugify(a.title)}` : ''}`;
