import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Match, MatchEvent, MatchLineup } from '../types';
import { Link, goBack, leagueUrl, teamUrl } from '../router';
import { useMatchDetail } from '../hooks/useMatchDetail';
import { Logo } from '../components/Logo';
import { PageHeader, SectionBand, TabBar } from '../components/DetailChrome';
import { ShareButton } from '../components/ShareButton';
import { FixtureList } from '../components/FixtureList';
import { StandingsTable, buildRows } from '../components/StandingsTable';
import { PitchTracker } from '../components/PitchTracker';
import {
  LeagueData,
  TeamPlayers,
  fetchFixtureById,
  fetchH2H,
  fetchLeagueData,
  fetchPlayers,
  fetchTeam,
  resolveLeagueApiId,
  teamLogoUrl,
} from '../services/football';
import { frCountry } from '../utils/africa';

type TabId = 'terrain' | 'resume' | 'stats' | 'compos' | 'joueurs' | 'h2h' | 'classement';

interface MatchPageProps {
  routeId: string;
  matches: Match[]; // matchs déjà connus de l'app (direct + jour)
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onSimulateGoal: (id: string) => void;
}

const DETAIL_FR: Record<string, string> = {
  'Normal Goal': 'But',
  'Own Goal': 'But contre son camp',
  Penalty: 'But sur penalty',
  'Missed Penalty': 'Penalty manqué',
  'Yellow Card': 'Carton jaune',
  'Red Card': 'Carton rouge',
  'Second Yellow card': 'Second carton jaune',
  'Goal cancelled': 'But annulé',
};

const frRound = (r?: string) => {
  if (!r) return '';
  const m = /Regular Season - (\d+)/i.exec(r);
  return m ? `Journée ${m[1]}` : r.replace(/Group Stage/i, 'Phase de groupes').replace(/Round of (\d+)/i, '$1es de finale').replace(/Quarter-finals/i, 'Quarts de finale').replace(/Semi-finals/i, 'Demi-finales').replace(/^Final$/i, 'Finale');
};

const dateTime = (m: Match) => {
  const [y, mo, d] = m.date.split('-');
  return `${d}.${mo}.${y} ${m.startTime}`;
};

const statusLabel = (m: Match): string => {
  if (m.status === 'HALF_TIME') return 'Mi-temps';
  if (m.status === 'EXTRA_TIME') return 'Prolongations';
  if (m.status === 'PENALTIES') return 'Tirs au but';
  if (m.isLive) return `${m.minute}'`;
  if (m.status === 'FINISHED') return 'Terminé';
  if (m.status === 'POSTPONED') return 'Reporté';
  return '';
};

const eventSort = (a: MatchEvent, b: MatchEvent) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0);

// ---------- Résumé ----------
const EventIcon: React.FC<{ e: MatchEvent }> = ({ e }) => {
  switch (e.type) {
    case 'GOAL':
      return <span className="text-base leading-none" aria-label="But">⚽</span>;
    case 'YELLOW_CARD':
      return <span className="w-3 h-4 rounded-[2px] bg-amber-400 inline-block" aria-label="Carton jaune" />;
    case 'RED_CARD':
      return <span className="w-3 h-4 rounded-[2px] bg-red-600 inline-block" aria-label="Carton rouge" />;
    case 'SUBSTITUTION':
      return <span className="text-sm font-black text-emerald-500 leading-none" aria-label="Remplacement">⇄</span>;
    case 'VAR_CANCELLED':
      return <span className="text-[10px] font-black text-indigo-400" aria-label="VAR">VAR</span>;
    default:
      return <span className="text-sm leading-none" aria-label="Penalty manqué">✖</span>;
  }
};

