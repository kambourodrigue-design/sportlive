// Worker Cloudflare : sert l'API (/api/*). Les fichiers du site (dist/) sont servis par Cloudflare Assets.
import { isAfricanLeague } from '../src/utils/africa';

type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

interface Env {
  API_FOOTBALL_KEY?: string;
  RAPIDAPI_KEY?: string;
  LIVE_CACHE_SECONDS?: string;
  ANTHROPIC_API_KEY?: string;
  AI_MODEL?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  AI_PRIMARY?: string; // 'deepseek' (défaut) ou 'claude' : modèle essayé en premier
  PICKS_CACHE_SECONDS?: string;
  NEWS_CACHE_SECONDS?: string;
  ADMIN_PASSWORD?: string; // mot de passe de la page /admin (rédaction maison)
  CACHE?: KV;
}

const BASE_URL = 'https://v3.football.api-sports.io';
const RAPID_URL = 'https://api-football-v1.p.rapidapi.com/v3';

const LEAGUE_ID_MAP: Record<string, number> = {
  ucl: 2,
  'ligue-europa': 3,
  'ligue-conference': 848,
  euro: 4,
  'nations-league': 5,
  ligue1: 61,
  ligue2: 62,
  'premier-league': 39,
  laliga: 140,
  'super-coupe-es': 556,
  bundesliga: 78,
  'serie-a': 135,
  'uae-cup': 304,
  'jo-femmes': 480,
};

function currentSeason(): string {
  const now = new Date();
  return String(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);
}

// Cache de secours en mémoire (utilisé seulement si le KV n'est pas disponible)
const memCache = new Map<string, { data: unknown; ts: number }>();

async function cacheGet(env: Env, key: string, ttlSec: number): Promise<unknown | null> {
  if (env.CACHE) {
    try {
      const raw = await env.CACHE.get(key);
      if (raw) return JSON.parse(raw);
    } catch {
      /* on ignore et on retombe sur la mémoire */
    }
  }
  const m = memCache.get(key);
  if (m && Date.now() - m.ts < ttlSec * 1000) return m.data;
  return null;
}

