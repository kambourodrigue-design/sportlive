export interface AiPick {
  fixtureId: number;
  league: string;
  kickoff: string; // ISO
  home: string;
  away: string;
  percent: { home: number; draw: number; away: number };
  market: string;
  confidence: number;
  reasoning: string;
}

export interface PicksResult {
  state: 'ok' | 'empty' | 'demo' | 'no-ai' | 'error';
  picks: AiPick[];
}

export async function fetchPicks(): Promise<PicksResult> {
  try {
    const res = await fetch('/api/picks');
    if (!res.ok) throw new Error('picks unavailable');
    const json = await res.json();
    if (!json.success) return { state: 'error', picks: [] };
    if (!json.fromRealApi) return { state: 'demo', picks: [] };
    if (!json.aiConfigured) return { state: 'no-ai', picks: [] };
    const picks: AiPick[] = Array.isArray(json.picks) ? json.picks : [];
    return { state: picks.length ? 'ok' : 'empty', picks };
  } catch {
    return { state: 'error', picks: [] };
  }
}

export interface HistoryEntry {
  fixtureId: number;
  kickoff: string;
  league: string;
  home: string;
  away: string;
  market: string;
  confidence: number;
  result: 'pending' | 'won' | 'lost' | 'void';
  score?: string;
}

export interface HistoryStats {
  total: number;
  won: number;
  lost: number;
  pending: number;
  void: number;
  rate: number | null; // % de réussite sur les pronostics réglés
}

export async function fetchPicksHistory(): Promise<{ stats: HistoryStats; entries: HistoryEntry[] } | null> {
  try {
    const res = await fetch('/api/picks/history');
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    return { stats: json.stats, entries: Array.isArray(json.entries) ? json.entries : [] };
  } catch {
    return null;
  }
}
