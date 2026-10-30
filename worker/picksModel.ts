// Modèle de pronostics : calcule des probabilités à partir de plusieurs sources (cotes des bookmakers, prédictions d'API-Football,
// modèle de Poisson sur les buts moyens), compare à la meilleure cote disponible et ne propose que les paris à valeur.
// L'IA ne choisit PAS librement : elle valide ou rejette parmi les paris présélectionnés ici.
// Ce fichier est volontairement sans dépendance (testable seul).

export const BETS = ['HOME_WIN', 'AWAY_WIN', 'DRAW', 'HOME_OR_DRAW', 'AWAY_OR_DRAW', 'OVER_1_5', 'OVER_2_5', 'UNDER_2_5', 'UNDER_3_5', 'BTTS_YES'] as const;
export type Bet = (typeof BETS)[number];

export type Probs = Partial<Record<Bet, number>>;

export interface OddsQuote {
  best: number; // meilleure cote parmi les bookmakers
  median: number;
  prob: number | null; // probabilité implicite médiane, marge retirée
  books: number; // nombre de bookmakers qui proposent ce pari
}
export type OddsMap = Partial<Record<Bet, OddsQuote>>;

export type Tier = 'safe' | 'value';

export interface ScoredBet {
  bet: Bet;
  tier?: Tier; // renseigné par shortlist()
  label: string;
  prob: number; // probabilité estimée (0 à 1)
  best: number | null;
  median: number | null;
  books: number;
  edge: number | null; // prob × meilleure cote − 1
  sources: string[];
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.').replace('%', ''));
  return Number.isFinite(n) ? n : NaN;
};

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------------------------------------------------------------------------
// Cotes : lecture de /odds?fixture=ID (plusieurs bookmakers)
// ---------------------------------------------------------------------------
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export function parseOdds(response: any[]): OddsMap {
  const books: any[] = response?.[0]?.bookmakers ?? [];
  const acc: Partial<Record<Bet, { odds: number[]; probs: number[] }>> = {};
  const push = (bet: Bet, odd: number, prob: number | null) => {
    if (!(odd > 1.01 && odd < 100)) return;
    const a = (acc[bet] ??= { odds: [], probs: [] });
    a.odds.push(odd);
    if (prob !== null && prob > 0 && prob < 1) a.probs.push(prob);
  };

  for (const bk of books) {
    for (const b of bk.bets ?? []) {
      const name = norm(b.name);
      const vals: { value: string; odd: number }[] = (b.values ?? []).map((v: any) => ({ value: norm(v.value), odd: num(v.odd) })).filter((v: any) => v.odd > 1);
      const find = (value: string) => vals.find((v) => v.value === value)?.odd;

      if (b.id === 1 || name === 'match winner') {
        const h = find('home');
        const d = find('draw');
        const a = find('away');
        if (h && d && a) {
          const sum = 1 / h + 1 / d + 1 / a;
          push('HOME_WIN', h, 1 / h / sum);
          push('DRAW', d, 1 / d / sum);
          push('AWAY_WIN', a, 1 / a / sum);
        }
      } else if (b.id === 12 || name === 'double chance') {
        const hd = find('home/draw');
        const da = find('draw/away');
        if (hd) push('HOME_OR_DRAW', hd, null);
        if (da) push('AWAY_OR_DRAW', da, null);
      } else if (b.id === 5 || name === 'goals over/under') {
        for (const line of ['1.5', '2.5', '3.5']) {
          const over = find(`over ${line}`);
          const under = find(`under ${line}`);
          if (!over || !under) continue;
          const sum = 1 / over + 1 / under;
          if (line === '1.5') push('OVER_1_5', over, 1 / over / sum);
          if (line === '2.5') {
            push('OVER_2_5', over, 1 / over / sum);
            push('UNDER_2_5', under, 1 / under / sum);
          }
          if (line === '3.5') push('UNDER_3_5', under, 1 / under / sum);
        }
      } else if (b.id === 8 || name === 'both teams score') {
        const yes = find('yes');
        const no = find('no');
        if (yes && no) push('BTTS_YES', yes, 1 / yes / (1 / yes + 1 / no));
      }
    }
  }

  const out: OddsMap = {};
  for (const bet of BETS) {
    const a = acc[bet];
    if (!a || a.odds.length === 0) continue;
    out[bet] = { best: Math.max(...a.odds), median: median(a.odds), prob: a.probs.length ? median(a.probs) : null, books: a.odds.length };
  }
  // Double chance : si les bookmakers ne la proposent pas, on déduit la probabilité du 1N2 (la cote reste inconnue)
  return out;
}

