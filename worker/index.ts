// Worker Cloudflare : sert l'API (/api/*). Les fichiers du site (dist/) sont servis par Cloudflare Assets.

type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
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
    events: (f.events || []).map((e: any) => ({
      type: e.type,
      detail: e.detail,
      time: { elapsed: e.time?.elapsed },
      team: { id: e.team?.id },
      player: { name: e.player?.name },
      assist: { name: e.assist?.name },
    })),
  };
}

// Autres sports : même compte et même clé API-Sports, une API (et un quota) par sport
const SPORT_HOSTS: Record<string, string> = {
  basketball: 'https://v1.basketball.api-sports.io',
  rugby: 'https://v1.rugby.api-sports.io',
  hockey: 'https://v1.hockey.api-sports.io',
  handball: 'https://v1.handball.api-sports.io',
};

function compactGame(g: any) {
  // Basket : scores.home = { total, quarter_1... } ; hockey/rugby/handball : scores.home = nombre
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
      const res = await fetch(f.url, { headers: { 'user-agent': 'FlashScoreNext/1.0 (+rss reader)' } });
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
  if (due.length > 0 && now - h.lastSettle >= 10 * 60e3) {
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

export default {
  async scheduled(event: { cron: string }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(runCron(env, event.cron));
  },

  async fetch(request: Request, env: Env, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url);
    const configured = isConfigured(env);
    const liveTtl = Math.max(15, parseInt(env.LIVE_CACHE_SECONDS || '60', 10));

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
        return json({
          success: true,
          stats: {
            total: h.entries.length,
            won,
            lost,
            pending: count('pending'),
            void: count('void'),
            rate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
            byModel: (['claude', 'deepseek'] as const)
              .map((m) => {
                const mine = h.entries.filter((e) => e.model === m);
                const w = mine.filter((e) => e.result === 'won').length;
                const l = mine.filter((e) => e.result === 'lost').length;
                return { model: m, won: w, lost: l, rate: w + l > 0 ? Math.round((w / (w + l)) * 100) : null };
              })
              .filter((x) => x.won + x.lost > 0),
          },
          entries: h.entries.slice(0, 30),
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