const EventBody: React.FC<{ e: MatchEvent; align: 'left' | 'right' }> = ({ e, align }) => {
  const sub = e.type === 'SUBSTITUTION';
  const fr = e.detail ? DETAIL_FR[e.detail] ?? (e.detail.startsWith('Substitution') ? 'Remplacement' : e.detail) : '';
  return (
    <div className={`flex items-center gap-2 min-w-0 ${align === 'right' ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
      <EventIcon e={e} />
      <div className={`min-w-0 ${align === 'right' ? 'text-right' : 'text-left'}`}>
        {sub ? (
          <>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              <span className="text-emerald-500" aria-hidden="true">↑</span> {e.assistName ?? '—'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="text-fuchsia-500" aria-hidden="true">↓</span> {e.playerName}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{e.playerName}</p>
            {(e.assistName || (fr && fr !== 'But' && fr !== 'Carton jaune')) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {e.type === 'GOAL' && e.assistName ? `Passe : ${e.assistName}` : fr}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const EventRow: React.FC<{ e: MatchEvent }> = ({ e }) => (
  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-white/5">
    <div>{e.team === 'home' && <EventBody e={e} align="right" />}</div>
    <span className="w-12 text-center text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
      {e.minute}
      {e.extra ? `+${e.extra}` : ''}'
    </span>
    <div>{e.team === 'away' && <EventBody e={e} align="left" />}</div>
  </div>
);

const goalsOf = (events: MatchEvent[]): [number, number] => [
  events.filter((e) => e.type === 'GOAL' && e.team === 'home').length,
  events.filter((e) => e.type === 'GOAL' && e.team === 'away').length,
];

const Summary: React.FC<{ match: Match; events: MatchEvent[]; loading: boolean }> = ({ match, events, loading }) => {
  const sorted = [...events].sort(eventSort);
  const first = sorted.filter((e) => e.minute <= 45);
  const second = sorted.filter((e) => e.minute > 45 && e.minute <= 90);
  const extra = sorted.filter((e) => e.minute > 90);
  // Score de chaque période : affiché seulement s'il est cohérent avec le score final (évite d'afficher un chiffre faux)
  const [h1h, h1a] = goalsOf(first);
  const [h2h, h2a] = goalsOf(second);
  const [heh, hea] = goalsOf(extra);
  const consistent = h1h + h2h + heh === match.score.home && h1a + h2a + hea === match.score.away;
  const band = (h: number, a: number) => (consistent ? `${h} - ${a}` : undefined);

  if (match.status === 'SCHEDULED' || match.status === 'POSTPONED') {
    return <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{match.status === 'POSTPONED' ? 'Ce match est reporté.' : "Le match n'a pas encore commencé."}</p>;
  }
  if (sorted.length === 0) {
    return (
      <div>
        <SectionBand title="1. Mi-temps" right={band(0, 0)} />
        <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">{loading ? 'Chargement...' : 'Aucun événement pour le moment.'}</p>
      </div>
    );
  }
  return (
    <div>
      <SectionBand title="1. Mi-temps" right={band(h1h, h1a)} />
      {first.length ? first.map((e) => <EventRow key={e.id} e={e} />) : <p className="px-4 py-4 text-center text-xs text-slate-400">–</p>}
      {(second.length > 0 || match.minute > 45 || match.status === 'FINISHED') && (
        <>
          <SectionBand title="2. Mi-temps" right={band(h2h, h2a)} />
          {second.length ? second.map((e) => <EventRow key={e.id} e={e} />) : <p className="px-4 py-4 text-center text-xs text-slate-400">–</p>}
        </>
      )}
      {extra.length > 0 && (
        <>
          <SectionBand title="Prolongations" right={band(heh, hea)} />
          {extra.map((e) => <EventRow key={e.id} e={e} />)}
        </>
      )}
    </div>
  );
};

// ---------- Statistiques ----------
interface StatRowData {
  label: string;
  val: [number, number];
  unit: string;
}

const StatsTab: React.FC<{ rows: StatRowData[]; loading: boolean }> = ({ rows, loading }) => {
  if (rows.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{loading ? 'Chargement des statistiques...' : 'Statistiques pas encore disponibles pour ce match.'}</p>;
  }
  return (
    <div>
      <SectionBand title="Statistiques du match" />
      <div className="px-4 py-2 divide-y divide-slate-100 dark:divide-white/5">
        {rows.map((r) => {
          const [h, a] = r.val;
          const total = h + a || 1;
          return (
            <div key={r.label} className="py-3">
              <div className="flex items-center justify-between text-sm">
                <span className={`w-16 font-black tabular-nums ${h > a ? 'text-accent-600 dark:text-cyan-300' : 'text-slate-700 dark:text-slate-300'}`}>{h}{r.unit}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-center">{r.label}</span>
                <span className={`w-16 text-right font-black tabular-nums ${a > h ? 'text-accent-600 dark:text-cyan-300' : 'text-slate-700 dark:text-slate-300'}`}>{a}{r.unit}</span>
              </div>
              <div className="mt-2 flex gap-1.5" aria-hidden="true">
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex justify-end">
                  <div className={`h-full rounded-full ${h >= a ? 'bg-gradient-to-l from-accent-500 to-cyan-400' : 'bg-slate-400/70'}`} style={{ width: `${(h / total) * 100}%` }} />
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full ${a >= h ? 'bg-gradient-to-r from-accent-500 to-cyan-400' : 'bg-slate-400/70'}`} style={{ width: `${(a / total) * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- Compositions ----------
const POS_FR: Record<string, string> = { GK: 'G', DEF: 'D', MID: 'M', ATT: 'A' };

const LineupColumn: React.FC<{ name: string; lineup: MatchLineup }> = ({ name, lineup }) => (
  <div>
    <SectionBand title={name} right={lineup.formation || undefined} />
    {lineup.coach && <p className="px-4 pt-3 text-xs text-slate-500 dark:text-slate-400">Entraîneur : <strong className="text-slate-800 dark:text-slate-200">{lineup.coach}</strong></p>}
    <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Titulaires</p>
    <ul>
      {lineup.startingXI.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 dark:border-white/5 text-sm">
          <span className="w-6 text-right font-mono font-bold text-slate-400 tabular-nums">{p.number || ''}</span>
          <span className="flex-1 min-w-0 truncate font-medium text-slate-900 dark:text-slate-100">{p.name}</span>
          <span className="text-[11px] font-bold text-slate-400">{POS_FR[p.position]}</span>
          {p.rating > 0 && <span className="text-[11px] font-bold px-1.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 tabular-nums">{p.rating}</span>}
        </li>
      ))}
    </ul>
    {lineup.substitutes.length > 0 && (
      <>
        <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Remplaçants</p>
        <ul>
          {lineup.substitutes.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 dark:border-white/5 text-sm">
              <span className="w-6 text-right font-mono font-bold text-slate-400 tabular-nums">{p.number || ''}</span>
              <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-300">{p.name}</span>
              <span className="text-[11px] font-bold text-slate-400">{POS_FR[p.position]}</span>
            </li>
          ))}
        </ul>
      </>
    )}
  </div>
);

// ---------- Stats joueurs ----------
const PlayersTab: React.FC<{ match: Match; data: { teams: TeamPlayers[]; apiError?: string } | null }> = ({ match, data }) => {
  if (!data) return <p className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500" role="status"><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</p>;
  const sides = [
    { team: match.homeTeam, players: data.teams.find((t) => String(t.teamId) === match.homeTeam.id)?.players ?? [] },
    { team: match.awayTeam, players: data.teams.find((t) => String(t.teamId) === match.awayTeam.id)?.players ?? [] },
  ];
  if (sides.every((s) => s.players.length === 0)) {
    return <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{data.apiError ?? 'Les statistiques des joueurs ne sont pas encore disponibles.'}</p>;
  }
  return (
    <div>
      {sides.map(({ team, players }) => (
        <section key={team.id}>
          <SectionBand title={team.name} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-white/10">
                  <th className="py-2 pl-4 pr-2 text-left">Joueur</th>
                  <th className="py-2 px-1.5 text-center" title="Note">Note</th>
                  <th className="py-2 px-1.5 text-center" title="Minutes jouées">Min</th>
                  <th className="py-2 px-1.5 text-center" title="Buts">B</th>
                  <th className="py-2 px-1.5 text-center" title="Passes décisives">PD</th>
                  <th className="py-2 px-1.5 text-center hidden sm:table-cell" title="Tirs (cadrés)">Tirs</th>
                  <th className="py-2 px-1.5 text-center hidden sm:table-cell" title="Passes clés">PC</th>
                  <th className="py-2 pl-1.5 pr-4 text-center" title="Cartons">Cart.</th>
                </tr>
              </thead>
              <tbody>
                {[...players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-2.5 pl-4 pr-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{p.name}</span>
                      <span className="ml-1.5 text-[11px] text-slate-400">{p.number ?? ''}</span>
                    </td>
                    <td className="py-2.5 px-1.5 text-center">
                      {p.rating !== null && (
                        <span className={`inline-block min-w-8 px-1.5 rounded text-xs font-black tabular-nums ${p.rating >= 7.5 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : p.rating >= 6.5 ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300' : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'}`}>
                          {p.rating.toFixed(1)}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-1.5 text-center tabular-nums">{p.minutes}'</td>
                    <td className="py-2.5 px-1.5 text-center tabular-nums font-bold">{p.goals || '–'}</td>
                    <td className="py-2.5 px-1.5 text-center tabular-nums">{p.assists || '–'}</td>
                    <td className="py-2.5 px-1.5 text-center tabular-nums hidden sm:table-cell">{p.shots ? `${p.shots} (${p.shotsOn})` : '–'}</td>
                    <td className="py-2.5 px-1.5 text-center tabular-nums hidden sm:table-cell">{p.keyPasses || '–'}</td>
                    <td className="py-2.5 pl-1.5 pr-4">
                      <span className="flex justify-center gap-1">
                        {p.yellow > 0 && <span className="w-2.5 h-3.5 rounded-[2px] bg-amber-400" aria-label="Carton jaune" />}
                        {p.red > 0 && <span className="w-2.5 h-3.5 rounded-[2px] bg-red-600" aria-label="Carton rouge" />}
                        {!p.yellow && !p.red && <span className="text-slate-400">–</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
};

// ---------- Face-à-face ----------
interface H2HData {
  h2h: Match[];
  homeLast: Match[];
  awayLast: Match[];
  apiError?: string;
}

const H2HTab: React.FC<{ match: Match; data: H2HData | null }> = ({ match, data }) => {
  if (!data) return <p className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500" role="status"><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</p>;
  const finished = data.h2h.filter((m) => m.status === 'FINISHED');
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  finished.forEach((m) => {
    if (m.score.home === m.score.away) draws++;
    else {
      const winner = m.score.home > m.score.away ? m.homeTeam.id : m.awayTeam.id;
      if (winner === match.homeTeam.id) homeWins++;
      else awayWins++;
    }
  });
  const nothing = data.h2h.length === 0 && data.homeLast.length === 0 && data.awayLast.length === 0;
  if (nothing) return <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{data.apiError ?? 'Aucune donnée disponible.'}</p>;
  return (
    <div>
      <SectionBand title="Face-à-face" />
      {finished.length > 0 && (
        <div className="grid grid-cols-3 text-center px-4 py-3 border-b border-slate-100 dark:border-white/5">
          <div><p className="text-2xl font-black text-accent-600 dark:text-cyan-300 tabular-nums">{homeWins}</p><p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Victoires {match.homeTeam.name}</p></div>
          <div><p className="text-2xl font-black text-slate-700 dark:text-slate-200 tabular-nums">{draws}</p><p className="text-[11px] text-slate-500 dark:text-slate-400">Nuls</p></div>
          <div><p className="text-2xl font-black text-accent-600 dark:text-cyan-300 tabular-nums">{awayWins}</p><p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Victoires {match.awayTeam.name}</p></div>
        </div>
      )}
      <FixtureList matches={data.h2h} order="desc" showLeague emptyText="Aucune confrontation récente." />
      <SectionBand title={`Derniers matchs : ${match.homeTeam.name}`} />
      <FixtureList matches={data.homeLast} order="desc" showLeague emptyText="Aucun match récent." />
      <SectionBand title={`Derniers matchs : ${match.awayTeam.name}`} />
      <FixtureList matches={data.awayLast} order="desc" showLeague emptyText="Aucun match récent." />
    </div>
  );
};

// ---------- Page ----------
export const MatchPage: React.FC<MatchPageProps> = ({ routeId, matches, isFavorite, onToggleFavorite, onSimulateGoal }) => {
  const known = matches.find((m) => m.id === routeId) ?? null;
  const [fetched, setFetched] = useState<Match | null>(null);
  const [state, setState] = useState<'loading' | 'done'>('loading');
  const [error, setError] = useState<string | undefined>();
  const [tab, setTab] = useState<TabId>('resume');
  const [players, setPlayers] = useState<{ teams: TeamPlayers[]; apiError?: string } | null>(null);
  const [h2h, setH2h] = useState<H2HData | null>(null);
  const [standings, setStandings] = useState<LeagueData | null>(null);

  // Lien direct ou rechargement : le match n'est pas encore dans la liste, on le demande à l'API
  useEffect(() => {
    setFetched(null);
    setError(undefined);
    setTab('resume');
    setPlayers(null);
    setH2h(null);
    setStandings(null);
    const m = /^apif-(\d+)$/.exec(routeId);
    if (!m) {
      setState('done');
      return;
    }
    setState('loading');
    let alive = true;
    fetchFixtureById(parseInt(m[1], 10)).then((r) => {
      if (!alive) return;
      setFetched(r.match);
      setError(r.apiError);
      setState('done');
    });
    return () => {
      alive = false;
    };
  }, [routeId]);

  const match = known ?? fetched;
  const isReal = !!match && match.id.startsWith('apif-');
  const detail = useMatchDetail(isReal && match ? match.id : null, isReal && match?.isLive ? 120000 : null);

  // Données des onglets chargées à l'ouverture de l'onglet
  useEffect(() => {
    if (!match || !isReal) return;
    let alive = true;
    const hid = parseInt(match.homeTeam.id, 10);
    const aid = parseInt(match.awayTeam.id, 10);
    if (tab === 'joueurs' && players === null) {
      fetchPlayers(parseInt(match.id.replace('apif-', ''), 10)).then((r) => alive && setPlayers(r));
    }
    if (tab === 'h2h' && h2h === null && hid && aid) {
      Promise.all([fetchH2H(hid, aid), fetchTeam(hid), fetchTeam(aid)]).then(([x, h, a]) => {
        if (alive) setH2h({ h2h: x.matches, homeLast: h.last, awayLast: a.last, apiError: x.apiError ?? h.apiError });
      });
    }
    if (tab === 'classement' && standings === null) {
      const lid = resolveLeagueApiId(match.leagueId);
      if (lid) fetchLeagueData(lid).then((r) => alive && setStandings(r));
      else setStandings({ configured: true, info: null, groups: [], scorers: [] });
    }
    return () => {
      alive = false;
    };
  }, [tab, match?.id, isReal]);

  useEffect(() => {
    document.title = match ? `${match.homeTeam.name} - ${match.awayTeam.name} : score, stats et compositions - ScoreAfrica` : 'Match - ScoreAfrica';
  }, [match?.homeTeam.name, match?.awayTeam.name]);

  const data = useMemo(() => {
    if (!match) return null;
    const real = isReal;
    const emptyLineup: MatchLineup = { formation: '', coach: '', startingXI: [], substitutes: [] };
    const events = real && detail.data && detail.data.events.length > 0 ? detail.data.events : match.events;
    const stats: StatRowData[] = real
      ? detail.data?.stats ?? []
      : [
          { label: 'Possession', val: match.stats.possession, unit: '%' },
          { label: 'Expected Goals (xG)', val: match.stats.xG, unit: '' },
          { label: 'Tirs cadrés', val: match.stats.shotsOnTarget, unit: '' },
          { label: 'Total des tirs', val: match.stats.totalShots, unit: '' },
          { label: 'Corners', val: match.stats.corners, unit: '' },
          { label: 'Fautes', val: match.stats.fouls, unit: '' },
          { label: 'Hors-jeux', val: match.stats.offsides, unit: '' },
          { label: 'Cartons jaunes', val: match.stats.yellowCards, unit: '' },
          { label: 'Arrêts du gardien', val: match.stats.saves, unit: '' },
        ];
    const home = (real ? detail.data?.homeLineup : match.homeLineup) ?? emptyLineup;
    const away = (real ? detail.data?.awayLineup : match.awayLineup) ?? emptyLineup;
    return { events, stats, home, away, lineupsMissing: home.startingXI.length === 0 && away.startingXI.length === 0 };
  }, [match, isReal, detail.data]);

  if (!match || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        {state === 'loading' ? (
          <p className="flex items-center justify-center gap-2 text-sm text-slate-500" role="status">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement du match...
          </p>
        ) : (
          <>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Match introuvable</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{error ?? "Ce match n'existe pas ou n'est plus disponible."}</p>
            <Link to="/" className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-accent-600 text-white font-bold text-sm">Retour aux matchs</Link>
          </>
        )}
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = isReal
    ? [
        { id: 'resume', label: 'Résumé' },
        { id: 'stats', label: 'Stats' },
        { id: 'compos', label: 'Compos' },
        { id: 'joueurs', label: 'Stats joueurs' },
        { id: 'h2h', label: 'Face-à-face' },
        { id: 'classement', label: 'Classement' },
      ]
    : [
        ...(match.isLive ? [{ id: 'terrain' as TabId, label: 'Terrain 2D' }] : []),
        { id: 'resume', label: 'Résumé' },
        { id: 'stats', label: 'Stats' },
        { id: 'compos', label: 'Compos' },
      ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const label = statusLabel(match);
  const showScore = match.status !== 'SCHEDULED' && match.status !== 'POSTPONED';
  const round = frRound(match.round);
  const real = (t: Match['homeTeam']) => isReal && /^\d+$/.test(t.id);

  const TeamBlock: React.FC<{ t: Match['homeTeam'] }> = ({ t }) => {
    const inner = (
      <>
        <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-white/95 flex items-center justify-center shadow-sm">
          <Logo src={real(t) ? teamLogoUrl(t.id) : undefined} fallback={t.logo} size={48} alt="" />
        </span>
        <span className="mt-2 text-sm sm:text-base font-semibold text-slate-900 dark:text-white text-center leading-tight">{t.name}</span>
      </>
    );
    return real(t) ? (
      <Link to={teamUrl(t.id)} className="flex flex-col items-center min-w-0 hover:opacity-90">{inner}</Link>
    ) : (
      <div className="flex flex-col items-center min-w-0">{inner}</div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto md:py-4">
      <PageHeader favorite={isFavorite(match.id)} onToggleFavorite={() => onToggleFavorite(match.id)} shareTitle={`${match.homeTeam.name} - ${match.awayTeam.name}`} />

      <div className="md:rounded-3xl md:border border-slate-200/70 dark:border-white/10 fs-surface md:shadow-xl">
        <button onClick={() => goBack('/')} className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white px-4 pt-3">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        {/* Bandeau du championnat */}
        <Link
          to={leagueUrl(match.leagueId)}
          className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200/70 dark:border-white/10 hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
        >
          <span className="text-lg shrink-0" aria-hidden="true">{match.leagueFlag}</span>
          <span className="flex-1 min-w-0 truncate text-[13px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {frCountry(match.leagueCountry)}: <strong className="text-slate-800 dark:text-slate-100">{match.leagueName}{round ? ` - ${round}` : ''}</strong>
          </span>
          <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
        </Link>

        {/* Tableau d'affichage */}
        <section aria-label="Score" className="relative px-3 sm:px-6 py-5 bg-gradient-to-b from-slate-100/70 to-transparent dark:from-white/[0.04]">
          <div className="hidden md:block absolute right-3 top-3 z-10">
            <ShareButton
              variant="pill"
              title={showScore ? `${match.homeTeam.name} ${match.score.home}-${match.score.away} ${match.awayTeam.name}` : `${match.homeTeam.name} - ${match.awayTeam.name}`}
              text={`${match.leagueName} sur ScoreAfrica`}
            />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            <TeamBlock t={match.homeTeam} />
            <div className="flex flex-col items-center pt-1 min-w-[7.5rem]">
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{dateTime(match)}</p>
              {showScore ? (
                <p className={`mt-1 text-5xl sm:text-6xl font-black tabular-nums tracking-tight ${match.isLive ? 'text-accent-600 dark:text-cyan-300' : 'text-slate-900 dark:text-white'}`}>
                  {match.score.home}-{match.score.away}
                </p>
              ) : (
                <p className="mt-2 text-3xl font-black tabular-nums text-slate-900 dark:text-white">{match.startTime}</p>
              )}
              {label && (
                <p className={`mt-1 flex items-center gap-1.5 text-base font-bold ${match.isLive ? 'text-accent-600 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  {match.isLive && <span className="w-2 h-2 rounded-full bg-accent-500 animate-ping" aria-hidden="true" />}
                  {label}
                </p>
              )}
            </div>
            <TeamBlock t={match.awayTeam} />
          </div>
          {(match.stadium || match.referee) && (
            <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500 truncate">
              {[match.stadium, match.referee && `Arbitre : ${match.referee}`].filter(Boolean).join(' · ')}
            </p>
          )}
        </section>

        <TabBar tabs={tabs} active={activeTab} onChange={setTab} />

        <div className="min-h-[40vh] pb-4">
          {activeTab === 'terrain' && (
            <>
              <PitchTracker match={match} />
              <div className="px-4">
                <button onClick={() => onSimulateGoal(match.id)} className="px-4 py-2 rounded-xl bg-accent-600 text-white font-bold text-xs">
                  ⚡ Simuler un but sur ce match
                </button>
              </div>
            </>
          )}
          {activeTab === 'resume' && <Summary match={match} events={data.events} loading={detail.loading} />}
          {activeTab === 'stats' && <StatsTab rows={data.stats} loading={detail.loading} />}
          {activeTab === 'compos' &&
            (data.lineupsMissing ? (
              <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                {detail.loading ? 'Chargement des compositions...' : "Compositions pas encore disponibles (elles sortent environ 1 h avant le coup d'envoi)."}
              </p>
            ) : (
              <div className="grid md:grid-cols-2 md:divide-x divide-slate-100 dark:divide-white/5">
                <LineupColumn name={match.homeTeam.name} lineup={data.home} />
                <LineupColumn name={match.awayTeam.name} lineup={data.away} />
              </div>
            ))}
          {activeTab === 'joueurs' && <PlayersTab match={match} data={players} />}
          {activeTab === 'h2h' && <H2HTab match={match} data={h2h} />}
          {activeTab === 'classement' &&
            (standings === null ? (
              <p className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500" role="status"><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</p>
            ) : standings.groups.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{standings.apiError ?? 'Aucun classement disponible pour cette compétition.'}</p>
            ) : (
              standings.groups.map((g, i) => (
                <section key={g.name || i}>
                  <SectionBand title={g.name || match.leagueName} />
                  <StandingsTable rows={buildRows(g, 'all')} showLogos showForm={false} highlight={[parseInt(match.homeTeam.id, 10), parseInt(match.awayTeam.id, 10)]} />
                </section>
              ))
            ))}
        </div>
      </div>
    </div>
  );
};