// ---------------------------------------------------------------------------
// Modèle de Poisson (buts moyens marqués / encaissés, domicile / extérieur)
// ---------------------------------------------------------------------------
export function poissonLambdas(teams: any): { lh: number; la: number } | null {
  const g = (side: 'home' | 'away', dir: 'for' | 'against', where: 'home' | 'away') => num(teams?.[side]?.league?.goals?.[dir]?.average?.[where]);
  const forH = g('home', 'for', 'home');
  const agaH = g('home', 'against', 'home');
  const forA = g('away', 'for', 'away');
  const agaA = g('away', 'against', 'away');
  if (![forH, agaH, forA, agaA].every((x) => Number.isFinite(x) && x >= 0)) return null;
  if (forH + agaH + forA + agaA < 0.5) return null; // début de saison : moyennes à zéro
  const lh = (forH + agaA) / 2;
  const la = (forA + agaH) / 2;
  return lh > 0.2 && la > 0.2 ? { lh, la } : null;
}

export function poissonProbs(lh: number, la: number): Probs {
  const N = 11;
  const pmf = (l: number) => {
    const out = [Math.exp(-l)];
    for (let k = 1; k < N; k++) out.push((out[k - 1] * l) / k);
    return out;
  };
  const ph = pmf(lh);
  const pa = pmf(la);
  let home = 0;
  let draw = 0;
  let away = 0;
  const total = new Array(2 * N).fill(0);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const p = ph[i] * pa[j];
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
      total[i + j] += p;
    }
  }
  const s = home + draw + away;
  home /= s;
  draw /= s;
  away /= s;
  const upTo = (k: number) => total.slice(0, k + 1).reduce((a, b) => a + b, 0) / s;
  return {
    HOME_WIN: home,
    DRAW: draw,
    AWAY_WIN: away,
    HOME_OR_DRAW: home + draw,
    AWAY_OR_DRAW: away + draw,
    OVER_1_5: 1 - upTo(1),
    OVER_2_5: 1 - upTo(2),
    UNDER_2_5: upTo(2),
    UNDER_3_5: upTo(3),
    BTTS_YES: (1 - Math.exp(-lh)) * (1 - Math.exp(-la)),
  };
}

// Prédictions d'API-Football (pourcentages 1N2)
export function apiProbs(percent: { home: number; draw: number; away: number }): Probs {
  const sum = percent.home + percent.draw + percent.away;
  if (!(sum > 0)) return {};
  const h = percent.home / sum;
  const d = percent.draw / sum;
  const a = percent.away / sum;
  return { HOME_WIN: h, DRAW: d, AWAY_WIN: a, HOME_OR_DRAW: h + d, AWAY_OR_DRAW: a + d };
}

// ---------------------------------------------------------------------------
// Fusion des sources et calcul de la valeur
// ---------------------------------------------------------------------------
const WEIGHTS = { market: 3, api: 1.5, poisson: 1 };
const MAX_PROB = 0.93; // aucun pari n'est « sûr » : on plafonne

