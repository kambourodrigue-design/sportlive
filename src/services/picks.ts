export interface AiPick {
  fixtureId: number;
  league: string;
  kickoff: string; // ISO
  home: string;
  away: string;
  percent: { home: number; draw: number; away: number };
  market: string;
  odds?: number; // meilleure cote relevée
  tier?: 'safe' | 'value'; // « Sûr » ou « Valeur »
  model?: string;
  confidence: number;
  reasoning: string;
}

export interface PicksResult {
  state: 'ok' | 'empty' | 'demo' | 'no-ai' | 'error' | 'auth' | 'subscription';
  picks: AiPick[];
}

const PICKS_CACHE_KEY = 'fsn_picks_cache_v1';

export function readCachedPicks(): PicksResult | null {
  try {
    const raw = localStorage.getItem(PICKS_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { ts: number; picks: AiPick[] };
    const fresh = Date.now() - c.ts < 12 * 3600e3 && c.picks.length > 0;
    return fresh ? { state: 'ok', picks: c.picks } : null;
  } catch {
    return null;
  }
}

export async function fetchPicks(): Promise<PicksResult> {
  try {
    const res = await fetch('/api/picks', { credentials: 'same-origin' });
    if (res.status === 401) return { state: 'auth', picks: [] };
    if (res.status === 402) return { state: 'subscription', picks: [] };
    if (!res.ok) throw new Error('picks unavailable');
    const json = await res.json();
    if (!json.success) return { state: 'error', picks: [] };
    if (!json.fromRealApi) return { state: 'demo', picks: [] };
    if (!json.aiConfigured) return { state: 'no-ai', picks: [] };
    const picks: AiPick[] = Array.isArray(json.picks) ? json.picks : [];
    if (picks.length) {
      try {
        localStorage.setItem(PICKS_CACHE_KEY, JSON.stringify({ ts: Date.now(), picks }));
      } catch {
        /* ignoré */
      }
    }
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
  reason?: 'status' | 'timeout';
}

export interface PeriodStats {
  won: number;
  lost: number;
  rate: number | null;
}

export interface VerifyInfo {
  lastCheck: string | null;
  error: string | null;
  apiConfigured: boolean;
}

export interface HistoryStats {
  total: number;
  won: number;
  lost: number;
  pending: number;
  void: number;
  rate: number | null; // % de réussite sur les pronostics réglés
  last7?: PeriodStats;
  last30?: PeriodStats;
  streak?: { type: 'won' | 'lost'; count: number } | null;
  form?: ('won' | 'lost')[];
  byModel?: { model: string; won: number; lost: number; rate: number | null }[];
  yield?: { bets: number; percent: number } | null; // rendement à mise égale
  byTier?: { tier: 'safe' | 'value'; won: number; lost: number; rate: number | null; yieldPct: number | null }[];
}

export async function fetchPicksHistory(): Promise<{ stats: HistoryStats; entries: HistoryEntry[]; updatedAt?: string; verify?: VerifyInfo } | null> {
  try {
    const res = await fetch('/api/picks/history', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    return { stats: json.stats, entries: Array.isArray(json.entries) ? json.entries : [], updatedAt: json.updatedAt, verify: json.verify };
  } catch {
    return null;
  }
}
