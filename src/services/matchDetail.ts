import { MatchEvent, MatchLineup, Player } from '../types';
import { mapApiEvent } from './apiFootball';

export interface StatRow {
  label: string;
  val: [number, number];
  unit: string;
}

export interface MatchDetail {
  events: MatchEvent[];
  stats: StatRow[];
  homeLineup: MatchLineup | null;
  awayLineup: MatchLineup | null;
}

const ROWS: Array<{ key: string; label: string; unit: string }> = [
  { key: 'Ball Possession', label: 'Possession', unit: '%' },
  { key: 'expected_goals', label: 'Expected Goals (xG)', unit: '' },
  { key: 'Shots on Goal', label: 'Tirs cadrés', unit: '' },
  { key: 'Total Shots', label: 'Total des tirs', unit: '' },
  { key: 'Corner Kicks', label: 'Corners', unit: '' },
  { key: 'Fouls', label: 'Fautes', unit: '' },
  { key: 'Offsides', label: 'Hors-jeux', unit: '' },
  { key: 'Yellow Cards', label: 'Cartons jaunes', unit: '' },
  { key: 'Red Cards', label: 'Cartons rouges', unit: '' },
  { key: 'Goalkeeper Saves', label: 'Arrêts du gardien', unit: '' },
  { key: 'Passes %', label: 'Passes réussies', unit: '%' },
];

const POS: Record<string, Player['position']> = { G: 'GK', D: 'DEF', M: 'MID', F: 'ATT' };

const num = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace('%', ''));
  return Number.isFinite(n) ? n : 0;
};

interface ApiLineup {
  teamId: number;
  formation?: string;
  coach?: string;
  startXI: Array<{ id: number; name: string; number: number; pos: string }>;
  subs: Array<{ id: number; name: string; number: number; pos: string }>;
}

function toLineup(l: ApiLineup | undefined): MatchLineup | null {
  if (!l || l.startXI.length === 0) return null;
  const player = (p: ApiLineup['startXI'][number]): Player => ({
    id: String(p.id),
    name: p.name,
    number: p.number ?? 0,
    position: POS[p.pos] ?? 'MID',
    rating: 0, // l'API ne fournit pas de note : le badge est masqué
  });
  return { formation: l.formation || '', coach: l.coach || '', startingXI: l.startXI.map(player), substitutes: l.subs.map(player) };
}

export async function fetchMatchDetail(matchId: string): Promise<MatchDetail | null> {
  try {
    const id = matchId.replace('apif-', '');
    const res = await fetch(`/api/fixtures/detail?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success || !json.data) return null;
    const d = json.data;

    const statsOf = (teamId: number): Record<string, unknown> =>
      d.statistics?.find((s: { teamId: number }) => s.teamId === teamId)?.stats ?? {};
    const home = statsOf(d.homeId);
    const away = statsOf(d.awayId);
    const stats: StatRow[] = ROWS.filter((r) => home[r.key] != null || away[r.key] != null).map((r) => ({
      label: r.label,
      unit: r.unit,
      val: [num(home[r.key]), num(away[r.key])],
    }));

    const events = (d.events ?? [])
      .map((ev: unknown, i: number) => mapApiEvent(ev, id, i, d.homeId))
      .filter((e: MatchEvent | null): e is MatchEvent => e !== null);

    return {
      events,
      stats,
      homeLineup: toLineup(d.lineups?.find((l: ApiLineup) => l.teamId === d.homeId)),
      awayLineup: toLineup(d.lineups?.find((l: ApiLineup) => l.teamId === d.awayId)),
    };
  } catch {
    return null;
  }
}
