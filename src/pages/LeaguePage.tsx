import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ALL_COMPETITIONS, STANDINGS_DATA, TOP_SCORERS_DATA } from '../data/mockData';
import { Match } from '../types';
import { Link, goBack, teamUrl } from '../router';
import { Logo } from '../components/Logo';
import { PageHeader, TabBar } from '../components/DetailChrome';
import { FixtureList } from '../components/FixtureList';
import { StandingsTable, buildRows, Scope } from '../components/StandingsTable';
import {
  AfricanLeague,
  LeagueData,
  ScorerRow,
  StatLine,
  TableGroup,
  fetchLeagueData,
  fetchLeagueFixtures,
  leagueLogoUrl,
  resolveLeagueApiId,
  teamLogoUrl,
} from '../services/football';
import { flagFromCode, frCountry } from '../utils/africa';

type Tab = 'matchs' | 'classement' | 'buteurs';

const ScorersTable: React.FC<{ rows: ScorerRow[] }> = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-white/10">
          <th className="py-2 pl-3 pr-1 text-left w-10">#</th>
          <th className="py-2 px-2 text-left">Joueur</th>
          <th className="py-2 px-2 text-center">Buts</th>
          <th className="py-2 px-2 text-center hidden sm:table-cell">Passes</th>
          <th className="py-2 px-2 text-center hidden sm:table-cell">Matchs</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.player.id}-${i}`} className="border-b border-slate-100 dark:border-white/5">
            <td className="py-2.5 pl-3 pr-1 font-bold tabular-nums text-slate-600 dark:text-slate-300">{i + 1}</td>
            <td className="py-2.5 px-2">
              <p className="font-semibold text-slate-900 dark:text-white">{r.player.name}</p>
              {r.team.id ? (
                <Link to={teamUrl(r.team.id)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-cyan-300">
                  {r.team.name}
                </Link>
              ) : (
                <span className="text-xs text-slate-500 dark:text-slate-400">{r.team.name}</span>
              )}
            </td>
            <td className="py-2.5 px-2 text-center tabular-nums font-black text-accent-600 dark:text-cyan-300">{r.goals}</td>
            <td className="py-2.5 px-2 text-center tabular-nums hidden sm:table-cell">{r.assists}</td>
            <td className="py-2.5 px-2 text-center tabular-nums hidden sm:table-cell">{r.games}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface LeaguePageProps {
  routeId: string;
  apiConfigured: boolean;
  africanLeagues: AfricanLeague[];
  demoMatches: Match[];
}

export const LeaguePage: React.FC<LeaguePageProps> = ({ routeId, apiConfigured, africanLeagues, demoMatches }) => {
  const apiId = resolveLeagueApiId(routeId);
  const african = apiId ? africanLeagues.find((l) => l.id === apiId) : undefined;
  const catalogue = ALL_COMPETITIONS.find((c) => c.id === routeId);

  const [tab, setTab] = useState<Tab>('matchs');
  const [scope, setScope] = useState<Scope>('all');
  const [data, setData] = useState<LeagueData | null>(null);
  const [fixtures, setFixtures] = useState<{ matches: Match[]; apiError?: string } | null>(null);

  useEffect(() => {
    setData(null);
    setFixtures(null);
    setTab('matchs');
    if (!apiConfigured || !apiId) return;
    let alive = true;
    fetchLeagueData(apiId, african?.season).then((d) => alive && setData(d));
    fetchLeagueFixtures(apiId, african?.season).then((f) => alive && setFixtures(f));
    return () => {
      alive = false;
    };
  }, [apiId, apiConfigured, african?.season]);

  const name = data?.info?.name || african?.name || catalogue?.name || (apiId ? `Championnat ${apiId}` : 'Championnat');
  const country = african?.continental ? 'Afrique' : frCountry(data?.info?.country || african?.country) || catalogue?.country || '';
  const flag = african ? flagFromCode(african.code ?? undefined) : catalogue?.flag ?? '⚽';

  useEffect(() => {
    document.title = `${name} : résultats, classement et buteurs - ScoreAfrica`;
  }, [name]);

  // Démonstration (sans clé API) : classement et buteurs fictifs du catalogue
  const demoGroups = useMemo<TableGroup[]>(() => {
    const mock = STANDINGS_DATA[routeId];
    if (apiConfigured || !mock) return [];
    return [
      {
        name: '',
        rows: mock.map((r) => {
          const s: StatLine = { p: r.played, w: r.wins, d: r.draws, l: r.losses, gf: r.goalsFor, ga: r.goalsAgainst };
          return { rank: r.rank, team: { id: 0, name: `${r.logo} ${r.team}` }, points: r.points, diff: r.goalDiff, form: r.form.join(''), desc: '', all: s, home: s, away: s };
        }),
      },
    ];
  }, [routeId, apiConfigured]);
  const demoScorers = useMemo<ScorerRow[]>(
    () =>
      apiConfigured
        ? []
        : (TOP_SCORERS_DATA[routeId] ?? []).map((s) => ({ player: { id: 0, name: s.player }, team: { id: 0, name: s.team }, goals: s.goals, assists: s.assists ?? 0, games: s.matchesPlayed ?? 0 })),
    [routeId, apiConfigured],
  );

  const groups = apiConfigured ? data?.groups ?? [] : demoGroups;
  const scorers = apiConfigured ? data?.scorers ?? [] : demoScorers;
  const leagueMatches = apiConfigured ? fixtures?.matches ?? [] : demoMatches.filter((m) => m.leagueId === routeId);
  const loading = apiConfigured && apiId !== null && (data === null || fixtures === null);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'matchs', label: 'Matchs' },
    { id: 'classement', label: 'Classement' },
    { id: 'buteurs', label: 'Buteurs' },
  ];

  return (
    <div className="max-w-3xl mx-auto md:py-4">
      <PageHeader shareTitle={name} />
      <div className="md:rounded-3xl md:border border-slate-200/70 dark:border-white/10 fs-surface md:shadow-xl">
        <button onClick={() => goBack('/')} className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white px-4 pt-3">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <header className="flex items-center gap-4 px-4 py-5 sm:px-6 bg-gradient-to-b from-slate-100/70 to-transparent dark:from-white/[0.04]">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-white/95 flex items-center justify-center shrink-0 shadow-sm">
            <Logo src={apiId && apiConfigured ? leagueLogoUrl(apiId) : undefined} fallback={flag} size={44} alt={name} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">{name}</h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wide">
              <span aria-hidden="true">{flag}</span> {country}
              {(data?.season || african?.season) && <> · Saison {data?.season ?? african?.season}</>}
            </p>
          </div>
        </header>

        <TabBar tabs={tabs} active={tab} onChange={setTab} />

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
          </div>
        )}

        {!loading && !apiId && !demoGroups.length && leagueMatches.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Championnat introuvable.</p>
        )}

        {!loading && tab === 'matchs' && (
          <>
            {apiConfigured && fixtures?.apiError && <p className="px-4 pt-4 text-xs text-fuchsia-600 dark:text-fuchsia-300" role="alert">{fixtures.apiError}</p>}
            <FixtureList matches={leagueMatches} emptyText={apiConfigured ? 'Aucun match dans les 7 jours autour d\'aujourd\'hui.' : 'Aucun match de démonstration pour ce championnat.'} />
          </>
        )}

        {!loading && tab === 'classement' && (
          <div className="pb-2">
            {!apiConfigured && demoGroups.length > 0 && <p className="px-4 pt-3 text-[11px] text-slate-400">Données de démonstration : connecte l'API pour les vrais classements.</p>}
            {apiConfigured && data?.apiError && groups.length === 0 && <p className="px-4 pt-4 text-xs text-fuchsia-600 dark:text-fuchsia-300" role="alert">{data.apiError}</p>}
            {groups.length > 0 && apiConfigured && (
              <div className="flex gap-1 p-3" role="group" aria-label="Type de classement">
                {(['all', 'home', 'away'] as Scope[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    aria-pressed={scope === s}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${scope === s ? 'bg-accent-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    {s === 'all' ? 'Général' : s === 'home' ? 'Domicile' : 'Extérieur'}
                  </button>
                ))}
              </div>
            )}
            {groups.length === 0 && !data?.apiError && (
              <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Aucun classement disponible pour cette compétition.</p>
            )}
            {groups.map((g, i) => (
              <section key={g.name || i}>
                {g.name && <h2 className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50/60 dark:bg-white/[0.03]">{g.name}</h2>}
                <StandingsTable rows={buildRows(g, scope)} showLogos={apiConfigured} showForm={apiConfigured} />
              </section>
            ))}
          </div>
        )}

        {!loading && tab === 'buteurs' && (
          <div className="pb-2">
            {scorers.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                {data?.apiError ?? 'Classement des buteurs indisponible pour cette compétition.'}
              </p>
            ) : (
              <ScorersTable rows={scorers} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
