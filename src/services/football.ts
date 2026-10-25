import { Match } from '../types';
import { mapApiFixture } from './apiFootball';

export interface AfricanLeague {
  id: number;
  name: string;
  country: string;
  code: string | null;
  continental: boolean;
  season: number;
}

export interface StatLine {
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
}
export interface TableRow {
  rank: number;
  team: { id: number; name: string };
  points: number;
  diff: number;
  form: string;
  desc: string;
  all: StatLine;
  home: StatLine;
  away: StatLine;
}
export interface TableGroup {
  name: string;
  rows: TableRow[];
}
export interface ScorerRow {
  player: { id: number; name: string };
  team: { id: number; name: string };
  goals: number;
  assists: number;
  games: number;
}
export interface LeagueData {
  configured: boolean;
  season?: string;
  info: { id: number; name: string; country: string; season: number } | null;
  groups: TableGroup[];
  scorers: ScorerRow[];
  apiError?: string;
}
export interface TeamInfo {
  id: number;
  name: string;
  country?: string;
  founded?: number;
  venue?: { name?: string; city?: string; capacity?: number };
}
export interface TeamData {
  configured: boolean;
  info: TeamInfo | null;
  last: Match[];
  next: Match[];
  apiError?: string;
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function friendly(raw: unknown): string | undefined {
  if (!raw) return undefined;
  const s = typeof raw === 'string' ? raw : JSON.stringify(raw);
  if (/limit|quota|requests/i.test(s)) return "Limite quotidienne de l'API atteinte (remise à zéro à 00h00 UTC).";
  if (/plan|subscription|season|access/i.test(s)) return "Ces données ne sont pas disponibles avec l'abonnement API actuel.";
  return s;
}

const AFRICA_CACHE = 'sa_africa_leagues_v1';

export async function fetchAfricanLeagues(): Promise<AfricanLeague[]> {
  try {
    const raw = localStorage.getItem(AFRICA_CACHE);
    if (raw) {
      const c = JSON.parse(raw) as { ts: number; data: AfricanLeague[] };
      if (Date.now() - c.ts < 6 * 3600e3 && c.data.length) return c.data;
    }
  } catch {
    /* ignoré */
  }
  const json = await getJson('/api/leagues/africa');
  const data: AfricanLeague[] = Array.isArray(json?.data) ? json.data : [];
  if (data.length) {
    try {
      localStorage.setItem(AFRICA_CACHE, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      /* ignoré */
    }
  }
  return data;
}

export async function fetchLeagueData(id: number, season?: number): Promise<LeagueData> {
  const json = await getJson(`/api/league?id=${id}${season ? `&season=${season}` : ''}`);
  if (!json?.success) return { configured: true, info: null, groups: [], scorers: [], apiError: 'Service indisponible pour le moment.' };
  if (json.fromRealApi === false) return { configured: false, info: null, groups: [], scorers: [] };
  return {
    configured: true,
    season: json.season,
    info: json.info ?? null,
    groups: Array.isArray(json.groups) ? json.groups : [],
    scorers: Array.isArray(json.scorers) ? json.scorers : [],
    apiError: friendly(json.apiError),
  };
}

export async function fetchLeagueFixtures(id: number, season?: number): Promise<{ matches: Match[]; configured: boolean; apiError?: string }> {
  const json = await getJson(`/api/league/fixtures?id=${id}${season ? `&season=${season}` : ''}&tz=${encodeURIComponent(tz())}`);
  if (!json?.success) return { matches: [], configured: true, apiError: 'Service indisponible pour le moment.' };
  if (json.fromRealApi === false) return { matches: [], configured: false };
  const data: unknown[] = Array.isArray(json.data) ? json.data : [];
  return { matches: data.map(mapApiFixture), configured: true, apiError: friendly(json.apiError) };
}

export async function fetchTeam(id: number): Promise<TeamData> {
  const json = await getJson(`/api/team?id=${id}&tz=${encodeURIComponent(tz())}`);
  if (!json?.success) return { configured: true, info: null, last: [], next: [], apiError: 'Service indisponible pour le moment.' };
  if (json.fromRealApi === false) return { configured: false, info: null, last: [], next: [] };
  return {
    configured: true,
    info: json.info ?? null,
    last: (Array.isArray(json.last) ? json.last : []).map(mapApiFixture),
    next: (Array.isArray(json.next) ? json.next : []).map(mapApiFixture),
    apiError: friendly(json.apiError),
  };
}

export async function fetchFixtureById(id: number): Promise<{ match: Match | null; apiError?: string }> {
  const json = await getJson(`/api/fixture?id=${id}`);
  if (!json?.success || !json.data) return { match: null, apiError: friendly(json?.apiError) };
  return { match: mapApiFixture(json.data) };
}

// Catalogue de l'app -> identifiants API-Football (pour ouvrir la bonne page championnat)
export const CATALOGUE_TO_API_ID: Record<string, number> = {
  ucl: 2, 'ligue-europa': 3, 'ligue-conference': 848, euro: 4, 'nations-league': 5, ligue1: 61, ligue2: 62,
  'premier-league': 39, laliga: 140, 'super-coupe-es': 556, bundesliga: 78, 'serie-a': 135, 'uae-cup': 304, 'jo-femmes': 480,
};

export const resolveLeagueApiId = (routeId: string): number | null => {
  if (CATALOGUE_TO_API_ID[routeId]) return CATALOGUE_TO_API_ID[routeId];
  const n = parseInt(routeId, 10);
  return Number.isInteger(n) && String(n) === routeId ? n : null;
};

// Logos hébergés par API-Sports (adresse prévisible) ; repli sur un emoji si l'image ne charge pas
export const teamLogoUrl = (id: string | number) => `https://media.api-sports.io/football/teams/${id}.png`;
export const leagueLogoUrl = (id: string | number) => `https://media.api-sports.io/football/leagues/${id}.png`;

export interface PlayerLine {
  id: number;
  name: string;
  number: number | null;
  pos: string;
  minutes: number;
  rating: number | null;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  shotsOn: number;
  keyPasses: number;
  yellow: number;
  red: number;
}
export interface TeamPlayers {
  teamId: number;
  players: PlayerLine[];
}

export async function fetchPlayers(fixtureId: number): Promise<{ teams: TeamPlayers[]; apiError?: string }> {
  const json = await getJson(`/api/fixture/players?id=${fixtureId}`);
  if (!json?.success) return { teams: [], apiError: 'Service indisponible pour le moment.' };
  return { teams: Array.isArray(json.teams) ? json.teams : [], apiError: friendly(json.apiError) };
}

export async function fetchH2H(homeId: number, awayId: number): Promise<{ matches: Match[]; apiError?: string }> {
  const json = await getJson(`/api/h2h?a=${homeId}&b=${awayId}&tz=${encodeURIComponent(tz())}`);
  if (!json?.success) return { matches: [], apiError: 'Service indisponible pour le moment.' };
  const data: unknown[] = Array.isArray(json.data) ? json.data : [];
  return { matches: data.map(mapApiFixture), apiError: friendly(json.apiError) };
}
