import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import { Match } from '../types';
import { goBack } from '../router';
import { Logo } from '../components/Logo';
import { PageHeader, TabBar } from '../components/DetailChrome';
import { ShareButton } from '../components/ShareButton';
import { FixtureList } from '../components/FixtureList';
import { TeamData, fetchTeam, teamLogoUrl } from '../services/football';

interface TeamPageProps {
  routeId: string;
  apiConfigured: boolean;
  demoMatches: Match[];
}

export const TeamPage: React.FC<TeamPageProps> = ({ routeId, apiConfigured, demoMatches }) => {
  const numeric = /^\d+$/.test(routeId) ? parseInt(routeId, 10) : null;
  const [data, setData] = useState<TeamData | null>(null);
  const [tab, setTab] = useState<'resultats' | 'calendrier'>('resultats');

  useEffect(() => {
    setData(null);
    if (!apiConfigured || !numeric) return;
    let alive = true;
    fetchTeam(numeric).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [numeric, apiConfigured]);

  // Démonstration : matchs du catalogue où l'équipe joue
  const demo = useMemo(() => demoMatches.filter((m) => m.homeTeam.id === routeId || m.awayTeam.id === routeId), [demoMatches, routeId]);

  const all: Match[] = apiConfigured ? [...(data?.last ?? []), ...(data?.next ?? [])] : demo;
  const side = all.flatMap((m) => [m.homeTeam, m.awayTeam]).find((t) => t.id === routeId);
  const name = data?.info?.name || side?.name || 'Équipe';
  const logoFallback = side?.logo ?? '⚽';

  useEffect(() => {
    document.title = `${name} : résultats et calendrier - ScoreAfrica`;
  }, [name]);

  const results = (apiConfigured ? data?.last ?? [] : demo.filter((m) => m.status === 'FINISHED' || m.isLive));
  const upcoming = (apiConfigured ? data?.next ?? [] : demo.filter((m) => m.status === 'SCHEDULED'));
  const loading = apiConfigured && numeric !== null && data === null;
  const venue = data?.info?.venue;

  return (
    <div className="max-w-3xl mx-auto md:py-4">
      <PageHeader shareTitle={name} />
      <div className="md:rounded-3xl md:border border-slate-200/70 dark:border-white/10 fs-surface md:shadow-xl">
        <button onClick={() => goBack('/')} className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white px-4 pt-3">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <header className="flex items-center gap-4 px-4 py-5 sm:px-6 bg-gradient-to-b from-slate-100/70 to-transparent dark:from-white/[0.04]">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-white/95 flex items-center justify-center shrink-0 shadow-sm">
            <Logo src={apiConfigured && numeric ? teamLogoUrl(numeric) : undefined} fallback={logoFallback} size={52} alt={name} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">{name}</h1>
            {data?.info?.country && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{data.info.country}{data.info.founded ? ` · Fondé en ${data.info.founded}` : ''}</p>}
            {venue?.name && (
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{venue.name}{venue.city ? `, ${venue.city}` : ''}{venue.capacity ? ` (${venue.capacity.toLocaleString('fr-FR')} places)` : ''}</span>
              </p>
            )}
          </div>
          <ShareButton className="hidden md:block ml-auto shrink-0" variant="pill" title={name} text="Résultats et calendrier sur ScoreAfrica" />
        </header>

        <TabBar tabs={[{ id: 'resultats' as const, label: 'Résultats' }, { id: 'calendrier' as const, label: 'Calendrier' }]} active={tab} onChange={setTab} />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
          </div>
        ) : (
          <>
            {data?.apiError && all.length === 0 && <p className="px-4 py-6 text-xs text-fuchsia-600 dark:text-fuchsia-300" role="alert">{data.apiError}</p>}
            {!apiConfigured && !numeric && demo.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Aucune donnée pour cette équipe en mode démonstration.</p>}
            {tab === 'resultats' ? (
              <FixtureList matches={results} order="desc" showLeague emptyText="Aucun résultat récent." />
            ) : (
              <FixtureList matches={upcoming} showLeague emptyText="Aucun match programmé." />
            )}
          </>
        )}
      </div>
    </div>
  );
};
