export type SportId = 'football' | 'tennis' | 'basketball' | 'rugby' | 'hockey' | 'handball';

export interface SportInfo {
  id: SportId;
  name: string;
  iconName: string;
  liveCount: number;
  totalCount: number;
}

export type MatchStatus =
  | 'SCHEDULED'
  | 'LIVE_1H'
  | 'HALF_TIME'
  | 'LIVE_2H'
  | 'EXTRA_TIME'
  | 'PENALTIES'
  | 'FINISHED'
  | 'POSTPONED';

export interface MatchEvent {
  id: string;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION' | 'VAR_CANCELLED' | 'PENALTY_MISSED';
  minute: number;
  team: 'home' | 'away';
  playerName: string;
  assistName?: string;
  detail?: string;
}

export interface MatchStats {
  possession: [number, number]; // [home, away] in %
  xG: [number, number];
  shotsOnTarget: [number, number];
  totalShots: [number, number];
  corners: [number, number];
  fouls: [number, number];
  offsides: [number, number];
  yellowCards: [number, number];
  redCards: [number, number];
  saves: [number, number];
}

export interface Player {
  id: string;
  name: string;
  number: number;
  position: 'GK' | 'DEF' | 'MID' | 'ATT';
  rating: number;
  isCaptain?: boolean;
}

export interface MatchLineup {
  formation: string; // e.g. "4-3-3"
  coach: string;
  startingXI: Player[];
  substitutes: Player[];
}

export interface PitchLiveState {
  ballPosition: { x: number; y: number }; // percentages 0-100
  phase: 'Attaque dangereuse' | 'Tir au but' | 'Contre-attaque' | 'Coup franc dangereux' | 'Corner' | 'Construction' | 'Arrêt du gardien';
  attackingTeam: 'home' | 'away';
}

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  rank?: number;
  form?: ('W' | 'D' | 'L')[];
}

export interface Match {
  id: string;
  sportId: SportId;
  leagueId: string;
  leagueName: string;
  leagueCountry: string;
  leagueFlag: string;
  round?: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  score: {
    home: number;
    away: number;
    htHome?: number;
    htAway?: number;
  };
  status: MatchStatus;
  minute: number;
  startTime: string; // e.g. "20:45"
  date: string; // e.g. "2026-10-08"
  isLive: boolean;
  hasRedCard?: {
    home: number;
    away: number;
  };
  events: MatchEvent[];
  stats: MatchStats;
  homeLineup: MatchLineup;
  awayLineup: MatchLineup;
  pitchLive?: PitchLiveState;
  stadium?: string;
  referee?: string;
  lastGoalHighlight?: {
    team: 'home' | 'away';
    minute: number;
    scorer: string;
    timestamp: number;
  };
  periodLabel?: string; // ex. « Q3 », « P2 » (autres sports)
}

export interface League {
  id: string;
  name: string;
  country: string;
  flag: string;
  isFavorite?: boolean;
  order: number;
}

export interface StandingRow {
  rank: number;
  team: string;
  logo: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export interface TopScorer {
  rank: number;
  player: string;
  team: string;
  goals: number;
  assists?: number;
  matchesPlayed?: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
  timeAgo: string;
  imageUrl: string;
  author: string;
  views: number;
  content: string[];
  sourceUrl?: string; // lien vers l'article d'origine
  sourceName?: string;
  publishedAt?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  vibrate: boolean;
  inAppToast: boolean;
  browserNotifications: boolean;
  events: {
    goals: boolean;
    redCards: boolean;
    kickoff: boolean;
    halfTime: boolean;
    fullTime: boolean;
    var: boolean;
  };
}

export interface NotificationItem {
  id: string;
  matchId: string;
  type: 'GOAL' | 'RED_CARD' | 'KICKOFF' | 'HALF_TIME' | 'FULL_TIME' | 'VAR';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  matchTitle: string;
}

export type MainNavTab = 'tous' | 'direct' | 'favoris' | 'actualites' | 'classements';