async function cacheSet(env: Env, key: string, data: unknown, ttlSec: number): Promise<void> {
  memCache.set(key, { data, ts: Date.now() });
  if (env.CACHE) {
    try {
      // KV impose un minimum de 60 secondes
      await env.CACHE.put(key, JSON.stringify(data), { expirationTtl: Math.max(60, ttlSec) });
    } catch {
      /* non bloquant */
    }
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function isConfigured(env: Env): boolean {
  return Boolean(env.API_FOOTBALL_KEY || env.RAPIDAPI_KEY);
}

// Dernier quota connu d'API-Football (lu dans les en-têtes de réponse)
let lastQuota: { remaining: number; limit: number } | null = null;

async function callApiRaw(env: Env, path: string, baseOverride?: string): Promise<{ response: any[]; errors: string | null }> {
  const rapid = Boolean(env.RAPIDAPI_KEY) && !baseOverride;
  const headers: Record<string, string> = rapid
    ? { 'x-rapidapi-key': env.RAPIDAPI_KEY!, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
    : { 'x-apisports-key': env.API_FOOTBALL_KEY! };
  const res = await fetch(`${baseOverride ?? (rapid ? RAPID_URL : BASE_URL)}${path}`, {
    headers: baseOverride ? { 'x-apisports-key': env.API_FOOTBALL_KEY! } : headers,
  });
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`);
  const remaining = parseInt(res.headers.get('x-ratelimit-requests-remaining') || '', 10);
  const limit = parseInt(res.headers.get('x-ratelimit-requests-limit') || '', 10);
  if (!baseOverride && Number.isFinite(remaining) && Number.isFinite(limit)) lastQuota = { remaining, limit };
  const body = (await res.json()) as { errors?: unknown; response?: any[] };
  const errs = body.errors;
  let msg: string | null = null;
  if (Array.isArray(errs) && errs.length) msg = errs.map(String).join(' ');
  else if (errs && typeof errs === 'object' && Object.keys(errs).length) msg = Object.values(errs).map(String).join(' ');
  return { response: body.response || [], errors: msg };
}

async function callApi(env: Env, path: string): Promise<any[]> {
  return (await callApiRaw(env, path)).response;
}

// Ne garde que les champs utilisés par l'app : réponse ~5x plus légère (le direct mondial pèse très lourd)
function compactFixture(f: any) {
  const team = (t: any) => ({ id: t?.id, name: t?.name, logo: t?.logo ? '1' : '' });
  return {
    fixture: {
      id: f.fixture?.id,
      date: f.fixture?.date,
      referee: f.fixture?.referee,
      venue: { name: f.fixture?.venue?.name },
      status: { short: f.fixture?.status?.short, elapsed: f.fixture?.status?.elapsed },
    },
    league: { id: f.league?.id, name: f.league?.name, country: f.league?.country, flag: f.league?.flag ? '1' : '', round: f.league?.round },
    teams: { home: team(f.teams?.home), away: team(f.teams?.away) },
    goals: { home: f.goals?.home, away: f.goals?.away },
    events: compactEvents(f.events),
  };
}

function compactEvents(events: any[] | undefined) {
  return (events || []).map((e: any) => ({
    type: e.type,
    detail: e.detail,
    time: { elapsed: e.time?.elapsed, extra: e.time?.extra },
    team: { id: e.team?.id },
    player: { name: e.player?.name },
    assist: { name: e.assist?.name },
  }));
}

// Détail d'un match (1 seul appel API) : événements, statistiques par équipe, compositions
function compactDetail(f: any) {
  const stats = (t: any) => {
    const o: Record<string, string | number | null> = {};
    for (const s of t?.statistics || []) o[s.type] = s.value;
    return o;
  };
  const player = (p: any) => ({ id: p.player?.id, name: p.player?.name, number: p.player?.number, pos: p.player?.pos });
  return {
    homeId: f.teams?.home?.id,
    awayId: f.teams?.away?.id,
    status: f.fixture?.status?.short,
    events: compactEvents(f.events),
    statistics: (f.statistics || []).map((t: any) => ({ teamId: t.team?.id, stats: stats(t) })),
    lineups: (f.lineups || []).map((l: any) => ({
      teamId: l.team?.id,
      formation: l.formation,
      coach: l.coach?.name,
      startXI: (l.startXI || []).map(player),
      subs: (l.substitutes || []).map(player),
    })),
  };
}

// Autres sports : même compte et même clé API-Sports, une API (et un quota) par sport
const SPORT_HOSTS: Record<string, string> = {
  basketball: 'https://v1.basketball.api-sports.io',
};

function compactGame(g: any) {
  // Basket : scores.home = { total, quarter_1... } ; autres sports : scores.home = nombre
  const score = (s: any): number | null => (typeof s === 'number' ? s : typeof s?.total === 'number' ? s.total : null);
  return {
    id: g.id,
    date: g.date,
    status: g.status?.short,
    league: { id: g.league?.id, name: g.league?.name },
    country: g.country?.name,
    home: { id: g.teams?.home?.id, name: g.teams?.home?.name },
    away: { id: g.teams?.away?.id, name: g.teams?.away?.name },
    homeScore: score(g.scores?.home),
    awayScore: score(g.scores?.away),
  };
}

function safeTimeZone(tz: string | null): string {
  if (!tz || tz.length > 64) return 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

async function cachedApi(
  env: Env,
  key: string,
  path: string,
  ttlSec: number,
  transform?: (f: any) => unknown,
): Promise<{ data: unknown; cached: boolean; apiError?: string }> {
  const hit = await cacheGet(env, key, ttlSec);
  if (hit) return { data: hit, cached: true };
  const { response, errors } = await callApiRaw(env, path);
  if (errors && response.length === 0) return { data: [], cached: false, apiError: errors }; // pas de mise en cache d'une erreur
  const data = transform ? response.map(transform) : response;
  await cacheSet(env, key, data, ttlSec);
  return { data, cached: false };
}


// ---------------------------------------------------------------------------
// Actualités : flux RSS gratuits de Maxifoot (titre + court extrait + lien vers l'article d'origine)
// ---------------------------------------------------------------------------
const NEWS_FEEDS = [
  { url: 'http://rss.maxifoot.com/football-general.xml', category: 'FOOTBALL' },
  { url: 'http://rss.maxifoot.com/football-transfert.xml', category: 'MERCATO' },
  { url: 'http://rss.maxifoot.com/football-ligue-champion.xml', category: 'EUROPE' },
  { url: 'http://rss.maxifoot.com/football-equipe-france.xml', category: 'ÉQUIPE DE FRANCE' },
];
const MAX_NEWS = 40;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', laquo: '«', raquo: '»',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', euro: '€', ndash: '–', mdash: '—',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', auml: 'ä', ccedil: 'ç',
  icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Agrave: 'À', Ccedil: 'Ç', Ocirc: 'Ô',
};

function decodeEntities(input: string): string {
  const once = (s: string) =>
    s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code: string) => {
      if (code[0] === '#') {
        const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return NAMED_ENTITIES[code] ?? m;
    });
  return once(once(input)); // le flux contient parfois des entités encodées deux fois (&amp;eacute;)
}

function xmlTag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim() : '';
}

function cleanSnippet(raw: string): string {
  let t = decodeEntities(raw).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/&[a-zA-Z#0-9]*\.{2,}$/, '…').replace(/\.{3,}$/, '…'); // fin tronquée par le flux
  return t.length > 240 ? `${t.slice(0, 237).trimEnd()}…` : t;
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  link: string;
  publishedAt: string;
  source: string;
}

function parseRss(xml: string, category: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = decodeEntities(xmlTag(block, 'title')).replace(/<[^>]*>/g, '').trim();
    const link = xmlTag(block, 'link');
    let host = '';
    try {
      const u = new URL(link);
      host = u.protocol === 'https:' || u.protocol === 'http:' ? u.hostname : '';
    } catch {
      /* lien invalide */
    }
    if (!title || !host.endsWith('maxifoot.fr')) continue; // on n'accepte que des liens vers le site source
    const date = new Date(xmlTag(block, 'pubDate'));
    items.push({
      id: link,
      title,
      summary: cleanSnippet(xmlTag(block, 'description')),
      category,
      link,
      publishedAt: Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString(),
      source: 'Maxifoot',
    });
  }
  return items;
}

async function loadNews(): Promise<NewsItem[]> {
  const settled = await Promise.allSettled(
    NEWS_FEEDS.map(async (f) => {
      const res = await fetch(f.url, { headers: { 'user-agent': 'ScoreAfrica/1.0 (+rss reader)' } });
      if (!res.ok) throw new Error(`RSS ${res.status}`);
      return parseRss(await res.text(), f.category);
    }),
  );
  const seen = new Set<string>();
  return settled
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .filter((n) => (seen.has(n.link) ? false : (seen.add(n.link), true))) // un article présent dans 2 flux n'apparaît qu'une fois
    .slice(0, MAX_NEWS);
}

// ---------------------------------------------------------------------------
// Historique des pronostics + taux de réussite (stocké dans le KV)
// ---------------------------------------------------------------------------
const BETS = ['HOME_WIN', 'AWAY_WIN', 'DRAW', 'HOME_OR_DRAW', 'AWAY_OR_DRAW', 'OVER_1_5', 'OVER_2_5', 'UNDER_2_5', 'UNDER_3_5', 'BTTS_YES'] as const;
type Bet = (typeof BETS)[number];

interface HistoryEntry {
  fixtureId: number;
  kickoff: string;
  league: string;
  home: string;
  away: string;
  bet: Bet;
  model?: string;
  market: string;
  confidence: number;
  result: 'pending' | 'won' | 'lost' | 'void';
  score?: string;
}
interface History {
  entries: HistoryEntry[];
  lastSettle: number;
}

const HISTORY_KEY = 'picks_history_v1';
const MAX_HISTORY = 200;
let memHistory: History = { entries: [], lastSettle: 0 };

async function loadHistory(env: Env): Promise<History> {
  if (env.CACHE) {
    try {
      const raw = await env.CACHE.get(HISTORY_KEY);
      if (raw) return JSON.parse(raw) as History;
    } catch {
      /* repli sur la mémoire */
    }
  }
  return memHistory;
}

async function saveHistory(env: Env, h: History): Promise<void> {
  memHistory = h;
  if (env.CACHE) {
    try {
      await env.CACHE.put(HISTORY_KEY, JSON.stringify(h)); // sans expiration
    } catch {
      /* non bloquant */
    }
  }
}

async function recordHistory(env: Env, picks: any[]): Promise<void> {
  const h = await loadHistory(env);
  for (const p of picks) {
    if (h.entries.some((e) => e.fixtureId === p.fixtureId)) continue;
    h.entries.push({
      fixtureId: p.fixtureId,
      kickoff: p.kickoff,
      league: p.league,
      home: p.home,
      away: p.away,
      bet: p.bet,
      model: p.model,
      market: p.market,
      confidence: p.confidence,
      result: 'pending',
    });
  }
  h.entries.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
  h.entries = h.entries.slice(0, MAX_HISTORY);
  await saveHistory(env, h);
}

function evaluateBet(bet: Bet, home: number, away: number): boolean {
  switch (bet) {
    case 'HOME_WIN': return home > away;
    case 'AWAY_WIN': return away > home;
    case 'DRAW': return home === away;
    case 'HOME_OR_DRAW': return home >= away;
    case 'AWAY_OR_DRAW': return away >= home;
    case 'OVER_1_5': return home + away >= 2;
    case 'OVER_2_5': return home + away >= 3;
    case 'UNDER_2_5': return home + away <= 2;
    case 'UNDER_3_5': return home + away <= 3;
    case 'BTTS_YES': return home > 0 && away > 0;
  }
}

// Vérifie les résultats des matchs terminés : 1 seul appel API (ids groupés), au plus toutes les 10 min
async function settleHistory(env: Env, h: History): Promise<History> {
  const now = Date.now();
  const due = h.entries.filter((e) => e.result === 'pending' && new Date(e.kickoff).getTime() + 2.5 * 3600e3 < now);
  if (due.length > 0 && now - h.lastSettle >= 5 * 60e3) {
    h.lastSettle = now;
    try {
      const ids = due.slice(0, 20).map((e) => e.fixtureId).join('-');
      const list = await callApi(env, `/fixtures?ids=${ids}`);
      for (const f of list) {
        const e = h.entries.find((x) => x.fixtureId === f.fixture?.id);
        if (!e) continue;
        const st = f.fixture?.status?.short;
        if (['FT', 'AET', 'PEN'].includes(st)) {
          const hg = f.score?.fulltime?.home ?? f.goals?.home; // score à 90 minutes
          const ag = f.score?.fulltime?.away ?? f.goals?.away;
          if (typeof hg === 'number' && typeof ag === 'number') {
            e.score = `${hg}-${ag}`;
            e.result = evaluateBet(e.bet, hg, ag) ? 'won' : 'lost';
          }
        } else if (['PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(st)) {
          e.result = 'void';
        }
      }
    } catch {
      /* on réessaiera */
    }
  }
  for (const e of h.entries) {
    if (e.result === 'pending' && new Date(e.kickoff).getTime() + 5 * 86400e3 < now) e.result = 'void';
  }
  await saveHistory(env, h);
  return h;
}

// ---------------------------------------------------------------------------
// Pronostics IA : on ne garde que les 2-3 matchs où la confiance est la plus forte
// ---------------------------------------------------------------------------
// Compétitions suivies : C1, C3, C4, Euro, Ligue des nations, CAN, CAF C1, qualifs Afrique, L1, PL, Bundesliga, Serie A, Liga
const PICK_LEAGUE_IDS = new Set([2, 3, 848, 4, 5, 6, 12, 29, 39, 61, 78, 135, 140]);
const MAX_CANDIDATES = 8; // = 8 appels « predictions » au maximum par rafraîchissement
const MAX_PICKS = 3;

interface Candidate {
  fixtureId: number;
  league: string;
  kickoff: string;
  home: string;
  away: string;
  percent: { home: number; draw: number; away: number };
  advice: string;
  comparison: { form?: unknown; att?: unknown; def?: unknown; total?: unknown };
  last5: { home?: string; away?: string };
}

interface AiPick {
  fixtureId: number;
  bet: string;
  market: string;
  confidence: number;
  reasoning: string;
}

const pct = (v: unknown): number => parseInt(String(v ?? '0').replace('%', ''), 10) || 0;
const isoDay = (d: Date): string => d.toISOString().substring(0, 10);

async function loadCandidates(env: Env): Promise<Candidate[]> {
  const now = new Date();
  const days = [isoDay(now), isoDay(new Date(now.getTime() + 86400000))];
  let fixtures: any[] = [];
  for (const day of days) {
    const list = await callApi(env, `/fixtures?date=${day}`);
    fixtures = fixtures.concat(
      list.filter(
        (f) =>
          PICK_LEAGUE_IDS.has(f.league?.id) &&
          f.fixture?.status?.short === 'NS' &&
          new Date(f.fixture.date).getTime() > now.getTime(),
      ),
    );
    if (fixtures.length >= MAX_PICKS) break; // pas besoin d'un 2e appel
  }
  fixtures = fixtures.filter((f, i, arr) => arr.findIndex((x) => x.fixture.id === f.fixture.id) === i); // pas de doublons
  fixtures.sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
  fixtures = fixtures.slice(0, MAX_CANDIDATES);

  const settled = await Promise.allSettled(
    fixtures.map(async (f): Promise<Candidate> => {
      const [p] = await callApi(env, `/predictions?fixture=${f.fixture.id}`);
      return {
        fixtureId: f.fixture.id,
        league: f.league?.name || 'Compétition',
        kickoff: f.fixture.date,
        home: f.teams?.home?.name || 'Équipe 1',
        away: f.teams?.away?.name || 'Équipe 2',
        percent: {
          home: pct(p?.predictions?.percent?.home),
          draw: pct(p?.predictions?.percent?.draw),
          away: pct(p?.predictions?.percent?.away),
        },
        advice: p?.predictions?.advice || '',
        comparison: {
          form: p?.comparison?.form,
          att: p?.comparison?.att,
          def: p?.comparison?.def,
          total: p?.comparison?.total,
        },
        last5: { home: p?.teams?.home?.last_5?.form, away: p?.teams?.away?.last_5?.form },
      };
    }),
  );
  return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

type AiModelName = 'claude' | 'deepseek';

function hasAi(env: Env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY || env.DEEPSEEK_API_KEY);
}

function aiSystemPrompt(): string {
  return (
    "Tu es un analyste football prudent et honnête. On te donne des matchs à venir avec des statistiques. " +
    `Choisis au maximum ${MAX_PICKS} matchs où les données convergent le plus clairement (jamais plus que nécessaire : si peu de matchs sont fiables, n'en retiens que 1 ou 2). ` +
    "Pour chacun, propose UN pari simple portant sur le résultat à 90 minutes. " +
    "Le champ bet doit valoir EXACTEMENT l'une de ces valeurs : HOME_WIN, AWAY_WIN, DRAW, HOME_OR_DRAW, AWAY_OR_DRAW, OVER_1_5, OVER_2_5, UNDER_2_5, UNDER_3_5, BTTS_YES. " +
    "Le champ market est le libellé lisible en français correspondant (ex. « Victoire de Paris SG », « Plus de 1,5 buts »). " +
    "La confiance est un entier entre 0 et 100, calibré sur les données fournies, jamais au-dessus de 85. " +
    "N'invente aucune statistique absente des données. Explique en français en 2 phrases courtes maximum. " +
    'Réponds UNIQUEMENT avec du JSON : {"picks":[{"fixtureId":number,"bet":string,"market":string,"confidence":number,"reasoning":string}]}'
  );
}

async function askClaude(env: Env, candidates: Candidate[]): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.AI_MODEL || 'claude-haiku-5-5',
      max_tokens: 1200,
      system: aiSystemPrompt(),
      messages: [{ role: 'user', content: JSON.stringify(candidates) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (body.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('');
}

async function askDeepSeek(env: Env, candidates: Candidate[], modelId: string): Promise<string> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: aiSystemPrompt() },
        { role: 'user', content: JSON.stringify(candidates) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content || '';
}

function parseAiPicks(text: string): AiPick[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse IA illisible');
  const parsed = JSON.parse(match[0]) as { picks?: AiPick[] };
  return Array.isArray(parsed.picks) ? parsed.picks : [];
}

// Essaie le modèle principal, puis bascule sur l'autre s'il est absent, en panne ou répond n'importe quoi.
// Un modèle sans clé configurée est simplement ignoré.
async function askAi(env: Env, candidates: Candidate[]): Promise<{ picks: AiPick[]; model: AiModelName }> {
  const order: AiModelName[] = env.AI_PRIMARY === 'claude' ? ['claude', 'deepseek'] : ['deepseek', 'claude'];
  const available = order.filter((m) => (m === 'claude' ? env.ANTHROPIC_API_KEY : env.DEEPSEEK_API_KEY));
  let lastError: unknown = new Error('Aucun modèle IA configuré');
  for (const model of available) {
    try {
      if (model === 'claude') {
        return { picks: parseAiPicks(await askClaude(env, candidates)), model };
      }
      // DeepSeek : V4 Pro d'abord, V4 Flash en secours, avant de passer à Claude
      const ids = [env.DEEPSEEK_MODEL || 'deepseek-v4-pro', 'deepseek-v4-flash'].filter((id, i, arr) => arr.indexOf(id) === i);
      let dsError: unknown = new Error('DeepSeek indisponible');
      for (const id of ids) {
        try {
          return { picks: parseAiPicks(await askDeepSeek(env, candidates, id)), model };
        } catch (err) {
          dsError = err;
        }
      }
      throw dsError;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

const PICKS_LATEST_KEY = 'picks_latest_v1';
let memLatest: { ts: number; picks: any[] } | null = null;
let picksRefreshing = false;

async function loadLatestPicks(env: Env): Promise<{ ts: number; picks: any[] } | null> {
  if (env.CACHE) {
    try {
      const raw = await env.CACHE.get(PICKS_LATEST_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* repli mémoire */
    }
  }
  return memLatest;
}

function picksTtlSeconds(env: Env): number {
  return Math.max(60, parseInt(env.PICKS_CACHE_SECONDS || '21600', 10)); // 6 h par défaut
}

// Génère les pronostics, les enregistre dans l'historique et garde une copie « dernière version connue »
async function refreshPicks(env: Env): Promise<any[]> {
  const picks = (await buildPicks(env)) as any[];
  if (picks.length) {
    await recordHistory(env, picks);
    memLatest = { ts: Date.now(), picks };
    if (env.CACHE) {
      try {
        await env.CACHE.put(PICKS_LATEST_KEY, JSON.stringify(memLatest)); // sans expiration
      } catch {
        /* non bloquant */
      }
    }
  }
  await cacheSet(env, `picks_${isoDay(new Date())}`, picks, picks.length ? picksTtlSeconds(env) : 1800);
  return picks;
}

// Tâche planifiée (cron) : règle les résultats même sans visiteur, et prépare les pronostics du jour
async function runCron(env: Env, cron: string): Promise<void> {
  if (!isConfigured(env)) return;
  try {
    await settleHistory(env, await loadHistory(env));
  } catch {
    /* on réessaiera */
  }
  if (cron.includes('7,13') && hasAi(env)) {
    try {
      const hit = await cacheGet(env, `picks_${isoDay(new Date())}`, picksTtlSeconds(env));
      if (!hit) await refreshPicks(env);
    } catch {
      /* non bloquant */
    }
  }
}

async function buildPicks(env: Env): Promise<unknown[]> {
  const candidates = await loadCandidates(env);
  if (candidates.length === 0) return [];
  const { picks: aiPicks, model } = await askAi(env, candidates);
  const byId = new Map(candidates.map((c) => [c.fixtureId, c]));
  return aiPicks
    .filter((p) => byId.has(p.fixtureId) && (BETS as readonly string[]).includes(p.bet))
    .map((p) => {
      const c = byId.get(p.fixtureId)!;
      return {
        fixtureId: c.fixtureId,
        league: c.league,
        kickoff: c.kickoff,
        home: c.home,
        away: c.away,
        percent: c.percent,
        bet: p.bet,
        model,
        market: String(p.market || '').slice(0, 80),
        confidence: Math.max(0, Math.min(85, Math.round(Number(p.confidence) || 0))),
        reasoning: String(p.reasoning || '').slice(0, 400),
      };
    })
    .sort((a: any, b: any) => b.confidence - a.confidence)
    .slice(0, MAX_PICKS);
}

// ---------------------------------------------------------------------------
// Rédaction maison : articles écrits par toi (page /admin), avec assistant IA
// ---------------------------------------------------------------------------
const CATEGORIES = ['FOOTBALL', 'MERCATO', 'EUROPE', 'AFRIQUE', 'BASKET', 'TENNIS', 'AUTRE'];
const ARTICLES_KEY = 'articles_v1';
const MAX_ARTICLES = 300;
const TO_VERIFY = '[À VÉRIFIER';
let memArticles: Article[] = [];

interface Article {
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

async function loadArticles(env: Env): Promise<Article[]> {
  if (env.CACHE) {
    try {
      const raw = await env.CACHE.get(ARTICLES_KEY);
      if (raw) return JSON.parse(raw) as Article[];
    } catch {
      /* repli mémoire */
    }
  }
  return memArticles;
}

async function saveArticles(env: Env, list: Article[]): Promise<void> {
  memArticles = list;
  if (env.CACHE) await env.CACHE.put(ARTICLES_KEY, JSON.stringify(list)); // sans expiration ; l'erreur remonte à l'admin
}

const textEncoder = new TextEncoder();

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(data)));
}

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function passwordMatches(env: Env, given: string): Promise<boolean> {
  // On compare des empreintes (même longueur, comparaison à temps constant)
  return safeEqual(await hmac('fsn-compare', given), await hmac('fsn-compare', env.ADMIN_PASSWORD || ''));
}

async function signToken(env: Env): Promise<string> {
  const payload = b64url(textEncoder.encode(JSON.stringify({ exp: Date.now() + 7 * 86400e3 })));
  return `${payload}.${b64url(await hmac(`fsn-token:${env.ADMIN_PASSWORD}`, payload))}`;
}

async function verifyToken(env: Env, token: string): Promise<boolean> {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = b64url(await hmac(`fsn-token:${env.ADMIN_PASSWORD}`, payload));
  if (!safeEqual(textEncoder.encode(sig), textEncoder.encode(expected))) return false;
  try {
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

async function readJson(request: Request): Promise<any> {
  const text = await request.text();
  if (text.length > 100_000) throw new Error('Requête trop volumineuse');
  return text ? JSON.parse(text) : {};
}

function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '';
}

// Valide et nettoie un article envoyé par l'admin (le texte est affiché tel quel : jamais de HTML)
function sanitizeArticle(body: any): { ok: true; value: Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'> } | { ok: false; error: string } {
  const title = cleanText(body.title, 140);
  const summary = cleanText(body.summary, 320);
  const content = (Array.isArray(body.content) ? body.content : [])
    .map((p: unknown) => cleanText(p, 4000))
    .filter(Boolean)
    .slice(0, 40);
  const category = CATEGORIES.includes(body.category) ? body.category : 'AUTRE';
  const status = body.status === 'published' ? 'published' : 'draft';
  const image = cleanText(body.imageUrl, 500);
  const imageUrl = /^https:\/\//.test(image) ? image : undefined;
  if (!title) return { ok: false, error: 'Le titre est obligatoire.' };
  if (status === 'published') {
    if (content.length === 0) return { ok: false, error: 'Ajoute du texte avant de publier.' };
    if ([title, summary, ...content].some((t) => t.includes(TO_VERIFY))) {
      return { ok: false, error: 'Le texte contient encore des « [À VÉRIFIER ... ] » : vérifie les faits et retire-les avant de publier.' };
    }
  }
  return { ok: true, value: { title, summary, content, category, imageUrl, status } };
}

// ----- Assistant IA (DeepSeek d'abord, Claude en secours) -----
async function claudeText(env: Env, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.AI_MODEL || 'claude-haiku-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (body.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('');
}

async function deepSeekText(env: Env, system: string, user: string, maxTokens: number, modelId: string): Promise<string> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content || '';
}

// Renvoie un objet JSON : essaie le modèle principal, puis l'autre ; une réponse illisible compte comme un échec
async function aiJson(env: Env, system: string, user: string, maxTokens = 1800): Promise<any> {
  const order: AiModelName[] = env.AI_PRIMARY === 'claude' ? ['claude', 'deepseek'] : ['deepseek', 'claude'];
  const available = order.filter((m) => (m === 'claude' ? env.ANTHROPIC_API_KEY : env.DEEPSEEK_API_KEY));
  if (available.length === 0) throw new Error("Aucune clé IA configurée (DEEPSEEK_API_KEY ou ANTHROPIC_API_KEY).");
  let lastError: unknown = new Error('IA indisponible');
  for (const model of available) {
    const attempts =
      model === 'claude'
        ? [() => claudeText(env, system, user, maxTokens)]
        : [env.DEEPSEEK_MODEL || 'deepseek-v4-pro', 'deepseek-v4-flash']
            .filter((id, i, arr) => arr.indexOf(id) === i)
            .map((id) => () => deepSeekText(env, system, user, maxTokens, id));
    for (const attempt of attempts) {
      try {
        const m = (await attempt()).match(/\{[\s\S]*\}/);
        if (!m) throw new Error('Réponse IA illisible');
        return JSON.parse(m[0]);
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError;
}

const DRAFT_SYSTEM =
  "Tu es journaliste sportif pour un site d'actualités sportives francophone. Tu rédiges UNIQUEMENT à partir des faits fournis par l'éditeur. " +
  "Règles strictes : n'invente aucun score, nom, date, citation, statistique ou fait absent des notes ; " +
  `si une information importante manque, écris « ${TO_VERIFY} : ce qu'il faut confirmer] » à la place ; ` +
  "n'attribue aucune citation à personne sans qu'elle figure dans les notes ; style clair, neutre et vivant, phrases courtes, pas de superlatifs gratuits ; " +
  "ne recopie aucun texte d'un autre média ; écris en français. " +
  'Réponds UNIQUEMENT en JSON : {"title": string (90 caractères max), "summary": string (220 caractères max), "paragraphs": string[]}';

const IMPROVE_INSTRUCTIONS: Record<string, string> = {
  rewrite: "Reformule le texte pour qu'il soit plus fluide et agréable à lire, sans changer les faits ni en ajouter.",
  shorten: "Raccourcis le texte d'environ un tiers en gardant les faits essentiels, sans en ajouter.",
  proofread: "Corrige uniquement l'orthographe, la grammaire et la ponctuation, sans changer le style ni le sens.",
};

async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.ADMIN_PASSWORD) {
    return json({ success: false, error: "ADMIN_PASSWORD n'est pas configuré dans Cloudflare (secret)." }, 503);
  }
  const path = url.pathname;

  if (path === '/api/admin/login') {
    if (request.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405);
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    const failKey = `login_fail_${ip}`;
    const fails = Number((await cacheGet(env, failKey, 900)) ?? 0);
    if (fails >= 5) return json({ success: false, error: 'Trop de tentatives. Réessaie dans 15 minutes.' }, 429);
    const body = await readJson(request).catch(() => ({}));
    if (!(await passwordMatches(env, typeof body.password === 'string' ? body.password : ''))) {
      await cacheSet(env, failKey, fails + 1, 900);
      return json({ success: false, error: 'Mot de passe incorrect.' }, 401);
    }
    await cacheSet(env, failKey, 0, 60);
    return json({ success: true, token: await signToken(env) });
  }

  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || !(await verifyToken(env, auth.slice(7)))) {
    return json({ success: false, error: 'Session expirée, reconnecte-toi.' }, 401);
  }

  if (path === '/api/admin/messages' && request.method === 'GET') {
    return json({ success: true, items: await loadContacts(env) });
  }
  if (path === '/api/admin/messages/delete' && request.method === 'POST') {
    const body = await readJson(request).catch(() => ({}));
    const list = (await loadContacts(env)).filter((m) => m.id !== body.id);
    await kvWrite(env, CONTACT_KEY, JSON.stringify(list));
    return json({ success: true });
  }

  if (path === '/api/admin/articles' && request.method === 'GET') {
    const list = [...(await loadArticles(env))].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return json({ success: true, items: list });
  }

  if (path === '/api/admin/articles' && request.method === 'POST') {
    const body = await readJson(request);
    const parsed = sanitizeArticle(body);
    if (!parsed.ok) return json({ success: false, error: parsed.error }, 400);
    const now = new Date().toISOString();
    const list = [...(await loadArticles(env))];
    const index = typeof body.id === 'string' ? list.findIndex((a) => a.id === body.id) : -1;
    let article: Article;
    if (index >= 0) {
      const old = list[index];
      article = {
        ...old,
        ...parsed.value,
        updatedAt: now,
        publishedAt: parsed.value.status === 'published' ? old.publishedAt ?? now : old.publishedAt,
      };
      list[index] = article;
    } else {
      article = {
        id: crypto.randomUUID(),
        ...parsed.value,
        createdAt: now,
        updatedAt: now,
        publishedAt: parsed.value.status === 'published' ? now : undefined,
      };
      list.unshift(article);
    }
    await saveArticles(env, list.slice(0, MAX_ARTICLES));
    return json({ success: true, item: article });
  }

  if (path === '/api/admin/articles/delete' && request.method === 'POST') {
    const body = await readJson(request);
    const list = (await loadArticles(env)).filter((a) => a.id !== body.id);
    await saveArticles(env, list);
    return json({ success: true });
  }

  if (path === '/api/admin/ai/draft' && request.method === 'POST') {
    const body = await readJson(request);
    const notes = cleanText(body.notes, 6000);
    if (notes.length < 40) {
      return json({ success: false, error: "Donne d'abord les faits à utiliser (au moins quelques lignes) : l'IA n'invente rien." }, 400);
    }
    const input = {
      rubrique: CATEGORIES.includes(body.category) ? body.category : 'AUTRE',
      sujet: cleanText(body.topic, 200),
      ton: ['Informatif', 'Analyse', 'Brève'].includes(body.tone) ? body.tone : 'Informatif',
      longueur: body.tone === 'Brève' ? '1 à 2 paragraphes' : '3 à 5 paragraphes',
      notes,
    };
    const out = await aiJson(env, DRAFT_SYSTEM, JSON.stringify(input));
    const paragraphs = (Array.isArray(out.paragraphs) ? out.paragraphs : []).map((p: unknown) => cleanText(p, 4000)).filter(Boolean);
    if (!out.title || paragraphs.length === 0) return json({ success: false, error: "L'IA n'a pas produit de brouillon exploitable. Réessaie." }, 502);
    return json({ success: true, title: cleanText(out.title, 140), summary: cleanText(out.summary, 320), paragraphs });
  }

  if (path === '/api/admin/ai/improve' && request.method === 'POST') {
    const body = await readJson(request);
    const mode = String(body.mode || '');
    const title = cleanText(body.title, 140);
    const paragraphs = (Array.isArray(body.content) ? body.content : []).map((p: unknown) => cleanText(p, 4000)).filter(Boolean);
    if (paragraphs.length === 0 && mode !== 'titles') return json({ success: false, error: 'Aucun texte à traiter.' }, 400);
    if (mode === 'titles') {
      const sys =
        "Tu es secrétaire de rédaction d'un site sportif francophone. Propose 3 titres accrocheurs mais honnêtes (90 caractères max), sans rien affirmer qui ne figure pas dans le texte. " +
        'Réponds UNIQUEMENT en JSON : {"titles": string[]}';
      const out = await aiJson(env, sys, JSON.stringify({ titre: title, texte: paragraphs }), 600);
      const titles = (Array.isArray(out.titles) ? out.titles : []).map((t: unknown) => cleanText(t, 140)).filter(Boolean).slice(0, 3);
      return json({ success: true, titles });
    }
    if (!IMPROVE_INSTRUCTIONS[mode]) return json({ success: false, error: 'Action inconnue.' }, 400);
    const sys =
      `Tu es secrétaire de rédaction d'un site sportif francophone. ${IMPROVE_INSTRUCTIONS[mode]} ` +
      `N'invente aucun fait ; conserve tel quel tout passage « ${TO_VERIFY} ... ] ». ` +
      'Réponds UNIQUEMENT en JSON : {"paragraphs": string[]}';
    const out = await aiJson(env, sys, JSON.stringify({ texte: paragraphs }));
    const result = (Array.isArray(out.paragraphs) ? out.paragraphs : []).map((p: unknown) => cleanText(p, 4000)).filter(Boolean);
    if (result.length === 0) return json({ success: false, error: "L'IA n'a rien produit. Réessaie." }, 502);
    return json({ success: true, paragraphs: result });
  }

  return json({ success: false, error: 'Not found' }, 404);
}

// ---------- Comptes utilisateurs (accès aux pronostics IA) ----------
// Mots de passe : PBKDF2-SHA256 + sel aléatoire (jamais stockés en clair).
// Session : jeton aléatoire dans un cookie HttpOnly ; seule son empreinte SHA-256 est gardée dans le KV.
interface UserRec {
  email: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: string;
}
interface SessionRec {
  email: string;
  exp: number;
}

const SESSION_COOKIE = 'fsn_session';
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000; // maximum accepté par Cloudflare Workers
const memStore = new Map<string, string>(); // repli sans KV (local) : perdu au redémarrage

const toHex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string): Uint8Array<ArrayBuffer> => new Uint8Array((hex.match(/../g) || []).map((h) => parseInt(h, 16)));

async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', textEncoder.encode(text))));
}

async function kvRead(env: Env, key: string): Promise<string | null> {
  if (env.CACHE) return env.CACHE.get(key);
  return memStore.get(key) ?? null;
}
async function kvWrite(env: Env, key: string, value: string, ttlSec?: number): Promise<void> {
  if (env.CACHE) await env.CACHE.put(key, value, ttlSec ? { expirationTtl: Math.max(60, ttlSec) } : undefined);
  else memStore.set(key, value);
}
async function kvRemove(env: Env, key: string): Promise<void> {
  if (env.CACHE) await env.CACHE.delete(key);
  else memStore.delete(key);
}

async function hashPassword(password: string, salt: BufferSource): Promise<string> {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return toHex(new Uint8Array(bits));
}

const userKey = async (email: string) => `user_${await sha256Hex(email)}`;

async function loadUser(env: Env, email: string): Promise<UserRec | null> {
  try {
    const raw = await kvRead(env, await userKey(email));
    return raw ? (JSON.parse(raw) as UserRec) : null;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

// Utilisateur connecté (null si pas de session valide)
async function getSessionUser(request: Request, env: Env): Promise<{ name: string; email: string } | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  try {
    const raw = await kvRead(env, `sess_${await sha256Hex(token)}`);
    if (!raw) return null;
    const sess = JSON.parse(raw) as SessionRec;
    if (!(sess.exp > Date.now())) return null;
    const user = await loadUser(env, sess.email);
    return user ? { name: user.name, email: user.email } : null;
  } catch {
    return null;
  }
}

function sessionCookie(token: string, maxAgeSec: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
}

function jsonWithCookie(body: unknown, cookie: string, status = 200): Response {
  const res = json(body, status);
  res.headers.append('set-cookie', cookie);
  return res;
}

async function startSession(env: Env, user: { name: string; email: string }, secure: boolean): Promise<Response> {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const sess: SessionRec = { email: user.email, exp: Date.now() + SESSION_DAYS * 86400e3 };
  await kvWrite(env, `sess_${await sha256Hex(token)}`, JSON.stringify(sess), SESSION_DAYS * 86400);
  return jsonWithCookie({ success: true, user: { name: user.name, email: user.email } }, sessionCookie(token, SESSION_DAYS * 86400, secure));
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

async function handleAuth(request: Request, env: Env, url: URL): Promise<Response> {
  const secure = url.protocol === 'https:';
  const path = url.pathname;

  if (path === '/api/auth/me' && request.method === 'GET') {
    return json({ success: true, user: await getSessionUser(request, env) });
  }
  if (request.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405);

  if (path === '/api/auth/logout') {
    const token = readCookie(request, SESSION_COOKIE);
    if (/^[A-Za-z0-9_-]{40,60}$/.test(token)) await kvRemove(env, `sess_${await sha256Hex(token)}`).catch(() => {});
    return jsonWithCookie({ success: true }, sessionCookie('', 0, secure));
  }

  const body = await readJson(request).catch(() => ({}));
  const email = cleanText(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const ip = request.headers.get('cf-connecting-ip') || 'local';

  if (!EMAIL_RE.test(email)) return json({ success: false, error: 'Adresse e-mail invalide.' }, 400);

  if (path === '/api/auth/register') {
    const regKey = `reg_ip_${await sha256Hex(ip)}`;
    const regCount = Number((await cacheGet(env, regKey, 3600)) ?? 0);
    if (regCount >= 10) return json({ success: false, error: 'Trop de créations de compte. Réessaie dans une heure.' }, 429);
    if (password.length < 8 || password.length > 128) {
      return json({ success: false, error: 'Le mot de passe doit contenir entre 8 et 128 caractères.' }, 400);
    }
    if (await loadUser(env, email)) return json({ success: false, error: 'Un compte existe déjà avec cet e-mail. Connecte-toi.' }, 409);

    const name = cleanText(body.name, 40) || email.split('@')[0].slice(0, 40);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const user: UserRec = { email, name, salt: toHex(salt), hash: await hashPassword(password, salt), createdAt: new Date().toISOString() };
    await kvWrite(env, await userKey(email), JSON.stringify(user));
    await cacheSet(env, regKey, regCount + 1, 3600);
    return startSession(env, user, secure);
  }

  if (path === '/api/auth/login') {
    // Blocage temporaire après 5 échecs (par e-mail + adresse IP)
    const failKey = `login_fail_u_${await sha256Hex(`${ip}|${email}`)}`;
    const fails = Number((await cacheGet(env, failKey, 900)) ?? 0);
    if (fails >= 5) return json({ success: false, error: 'Trop de tentatives. Réessaie dans 15 minutes.' }, 429);

    const user = await loadUser(env, email);
    // Même travail de calcul que le compte existe ou non (pas de fuite par le temps de réponse)
    const salt = user ? fromHex(user.salt) : new Uint8Array(16);
    const given = await hashPassword(password.slice(0, 128), salt);
    if (!user || !safeEqual(textEncoder.encode(given), textEncoder.encode(user.hash))) {
      await cacheSet(env, failKey, fails + 1, 900);
      return json({ success: false, error: 'E-mail ou mot de passe incorrect.' }, 401);
    }
    await cacheSet(env, failKey, 0, 60);
    return startSession(env, user, secure);
  }

  return json({ success: false, error: 'Not found' }, 404);
}

// ---------- Championnats africains, ligues, équipes, contact ----------
const LEAGUE_EXCLUDE_RE =
  /women|feminin|femini|\bU-?\d{2}\b|youth|junior|reserve|amateur|regional|futsal|beach|diski|\b(2|II)\b|second|division 2|ligue 2|2nd|third|national league|\bcup\b|supercup|super cup|play-?off|promotion|relegation/i;
const COUNTRY_PRIORITY = [
  'egypt', 'morocco', 'algeria', 'tunisia', 'south-africa', 'nigeria', 'ghana', 'senegal', 'ivory-coast', 'cameroon',
  'congo-dr', 'dr-congo', 'burkina-faso', 'mali', 'guinea', 'benin', 'togo', 'kenya', 'tanzania', 'zambia', 'angola',
];

// Compétitions africaines de la saison en cours : continentales + 1 championnat national par pays (le plus ancien identifiant,
// c'est-à-dire la première division dans le catalogue d'API-Football). Les identifiants viennent de l'API, rien n'est codé en dur.
function compactAfricanLeagues(resp: any[]) {
  const continental: any[] = [];
  const byCountry = new Map<string, any>();
  for (const it of resp) {
    const lg = it.league || {};
    const c = it.country || {};
    const name = String(lg.name || '');
    const country = String(c.name || '');
    if (!lg.id || !isAfricanLeague(country, name)) continue;
    const cur = (it.seasons || []).find((x: any) => x.current);
    if (!cur) continue;
    const isCont = /^(world|africa)$/i.test(country);
    if (isCont && /\bU-?\d{2}\b|women|youth|futsal|beach|qualif/i.test(name) && !/CAF Champions|Confederation|Africa Cup of Nations$|Super Cup/i.test(name)) continue;
    if (!isCont && (lg.type !== 'League' || LEAGUE_EXCLUDE_RE.test(name))) continue;
    const row = { id: lg.id as number, name, country, code: c.code || null, continental: isCont, season: cur.year as number };
    if (isCont) continental.push(row);
    else {
      const key = country.toLowerCase();
      const prev = byCountry.get(key);
      if (!prev || row.id < prev.id) byCountry.set(key, row);
    }
  }
  const rank = (c: string) => {
    const i = COUNTRY_PRIORITY.indexOf(c.toLowerCase());
    return i === -1 ? 999 : i;
  };
  const national = [...byCountry.values()].sort((a, b) => rank(a.country) - rank(b.country) || a.country.localeCompare(b.country));
  continental.sort((a, b) => a.name.localeCompare(b.name));
  return [...continental, ...national];
}

const rowStats = (o: any) => ({
  p: o?.played ?? 0,
  w: o?.win ?? 0,
  d: o?.draw ?? 0,
  l: o?.lose ?? 0,
  gf: o?.goals?.for ?? 0,
  ga: o?.goals?.against ?? 0,
});

function compactStandings(resp: any[]) {
  const lg = resp?.[0]?.league;
  if (!lg) return { info: null, groups: [] as any[] };
  const groups = (lg.standings || []).map((rows: any[]) => ({
    name: rows[0]?.group || '',
    rows: rows.map((r: any) => ({
      rank: r.rank,
      team: { id: r.team?.id, name: r.team?.name },
      points: r.points ?? 0,
      diff: r.goalsDiff ?? 0,
      form: r.form || '',
      desc: r.description || '',
      all: rowStats(r.all),
      home: rowStats(r.home),
      away: rowStats(r.away),
    })),
  }));
  return { info: { id: lg.id, name: lg.name, country: lg.country, season: lg.season }, groups };
}

function compactScorers(resp: any[]) {
  return (resp || []).slice(0, 20).map((x: any) => ({
    player: { id: x.player?.id, name: x.player?.name },
    team: { id: x.statistics?.[0]?.team?.id, name: x.statistics?.[0]?.team?.name },
    goals: x.statistics?.[0]?.goals?.total ?? 0,
    assists: x.statistics?.[0]?.goals?.assists ?? 0,
    games: x.statistics?.[0]?.games?.appearences ?? 0,
  }));
}

function compactPlayers(resp: any[]) {
  return (resp || []).map((t: any) => ({
    teamId: t.team?.id,
    players: (t.players || [])
      .map((p: any) => {
        const st = p.statistics?.[0] || {};
        const rating = parseFloat(st.games?.rating);
        return {
          id: p.player?.id,
          name: p.player?.name,
          number: st.games?.number ?? null,
          pos: st.games?.position ?? '',
          minutes: st.games?.minutes ?? 0,
          rating: Number.isFinite(rating) ? rating : null,
          goals: st.goals?.total ?? 0,
          assists: st.goals?.assists ?? 0,
          saves: st.goals?.saves ?? 0,
          shots: st.shots?.total ?? 0,
          shotsOn: st.shots?.on ?? 0,
          keyPasses: st.passes?.key ?? 0,
          yellow: st.cards?.yellow ?? 0,
          red: st.cards?.red ?? 0,
        };
      })
      .filter((p: any) => p.minutes > 0),
  }));
}

function isoDayInTz(tz: string, offsetDays: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(Date.now() + offsetDays * 86400e3));
}

const apiId = (v: string | null): number | null => {
  const n = parseInt(v || '', 10);
  return Number.isInteger(n) && n > 0 && n < 10_000_000 ? n : null;
};

// Messages du formulaire de contact (lus depuis /admin)
interface ContactMsg {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
}
const CONTACT_KEY = 'contact_messages_v1';

async function loadContacts(env: Env): Promise<ContactMsg[]> {
  try {
    const raw = await kvRead(env, CONTACT_KEY);
    return raw ? (JSON.parse(raw) as ContactMsg[]) : [];
  } catch {
    return [];
  }
}

async function handleContact(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405);
  const body = await readJson(request).catch(() => ({}));
  const name = cleanText(body.name, 80);
  const email = cleanText(body.email, 254).toLowerCase();
  const message = cleanText(body.message, 2000);
  if (!name || !EMAIL_RE.test(email) || message.length < 10) {
    return json({ success: false, error: 'Merci de renseigner ton nom, une adresse e-mail valide et un message (10 caractères minimum).' }, 400);
  }
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const rlKey = `contact_ip_${await sha256Hex(ip)}`;
  const count = Number((await cacheGet(env, rlKey, 3600)) ?? 0);
  if (count >= 5) return json({ success: false, error: 'Trop de messages envoyés. Réessaie dans une heure.' }, 429);
  const list = await loadContacts(env);
  list.unshift({ id: b64url(crypto.getRandomValues(new Uint8Array(9))), name, email, message, createdAt: new Date().toISOString() });
  await kvWrite(env, CONTACT_KEY, JSON.stringify(list.slice(0, 200)));
  await cacheSet(env, rlKey, count + 1, 3600);
  return json({ success: true });
}

export default {
  async scheduled(event: { cron: string }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(runCron(env, event.cron));
  },

  async fetch(request: Request, env: Env, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url);
    const configured = isConfigured(env);
    const liveTtl = Math.max(15, parseInt(env.LIVE_CACHE_SECONDS || '100', 10));

    try {
      if (url.pathname === '/api/status') {
        return json({
          configured,
          aiConfigured: hasAi(env),
          quota: lastQuota,
          provider: env.API_FOOTBALL_KEY ? 'api-sports' : env.RAPIDAPI_KEY ? 'rapidapi' : 'demo-simulation',
          baseUrl: configured ? (env.RAPIDAPI_KEY ? RAPID_URL : BASE_URL) : null,
          message: configured
            ? 'Connecté à API-Football en direct'
            : 'Mode Démonstration & Simulation Active (ajoutez API_FOOTBALL_KEY)',
        });
      }

      if (url.pathname === '/api/fixtures/live') {
        if (!configured) return json({ success: true, fromRealApi: false, count: 0, fixtures: [] });
        const r = await cachedApi(env, 'fixtures_live_all_v2', '/fixtures?live=all', liveTtl, compactFixture);
        return json({
          success: true,
          fromRealApi: true,
          cached: r.cached,
          count: (r.data as any[]).length,
          data: r.data,
          apiError: r.apiError,
          quota: lastQuota,
        });
      }

      if (url.pathname === '/api/fixtures/detail') {
        if (!configured) return json({ success: true, fromRealApi: false });
        const id = url.searchParams.get('id') || '';
        if (!/^\d{1,10}$/.test(id)) return json({ success: false, error: 'Identifiant invalide' }, 400);
        const key = `fixture_detail_v1_${id}`;
        const hit = await cacheGet(env, key, liveTtl);
        if (hit) return json({ success: true, fromRealApi: true, cached: true, data: hit });
        const { response, errors } = await callApiRaw(env, `/fixtures?id=${id}`);
        if (errors && response.length === 0) return json({ success: true, fromRealApi: true, apiError: errors });
        if (response.length === 0) return json({ success: true, fromRealApi: true, data: null });
        const detail = compactDetail(response[0]);
        const finished = ['FT', 'AET', 'PEN'].includes(detail.status);
        await cacheSet(env, key, detail, finished ? 21600 : liveTtl);
        return json({ success: true, fromRealApi: true, cached: false, data: detail });
      }

      if (url.pathname === '/api/articles') {
        const list = (await loadArticles(env))
          .filter((a) => a.status === 'published')
          .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
          .slice(0, 60);
        return json({ success: true, items: list });
      }

      if (url.pathname.startsWith('/api/admin/')) return await handleAdmin(request, env, url);

      if (url.pathname.startsWith('/api/auth/')) return await handleAuth(request, env, url);

      // Pronostics IA : réservés aux comptes connectés
      if ((url.pathname === '/api/picks' || url.pathname === '/api/picks/history') && !(await getSessionUser(request, env))) {
        return json({ success: false, error: 'auth_required' }, 401);
      }

      if (url.pathname === '/api/news') {
        const ttl = Math.max(60, parseInt(env.NEWS_CACHE_SECONDS || '900', 10)); // 15 min par défaut
        const hit = await cacheGet(env, 'news_v1', ttl);
        if (hit) return json({ success: true, cached: true, source: 'Maxifoot', items: hit });
        const items = await loadNews();
        if (items.length) await cacheSet(env, 'news_v1', items, ttl);
        return json({ success: true, cached: false, source: 'Maxifoot', items });
      }

      if (url.pathname === '/api/picks/history') {
        let h = await loadHistory(env);
        if (configured) h = await settleHistory(env, h);
        const count = (r: HistoryEntry['result']) => h.entries.filter((e) => e.result === r).length;
        const won = count('won');
        const lost = count('lost');
        const pct = (w: number, l: number) => (w + l > 0 ? Math.round((w / (w + l)) * 100) : null);
        const settled = h.entries.filter((e) => e.result === 'won' || e.result === 'lost'); // déjà triés du plus récent au plus ancien
        const period = (days: number) => {
          const since = Date.now() - days * 86400e3;
          const mine = settled.filter((e) => new Date(e.kickoff).getTime() >= since);
          const w = mine.filter((e) => e.result === 'won').length;
          return { won: w, lost: mine.length - w, rate: pct(w, mine.length - w) };
        };
        let streak = 0;
        for (const e of settled) {
          if (e.result !== settled[0].result) break;
          streak++;
        }
        return json({
          success: true,
          updatedAt: new Date().toISOString(),
          stats: {
            total: h.entries.length,
            won,
            lost,
            pending: count('pending'),
            void: count('void'),
            rate: pct(won, lost),
            last7: period(7),
            last30: period(30),
            streak: settled.length ? { type: settled[0].result, count: streak } : null,
            form: settled.slice(0, 10).map((e) => e.result), // 10 derniers résultats, du plus récent au plus ancien
            byModel: (['claude', 'deepseek'] as const)
              .map((m) => {
                const mine = h.entries.filter((e) => e.model === m);
                const w = mine.filter((e) => e.result === 'won').length;
                const l = mine.filter((e) => e.result === 'lost').length;
                return { model: m, won: w, lost: l, rate: pct(w, l) };
              })
              .filter((x) => x.won + x.lost > 0),
          },
          entries: h.entries.slice(0, 50),
        });
      }

      if (url.pathname === '/api/games') {
        const sport = url.searchParams.get('sport') || '';
        const host = SPORT_HOSTS[sport];
        if (!host) return json({ success: false, error: 'Sport non pris en charge' }, 400);
        if (!env.API_FOOTBALL_KEY) {
          return json({ success: true, fromRealApi: false, data: [], apiError: 'Ce sport demande la clé API-Sports (API_FOOTBALL_KEY).' });
        }
        const date = url.searchParams.get('date') || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ success: false, error: 'Date invalide' }, 400);
        const diffDays = Math.abs(new Date(`${date}T12:00:00Z`).getTime() - Date.now()) / 86400000;
        if (!(diffDays <= 8)) return json({ success: false, error: 'Date hors de la plage autorisée (±7 jours)' }, 400);
        const tz = safeTimeZone(url.searchParams.get('tz'));
        const todayInTz = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
        const ttl = date === todayInTz ? liveTtl : 3600;
        const key = `games_${sport}_${date}_${tz}`;
        const hit = await cacheGet(env, key, ttl);
        if (hit) return json({ success: true, fromRealApi: true, cached: true, data: hit });
        const { response, errors } = await callApiRaw(env, `/games?date=${date}&timezone=${encodeURIComponent(tz)}`, host);
        if (errors && response.length === 0) return json({ success: true, fromRealApi: true, data: [], apiError: errors });
        const compact = response.map(compactGame);
        await cacheSet(env, key, compact, ttl);
        return json({ success: true, fromRealApi: true, cached: false, data: compact });
      }

      if (url.pathname === '/api/fixtures/date') {
        if (!configured) return json({ success: true, fromRealApi: false, data: [] });
        const date = url.searchParams.get('date') || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ success: false, error: 'Date invalide' }, 400);
        const diffDays = Math.abs(new Date(`${date}T12:00:00Z`).getTime() - Date.now()) / 86400000;
        if (!(diffDays <= 8)) return json({ success: false, error: 'Date hors de la plage autorisée (±7 jours)' }, 400);
        const tz = safeTimeZone(url.searchParams.get('tz'));
        const todayInTz = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
        const ttl = date === todayInTz ? liveTtl : 3600;
        const key = `fixtures_date_v2_${date}_${tz}`;
        const hit = await cacheGet(env, key, ttl);
        if (hit) return json({ success: true, fromRealApi: true, cached: true, data: hit });
        const { response, errors } = await callApiRaw(env, `/fixtures?date=${date}&timezone=${encodeURIComponent(tz)}`);
        if (errors && response.length === 0) return json({ success: true, fromRealApi: true, data: [], apiError: errors });
        const compact = response.map(compactFixture);
        await cacheSet(env, key, compact, ttl);
        return json({ success: true, fromRealApi: true, cached: false, data: compact });
      }

      if (url.pathname === '/api/contact') return await handleContact(request, env);

      if (url.pathname === '/api/leagues/africa') {
        if (!configured) return json({ success: true, fromRealApi: false, data: [] });
        const hit = await cacheGet(env, 'leagues_africa_v1', 86400);
        if (hit) return json({ success: true, fromRealApi: true, cached: true, data: hit });
        const { response, errors } = await callApiRaw(env, '/leagues?current=true');
        if (errors && response.length === 0) return json({ success: true, fromRealApi: true, data: [], apiError: errors });
        const compact = compactAfricanLeagues(response);
        if (compact.length) await cacheSet(env, 'leagues_africa_v1', compact, 86400);
        return json({ success: true, fromRealApi: true, cached: false, data: compact });
      }

      if (url.pathname === '/api/league') {
        if (!configured) return json({ success: true, fromRealApi: false });
        const id = apiId(url.searchParams.get('id'));
        if (!id) return json({ success: false, error: 'Identifiant de championnat invalide' }, 400);
        const q = url.searchParams.get('season') || '';
        const season = /^\d{4}$/.test(q) ? q : currentSeason();
        const key = `league_v2_${id}_${season}`;
        const hit = await cacheGet(env, key, 3600);
        if (hit) return json({ success: true, fromRealApi: true, cached: true, ...(hit as object) });
        const [st, sc] = await Promise.allSettled([
          callApiRaw(env, `/standings?league=${id}&season=${season}`),
          callApiRaw(env, `/players/topscorers?league=${id}&season=${season}`),
        ]);
        const stRes = st.status === 'fulfilled' ? st.value : null;
        const scRes = sc.status === 'fulfilled' ? sc.value : null;
        const standings = compactStandings(stRes?.response || []);
        const scorers = compactScorers(scRes?.response || []);
        const apiError = (stRes?.errors || (st.status === 'rejected' ? 'Erreur API' : null)) as string | null;
        if (standings.groups.length === 0 && scorers.length === 0) {
          return json({ success: true, fromRealApi: true, season, info: null, groups: [], scorers: [], apiError: apiError || null });
        }
        const payload = { season, info: standings.info, groups: standings.groups, scorers };
        await cacheSet(env, key, payload, 3600);
        return json({ success: true, fromRealApi: true, cached: false, ...payload });
      }

      if (url.pathname === '/api/league/fixtures') {
        if (!configured) return json({ success: true, fromRealApi: false, data: [] });
        const id = apiId(url.searchParams.get('id'));
        if (!id) return json({ success: false, error: 'Identifiant de championnat invalide' }, 400);
        const q = url.searchParams.get('season') || '';
        const season = /^\d{4}$/.test(q) ? q : currentSeason();
        const tz = safeTimeZone(url.searchParams.get('tz'));
        const key = `lfx_v1_${id}_${season}_${tz}`;
        const hit = await cacheGet(env, key, 600);
        if (hit) return json({ success: true, fromRealApi: true, cached: true, data: hit });
        const from = isoDayInTz(tz, -7);
        const to = isoDayInTz(tz, 7);
        const { response, errors } = await callApiRaw(
          env,
          `/fixtures?league=${id}&season=${season}&from=${from}&to=${to}&timezone=${encodeURIComponent(tz)}`,
        );
        if (errors && response.length === 0) return json({ success: true, fromRealApi: true, data: [], apiError: errors });
        const compact = response.map(compactFixture);
        await cacheSet(env, key, compact, 600);
        return json({ success: true, fromRealApi: true, cached: false, data: compact });
      }

      if (url.pathname === '/api/team') {
        if (!configured) return json({ success: true, fromRealApi: false });
        const id = apiId(url.searchParams.get('id'));
        if (!id) return json({ success: false, error: 'Identifiant d\'équipe invalide' }, 400);
        const tz = safeTimeZone(url.searchParams.get('tz'));
        const key = `team_v1_${id}_${tz}`;
        const hit = await cacheGet(env, key, 600);
        if (hit) return json({ success: true, fromRealApi: true, cached: true, ...(hit as object) });
        const tzq = encodeURIComponent(tz);
        const [last, next, info] = await Promise.allSettled([
          callApiRaw(env, `/fixtures?team=${id}&last=10&timezone=${tzq}`),
          callApiRaw(env, `/fixtures?team=${id}&next=10&timezone=${tzq}`),
          cachedApi(env, `teaminfo_v1_${id}`, `/teams?id=${id}`, 86400, (t: any) => ({
            id: t.team?.id,
            name: t.team?.name,
            country: t.team?.country,
            founded: t.team?.founded,
            venue: { name: t.venue?.name, city: t.venue?.city, capacity: t.venue?.capacity },
          })),
        ]);
        const lastRes = last.status === 'fulfilled' ? last.value : null;
        const nextRes = next.status === 'fulfilled' ? next.value : null;
        const infoRes = info.status === 'fulfilled' ? (info.value.data as any[])[0] ?? null : null;
        const payload = {
          info: infoRes,
          last: (lastRes?.response || []).map(compactFixture),
          next: (nextRes?.response || []).map(compactFixture),
        };
        if (payload.last.length === 0 && payload.next.length === 0 && !infoRes) {
          return json({ success: true, fromRealApi: true, ...payload, apiError: lastRes?.errors || nextRes?.errors || 'Aucune donnée pour cette équipe.' });
        }
        await cacheSet(env, key, payload, 600);
        return json({ success: true, fromRealApi: true, cached: false, ...payload });
      }

      if (url.pathname === '/api/fixture/players') {
        if (!configured) return json({ success: true, fromRealApi: false, teams: [] });
        const id = apiId(url.searchParams.get('id'));
        if (!id) return json({ success: false, error: 'Identifiant de match invalide' }, 400);
        const key = `fixture_players_v1_${id}`;
        const hit = await cacheGet(env, key, liveTtl);
        if (hit) return json({ success: true, fromRealApi: true, cached: true, teams: hit });
        const { response, errors } = await callApiRaw(env, `/fixtures/players?fixture=${id}`);
        if (errors && response.length === 0) return json({ success: true, fromRealApi: true, teams: [], apiError: errors });
        const teams = compactPlayers(response);
        await cacheSet(env, key, teams, liveTtl);
        return json({ success: true, fromRealApi: true, cached: false, teams });
      }

      if (url.pathname === '/api/h2h') {
        if (!configured) return json({ success: true, fromRealApi: false, data: [] });
        const a = apiId(url.searchParams.get('a'));
        const b = apiId(url.searchParams.get('b'));
        if (!a || !b) return json({ success: false, error: 'Équipes invalides' }, 400);
        const tz = safeTimeZone(url.searchParams.get('tz'));
        const key = `h2h_v1_${a}_${b}_${tz}`;
        const hit = await cacheGet(env, key, 3600);
        if (hit) return json({ success: true, fromRealApi: true, cached: true, data: hit });
        const { response, errors } = await callApiRaw(env, `/fixtures/headtohead?h2h=${a}-${b}&last=10&timezone=${encodeURIComponent(tz)}`);
        if (errors && response.length === 0) return json({ success: true, fromRealApi: true, data: [], apiError: errors });
        const compact = response.map(compactFixture);
        await cacheSet(env, key, compact, 3600);
        return json({ success: true, fromRealApi: true, cached: false, data: compact });
      }

      if (url.pathname === '/api/fixture') {
        if (!configured) return json({ success: true, fromRealApi: false });
        const id = apiId(url.searchParams.get('id'));
        if (!id) return json({ success: false, error: 'Identifiant de match invalide' }, 400);
        const key = `fixture_v1_${id}`;
        const hit = await cacheGet(env, key, liveTtl);
        if (hit) return json({ success: true, fromRealApi: true, cached: true, data: hit });
        const { response, errors } = await callApiRaw(env, `/fixtures?id=${id}`);
        if (!response[0]) return json({ success: true, fromRealApi: true, data: null, apiError: errors || 'Match introuvable' });
        const compact = compactFixture(response[0]);
        await cacheSet(env, key, compact, ['FT', 'AET', 'PEN'].includes(compact.fixture.status.short) ? 21600 : liveTtl);
        return json({ success: true, fromRealApi: true, cached: false, data: compact });
      }

      if (url.pathname === '/api/picks') {
        if (!configured) return json({ success: true, fromRealApi: false, aiConfigured: hasAi(env), picks: [] });
        if (!hasAi(env)) return json({ success: true, fromRealApi: true, aiConfigured: false, picks: [] });
        const hit = await cacheGet(env, `picks_${isoDay(new Date())}`, picksTtlSeconds(env));
        if (hit) return json({ success: true, fromRealApi: true, aiConfigured: true, cached: true, picks: hit });

        // Cache expiré : on répond tout de suite avec la dernière version connue et on rafraîchit en arrière-plan
        const latest = await loadLatestPicks(env);
        const usable = latest && Date.now() - latest.ts < 36 * 3600e3
          ? latest.picks.filter((p) => new Date(p.kickoff).getTime() > Date.now() - 3 * 3600e3)
          : [];
        if (usable.length > 0 && ctx) {
          if (!picksRefreshing) {
            picksRefreshing = true;
            ctx.waitUntil(refreshPicks(env).catch(() => []).finally(() => { picksRefreshing = false; }));
          }
          return json({ success: true, fromRealApi: true, aiConfigured: true, cached: true, stale: true, picks: usable });
        }
        const picks = await refreshPicks(env);
        return json({ success: true, fromRealApi: true, aiConfigured: true, cached: false, picks });
      }

      if (url.pathname === '/api/standings' || url.pathname === '/api/topscorers') {
        const isStandings = url.pathname === '/api/standings';
        const league = url.searchParams.get('league') || 'ligue1';
        const season = url.searchParams.get('season') || currentSeason();
        if (!configured) {
          return json(
            isStandings
              ? { success: true, fromRealApi: false, league, standings: [] }
              : { success: true, fromRealApi: false, topscorers: [] },
          );
        }
        const leagueId = LEAGUE_ID_MAP[league] || parseInt(league, 10) || 61;
        const endpoint = isStandings ? 'standings' : 'players/topscorers';
        const r = await cachedApi(
          env,
          `${isStandings ? 'standings' : 'topscorers'}_${leagueId}_${season}`,
          `/${endpoint}?league=${leagueId}&season=${season}`,
          3600,
        );
        return json({ success: true, fromRealApi: true, cached: r.cached, data: r.data, apiError: r.apiError });
      }

      return json({ success: false, error: 'Not found' }, 404);
    } catch (err) {
      return json({ success: false, fromRealApi: false, error: err instanceof Error ? err.message : 'Unknown error' }, 500);
    }
  },
};
