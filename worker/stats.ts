// Statistiques de visites sans cookie : on compte les pages vues et les visiteurs du jour (empreinte anonyme qui change chaque jour).
export interface DayStats {
  v: number; // pages vues
  u: string[]; // visiteurs du jour (empreintes anonymes)
  pages: Record<string, number>;
  countries: Record<string, number>;
  devices: Record<string, number>;
  refs: Record<string, number>;
  hours: number[]; // pages vues par heure UTC
}

export const emptyDay = (): DayStats => ({ v: 0, u: [], pages: {}, countries: {}, devices: {}, refs: {}, hours: Array(24).fill(0) });

const MAX_UNIQUE = 8000;
const MAX_KEYS = 250;

export const isBot = (ua: string): boolean => !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch/i.test(ua);

export const deviceOf = (ua: string): 'mobile' | 'tablet' | 'ordinateur' => (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)) ? 'tablet' : /mobi|iphone|ipod|android/i.test(ua) ? 'mobile' : 'ordinateur');

// Adresse regroupée : les milliers de matchs et d'équipes ne polluent pas le classement des pages
export function pageKey(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  let p = raw.split('?')[0].split('#')[0].slice(0, 160);
  if (!p.startsWith('/') || p.startsWith('/admin') || p.startsWith('/api')) return null;
  p = p.replace(/\/+$/, '') || '/';
  const seg = p.split('/').filter(Boolean);
  if (seg[0] === 'match') return '/match/*';
  if (seg[0] === 'equipe') return '/equipe/*';
  if (seg[0] === 'actualites' && seg[1]) return `/actualites/${seg[1]}`;
  if (seg[0] === 'championnat' && seg[1]) return `/championnat/${seg[1]}`;
  return seg.length > 2 ? '/' + seg.slice(0, 2).join('/') : p;
}

export function refHost(ref: unknown, ownHost: string): string {
  if (typeof ref !== 'string' || !ref) return '(direct)';
  try {
    const h = new URL(ref).hostname.replace(/^(www|m|l)\./, '');
    return h === ownHost.replace(/^www\./, '') || !h ? '(direct)' : h.slice(0, 60);
  } catch {
    return '(direct)';
  }
}

const bump = (o: Record<string, number>, k: string, n = 1) => {
  if (k in o) o[k] += n;
  else if (Object.keys(o).length < MAX_KEYS) o[k] = n;
  else o['(autres)'] = (o['(autres)'] ?? 0) + n;
};

export function addHit(day: DayStats, hit: { page: string; country: string; device: string; ref: string; hour: number; visitor: string }): void {
  day.v++;
  bump(day.pages, hit.page);
  bump(day.countries, hit.country);
  bump(day.devices, hit.device);
  bump(day.refs, hit.ref);
  day.hours[hit.hour] = (day.hours[hit.hour] ?? 0) + 1;
  if (!day.u.includes(hit.visitor) && day.u.length < MAX_UNIQUE) day.u.push(hit.visitor);
}

export function mergeDay(base: DayStats, extra: DayStats): DayStats {
  base.v += extra.v;
  for (const [k, n] of Object.entries(extra.pages)) bump(base.pages, k, n);
  for (const [k, n] of Object.entries(extra.countries)) bump(base.countries, k, n);
  for (const [k, n] of Object.entries(extra.devices)) bump(base.devices, k, n);
  for (const [k, n] of Object.entries(extra.refs)) bump(base.refs, k, n);
  for (let i = 0; i < 24; i++) base.hours[i] = (base.hours[i] ?? 0) + (extra.hours[i] ?? 0);
  const seen = new Set(base.u);
  for (const id of extra.u) if (!seen.has(id) && base.u.length < MAX_UNIQUE) base.u.push(id);
  return base;
}

const top = (o: Record<string, number>, n: number) =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, views]) => ({ key, views }));

export function summarize(days: { date: string; stats: DayStats | null }[], todayHours: number[]) {
  const series = days.map((d) => ({ date: d.date, views: d.stats?.v ?? 0, visitors: d.stats?.u.length ?? 0 }));
  const agg = emptyDay();
  for (const d of days) if (d.stats) mergeDay(agg, d.stats);
  const last = (n: number) => series.slice(-n);
  const sum = (a: { views: number; visitors: number }[], k: 'views' | 'visitors') => a.reduce((t, x) => t + x[k], 0);
  return {
    series,
    today: series[series.length - 1] ?? { date: '', views: 0, visitors: 0 },
    last7: { views: sum(last(7), 'views'), visitors: sum(last(7), 'visitors') },
    period: { views: sum(series, 'views'), visitors: sum(series, 'visitors') },
    pages: top(agg.pages, 15),
    countries: top(agg.countries, 10),
    devices: top(agg.devices, 5),
    refs: top(agg.refs, 10),
    hours: todayHours,
  };
}