export function betLabel(bet: Bet, home: string, away: string): string {
  switch (bet) {
    case 'HOME_WIN': return `Victoire de ${home}`;
    case 'AWAY_WIN': return `Victoire de ${away}`;
    case 'DRAW': return 'Match nul';
    case 'HOME_OR_DRAW': return `${home} ne perd pas (1N)`;
    case 'AWAY_OR_DRAW': return `${away} ne perd pas (N2)`;
    case 'OVER_1_5': return 'Plus de 1,5 buts';
    case 'OVER_2_5': return 'Plus de 2,5 buts';
    case 'UNDER_2_5': return 'Moins de 2,5 buts';
    case 'UNDER_3_5': return 'Moins de 3,5 buts';
    case 'BTTS_YES': return 'Les deux équipes marquent';
  }
}

export interface ScoreInput {
  home: string;
  away: string;
  api: Probs;
  poisson: Probs | null;
  odds: OddsMap;
}

export function scoreBets(input: ScoreInput): ScoredBet[] {
  const out: ScoredBet[] = [];
  for (const bet of BETS) {
    const parts: { p: number; w: number; src: string }[] = [];
    const q = input.odds[bet];
    // Probabilité du marché : directe, ou déduite du 1N2 pour la double chance
    let market = q?.prob ?? null;
    if (market === null && (bet === 'HOME_OR_DRAW' || bet === 'AWAY_OR_DRAW')) {
      const h = input.odds.HOME_WIN?.prob;
      const d = input.odds.DRAW?.prob;
      const a = input.odds.AWAY_WIN?.prob;
      if (bet === 'HOME_OR_DRAW' && h != null && d != null) market = h + d;
      if (bet === 'AWAY_OR_DRAW' && a != null && d != null) market = a + d;
    }
    const books = Math.max(q?.books ?? 0, bet === 'HOME_OR_DRAW' || bet === 'AWAY_OR_DRAW' ? input.odds.HOME_WIN?.books ?? 0 : 0);
    if (market !== null && books >= 2) parts.push({ p: market, w: WEIGHTS.market, src: 'marché' });
    const a = input.api[bet];
    if (a !== undefined) parts.push({ p: a, w: WEIGHTS.api, src: 'API-Football' });
    const po = input.poisson?.[bet];
    if (po !== undefined) parts.push({ p: po, w: WEIGHTS.poisson, src: 'buts moyens' });
    if (parts.length === 0) continue;

    const w = parts.reduce((s, x) => s + x.w, 0);
    const prob = Math.min(MAX_PROB, parts.reduce((s, x) => s + x.p * x.w, 0) / w);
    const best = q?.best ?? null;
    out.push({
      bet,
      label: betLabel(bet, input.home, input.away),
      prob,
      best,
      median: q?.median ?? null,
      books: q?.books ?? 0,
      edge: best !== null ? prob * best - 1 : null,
      sources: parts.map((x) => x.src),
    });
  }
  return out;
}

export interface TierRules {
  minConfidence: number; // en points (80 = 80 %)
  minOdds: number;
  minEdge: number; // 0.03 = 3 % de valeur
}
export interface PickConfig {
  safe: TierRules; // « Sûr » : très probable, cote modeste
  value: TierRules; // « Valeur » : moins probable, meilleure cote
  maxSafe: number;
  maxValue: number;
}

const meets = (s: ScoredBet, r: TierRules, slack: number) =>
  s.best !== null &&
  s.edge !== null &&
  s.books >= 2 &&
  s.prob * 100 >= r.minConfidence - slack && // petite marge : la confiance finale est revérifiée après l'IA
  s.best >= r.minOdds &&
  s.edge >= r.minEdge;

// Paris présélectionnés pour un match, classés par niveau puis par valeur. Au plus 2 par match.
export function shortlist(scored: ScoredBet[], cfg: PickConfig): ScoredBet[] {
  const out: ScoredBet[] = [];
  for (const s of scored) {
    if (meets(s, cfg.safe, 3)) out.push({ ...s, tier: 'safe' });
    else if (meets(s, cfg.value, 3)) out.push({ ...s, tier: 'value' });
  }
  return out.sort((a, b) => (a.tier === b.tier ? b.edge! - a.edge! : a.tier === 'safe' ? -1 : 1)).slice(0, 2);
}

