import { Match, MatchStatus } from '../types';
import { toLocalISODate } from '../utils/date';

export interface ApiFootballStatus {
  configured: boolean;
  provider: 'api-sports' | 'rapidapi' | 'demo-simulation';
  baseUrl: string | null;
  message: string;
}

export async function checkApiFootballStatus(): Promise<ApiFootballStatus> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('API status unavailable');
    return await res.json();
  } catch {
    return {
      configured: false,
      provider: 'demo-simulation',
      baseUrl: null,
      message: 'Mode Démonstration & Simulation Active',
    };
  }
}

// Identifiants API-Football -> identifiants du catalogue de l'app (pour regrouper dans les bons championnats)
const CATALOGUE_LEAGUE_IDS: Record<number, string> = {
  2: 'ucl',
  3: 'ligue-europa',
  848: 'ligue-conference',
  4: 'euro',
  5: 'nations-league',
  61: 'ligue1',
  62: 'ligue2',
  39: 'premier-league',
  140: 'laliga',
  556: 'super-coupe-es',
  78: 'bundesliga',
  135: 'serie-a',
  304: 'uae-cup',
  480: 'jo-femmes',
};

const LIVE_CODES = ['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT'];

function mapStatus(short: string): MatchStatus {
  switch (short) {
    case 'HT': return 'HALF_TIME';
    case '1H': return 'LIVE_1H';
    case '2H':
    case 'LIVE':
    case 'BT': return 'LIVE_2H';
    case 'ET': return 'EXTRA_TIME';
    case 'P': return 'PENALTIES';
    case 'FT':
    case 'AET':
    case 'PEN': return 'FINISHED';
    case 'PST':
    case 'CANC':
    case 'ABD':
    case 'AWD':
    case 'WO': return 'POSTPONED';
    default: return 'SCHEDULED';
  }
}

// Transforme un match au format API-Football vers le format de l'app
export function mapApiFixture(item: any): Match {
  const fixture = item.fixture || {};
  const league = item.league || {};
  const teams = item.teams || {};
  const goals = item.goals || {};
  const status = fixture.status || {};
  const events = item.events || [];
  const isLive = LIVE_CODES.includes(status.short);

  return {
    id: `apif-${fixture.id}`,
    sportId: 'football',
    leagueId: CATALOGUE_LEAGUE_IDS[league.id] || String(league.id || 'general'),
    leagueName: league.name || 'Championnat',
    leagueCountry: league.country || 'Monde',
    leagueFlag: league.flag ? '🌐' : '⚽',
    round: league.round,
    homeTeam: {
      id: String(teams.home?.id || 'home'),
      name: teams.home?.name || 'Équipe 1',
      shortName: teams.home?.name ? teams.home.name.substring(0, 3).toUpperCase() : 'EQ1',
      logo: teams.home?.logo ? '⚽' : '🔴',
    },
    awayTeam: {
      id: String(teams.away?.id || 'away'),
      name: teams.away?.name || 'Équipe 2',
      shortName: teams.away?.name ? teams.away.name.substring(0, 3).toUpperCase() : 'EQ2',
      logo: teams.away?.logo ? '⚽' : '🔵',
    },
    score: {
      home: goals.home ?? 0,
      away: goals.away ?? 0,
    },
    status: mapStatus(status.short),
    minute: status.elapsed || 0,
    // Heure et date dans le fuseau horaire de l'appareil
    startTime: fixture.date
      ? new Date(fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '--:--',
    date: toLocalISODate(fixture.date ? new Date(fixture.date) : new Date()),
    isLive,
    stadium: fixture.venue?.name,
    referee: fixture.referee || undefined,
    events: events.map((ev: any, index: number) => ({
      id: `ev-${fixture.id}-${index}`,
      type: ev.type === 'Goal' ? 'GOAL' : ev.detail?.includes('Red Card') ? 'RED_CARD' : 'YELLOW_CARD',
      minute: ev.time?.elapsed || 0,
      team: ev.team?.id === teams.home?.id ? 'home' : 'away',
      playerName: ev.player?.name || 'Joueur',
      assistName: ev.assist?.name,
      detail: ev.detail,
    })),
    stats: {
      possession: [50, 50],
      xG: [1.2, 1.1],
      shotsOnTarget: [4, 4],
      totalShots: [10, 10],
      corners: [4, 4],
      fouls: [8, 8],
      offsides: [1, 1],
      yellowCards: [1, 1],
      redCards: [0, 0],
      saves: [3, 3],
    },
    homeLineup: { formation: '4-3-3', coach: '', startingXI: [], substitutes: [] },
    awayLineup: { formation: '4-3-3', coach: '', startingXI: [], substitutes: [] },
  };
}

export async function fetchLiveFixturesFromApi(): Promise<{ fromRealApi: boolean; matches: Match[] }> {
  try {
    const res = await fetch('/api/fixtures/live');
    if (!res.ok) throw new Error('Failed to fetch live fixtures');
    const json = await res.json();

    if (!json.fromRealApi || !json.data || !Array.isArray(json.data) || json.data.length === 0) {
      return { fromRealApi: false, matches: [] };
    }
    return { fromRealApi: true, matches: json.data.map(mapApiFixture) };
  } catch {
    return { fromRealApi: false, matches: [] };
  }
}

export interface DayFixturesResult {
  ok: boolean;
  matches: Match[];
  apiError?: string;
}

// Tous les matchs d'un jour (fuseau horaire de l'appareil)
export async function fetchFixturesByDate(date: string): Promise<DayFixturesResult> {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const res = await fetch(`/api/fixtures/date?date=${encodeURIComponent(date)}&tz=${encodeURIComponent(tz)}`);
    if (!res.ok) throw new Error('Failed to fetch fixtures');
    const json = await res.json();
    if (!json.success) return { ok: false, matches: [], apiError: json.error };
    if (json.apiError) return { ok: false, matches: [], apiError: String(json.apiError) };
    const data: unknown[] = Array.isArray(json.data) ? json.data : [];
    return { ok: true, matches: data.map(mapApiFixture) };
  } catch {
    return { ok: false, matches: [] };
  }
}
