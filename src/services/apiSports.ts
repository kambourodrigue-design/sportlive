import { Match, MatchStatus, SportId } from '../types';
import { toLocalISODate } from '../utils/date';

// Autres sports (API-Sports) : basket. Le tennis n'est pas inclus dans cette offre (affiché « bientôt disponible »).
export const API_SPORTS: SportId[] = ['basketball'];

const EMOJI: Record<string, string> = { basketball: '🏀', tennis: '🎾' };

const LIVE_CODES = new Set(['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'BT', 'HT', 'P1', 'P2', 'P3', 'PT', 'H1', 'H2', 'ET', 'LIVE']);
const FINISHED_CODES = new Set(['FT', 'AOT', 'AET', 'AP']);
const POSTPONED_CODES = new Set(['POST', 'CANC', 'SUSP', 'INTR', 'ABD', 'AWD', 'WO']);

const PERIOD_LABEL: Record<string, string> = {
  Q1: 'Q1', Q2: 'Q2', Q3: 'Q3', Q4: 'Q4', OT: 'Prol.', BT: 'Pause',
  P1: 'P1', P2: 'P2', P3: 'P3', PT: 'T.A.B.', H1: '1re MT', H2: '2e MT', ET: 'Prol.', LIVE: 'Direct',
};

function mapStatus(code: string): MatchStatus {
  if (code === 'HT') return 'HALF_TIME';
  if (FINISHED_CODES.has(code)) return 'FINISHED';
  if (POSTPONED_CODES.has(code)) return 'POSTPONED';
  if (code === 'OT' || code === 'ET') return 'EXTRA_TIME';
  if (code === 'Q1' || code === 'Q2' || code === 'P1' || code === 'H1') return 'LIVE_1H';
  if (LIVE_CODES.has(code)) return 'LIVE_2H';
  return 'SCHEDULED';
}

interface ApiGame {
  id: number;
  date: string;
  status: string;
  league: { id: number; name: string };
  country?: string;
  home: { id: number; name: string };
  away: { id: number; name: string };
  homeScore: number | null;
  awayScore: number | null;
}

const zeros: [number, number] = [0, 0];

export function mapApiGame(g: ApiGame, sport: SportId): Match {
  const status = mapStatus(g.status);
  const isLive = LIVE_CODES.has(g.status);
  const emoji = EMOJI[sport] ?? '🏅';
  const team = (t: { id: number; name: string }) => ({
    id: String(t.id),
    name: t.name || 'Équipe',
    shortName: (t.name || 'EQ').substring(0, 3).toUpperCase(),
    logo: emoji,
  });
  return {
    id: `apis-${sport}-${g.id}`,
    sportId: sport,
    leagueId: `${sport}-${g.league?.id}`,
    leagueName: g.league?.name || 'Compétition',
    leagueCountry: g.country || 'Monde',
    leagueFlag: emoji,
    homeTeam: team(g.home),
    awayTeam: team(g.away),
    score: { home: g.homeScore ?? 0, away: g.awayScore ?? 0 },
    status,
    minute: 0,
    periodLabel: isLive ? PERIOD_LABEL[g.status] ?? 'Direct' : undefined,
    startTime: g.date ? new Date(g.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--',
    date: toLocalISODate(g.date ? new Date(g.date) : new Date()),
    isLive,
    events: [],
    stats: {
      possession: zeros, xG: [0, 0], shotsOnTarget: zeros, totalShots: zeros, corners: zeros, fouls: zeros,
      offsides: zeros, yellowCards: zeros, redCards: zeros, saves: zeros,
    },
    homeLineup: { formation: '', coach: '', startingXI: [], substitutes: [] },
    awayLineup: { formation: '', coach: '', startingXI: [], substitutes: [] },
  };
}

export async function fetchGamesByDate(
  sport: SportId,
  date: string,
): Promise<{ ok: boolean; matches: Match[]; apiError?: string }> {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const res = await fetch(
      `/api/games?sport=${encodeURIComponent(sport)}&date=${encodeURIComponent(date)}&tz=${encodeURIComponent(tz)}`,
    );
    if (!res.ok) throw new Error('games unavailable');
    const json = await res.json();
    if (!json.success) return { ok: false, matches: [], apiError: json.error };
    if (json.apiError) return { ok: false, matches: [], apiError: String(json.apiError) };
    const data: ApiGame[] = Array.isArray(json.data) ? json.data : [];
    return { ok: true, matches: data.map((g) => mapApiGame(g, sport)) };
  } catch {
    return { ok: false, matches: [] };
  }
}