// ---------------------------------------------------------------------------
// Consigne donnée à l'IA (DeepSeek et Claude)
// ---------------------------------------------------------------------------
export function buildSystemPrompt(cfg: PickConfig): string {
  const pc = (n: number) => Math.round(n);
  return [
    "Tu es un analyste football professionnel, prudent, rigoureux et honnête. Tu valides des pronostics pour un site francophone.",
    "",
    "CONTEXTE : un modèle statistique a déjà calculé, pour chaque match, la probabilité de plusieurs paris en croisant les cotes des bookmakers (marge retirée), les prédictions d'API-Football et un modèle de Poisson sur les buts moyens. Il a aussi relevé la meilleure cote disponible et la « valeur » (probabilité × cote − 1). Seuls les paris à valeur positive te sont transmis, dans le champ options de chaque match.",
    "",
    "DEUX NIVEAUX DE PARIS (champ tier de chaque option) :",
    `- « safe » (Sûr) : très probable (probabilité d'au moins ${pc(cfg.safe.minConfidence)} %), cote modeste. Exigence maximale.`,
    `- « value » (Valeur) : moins probable (au moins ${pc(cfg.value.minConfidence)} %) mais mieux payé (cote d'au moins ${cfg.value.minOdds}). Plus risqué par nature : sois encore plus attentif aux absents, à la forme et à l'enjeu.`,
    "",
    "TON TRAVAIL : un contrôle qualitatif, que les chiffres ne font pas. Pour chaque match, croise les options avec le contexte fourni (forme récente, buts moyens, face-à-face, classement et enjeu, blessés et suspendus, nombre de bookmakers) et décide si le pari est réellement solide.",
    "",
    "RÈGLES STRICTES",
    `1. Choisis au maximum ${cfg.maxSafe} paris « safe » et ${cfg.maxValue} paris « value », au plus UN par match, UNIQUEMENT parmi les options fournies : le couple fixtureId + bet doit correspondre exactement à une option. N'invente aucun pari, aucune cote.`,
    "2. Refuse un pari (ne le retiens pas) si : un joueur clé de l'équipe visée est absent ; la forme récente contredit nettement la probabilité ; l'enjeu semble faible (rotation probable, match sans enjeu) ; très peu de données (moyennes à zéro, 0 match de championnat, 2 bookmakers seulement) ; la probabilité repose sur une seule source qui diverge fortement des autres.",
    "3. Un match nul ou un pari « les deux équipes marquent » est fragile : ne le retiens que si tout converge.",
    `4. La confiance est un entier de 0 à 100. Elle ne peut JAMAIS dépasser la probabilité de l'option. Baisse-la d'autant plus que tu as des doutes. Si ta confiance est inférieure à ${pc(cfg.safe.minConfidence)} pour un pari « safe », ou à ${pc(cfg.value.minConfidence)} pour un pari « value », ne retiens pas le pari.`,
    "5. Il vaut mieux 0 ou 1 pronostic solide que plusieurs pronostics moyens. Si rien n'est assez fiable, réponds avec une liste vide.",
    "6. N'invente aucune statistique, aucun blessé, aucun résultat : appuie-toi uniquement sur les données fournies. Si une information manque, ne la mentionne pas.",
    "7. reasoning : 2 phrases courtes maximum, en français, avec des chiffres tirés des données (forme, buts moyens, cote, classement, absents).",
    "",
    "LEXIQUE DES DONNÉES : probability = probabilité estimée en % ; bestOdds = meilleure cote ; medianOdds = cote médiane ; edgePct = valeur en % ; bookmakers = nombre de bookmakers ; goalsAvg = buts marqués/encaissés par match (équipe à domicile à domicile, visiteur à l'extérieur) ; form5 = 5 derniers matchs (W victoire, D nul, L défaite) ; h2h = bilan des confrontations récentes ; rank = classement ; injuries = absents.",
    "",
    'FORMAT : réponds UNIQUEMENT avec du JSON valide : {"picks":[{"fixtureId":number,"bet":string,"confidence":number,"reasoning":string}]}',
  ].join("\n");
}
