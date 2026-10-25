import { useState, useEffect, useMemo } from 'react';
import { 
  useLiveMatchEngine 
} from './hooks/useLiveMatchEngine';
import { Navbar } from './components/Navbar';
import { DateStrip } from './components/DateStrip';
import { MatchList } from './components/MatchList';
import { SportSelectorModal } from './components/SportSelectorModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { NotificationHistoryModal } from './components/NotificationHistoryModal';
import { NewsSection } from './components/NewsSection';
import { StandingsSection } from './components/StandingsSection';
import { SearchModal } from './components/SearchModal';
import { LiveToast } from './components/LiveToast';
import { PronosticsSection, PicksTeaser } from './components/PronosticsSection';
import { AuthModal, AuthMode } from './components/AuthModal';
import { useAuth } from './hooks/useAuth';
import { Footer } from './components/Footer';
import { StaticPage, PAGES } from './pages/StaticPages';
import { LeaguePage } from './pages/LeaguePage';
import { TeamPage } from './pages/TeamPage';
import { MatchPage } from './pages/MatchPage';
import { Link, leagueUrl, matchRoute, matchUrl, navigate, usePath } from './router';
import { AfricanLeague, fetchAfricanLeagues } from './services/football';
import { frCountry, isAfricanLeague } from './utils/africa';
import { useDayFixtures } from './hooks/useDayFixtures';
import { useNews } from './hooks/useNews';
import { BottomNavigation } from './components/BottomNavigation';
import { Match, MainNavTab, League } from './types';
import { toLocalISODate } from './utils/date';
import { Radio, Flame, Sparkles, Bell } from 'lucide-react';

export default function App() {
  // Theme state: Default Light Theme as requested, with dark mode toggle
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('fs_theme');
      return saved ? saved === 'dark' : true; // sombre par défaut
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('fs_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('fs_theme', 'light');
      }
    } catch {}
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Main navigation tab
  const [activeTab, setActiveTab] = useState<MainNavTab>('tous');
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalISODate(new Date()));
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'finished'>('all');
  const [africaOnly, setAfricaOnly] = useState(false);
  const route = matchRoute(usePath());

  // Compte utilisateur (accès aux pronostics IA)
  const { user, checking: authChecking, submit: submitAuth, signOut, sessionLost } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);

  // Modal states
  const [isSportSelectorOpen, setIsSportSelectorOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Engine hook
  const {
    sports,
    activeSport,
    setActiveSport,
    leagues,
    matches,
    news,
    favoriteMatchIds,
    toggleFavoriteMatch,
    toggleFavoriteLeague,
    notificationSettings,
    setNotificationSettings,
    notifications,
    activeToast,
    dismissToast,
    clearAllNotifications,
    markAllNotificationsAsRead,
    dispatchNotification,
    triggerGoalSimulation,
    isSimulating,
    setIsSimulating,
    simulationSpeed,
    setSimulationSpeed,
    apiStatus,
    liveError,
  } = useLiveMatchEngine();

  const { news: liveNews, loaded: newsLoaded } = useNews();

  // Vrais matchs du jour choisi (si API configurée). Sinon : matchs de démonstration.
  const apiConfigured = apiStatus.configured;
  const isTennis = activeSport === 'tennis'; // pas encore de fournisseur de données : « bientôt disponible »
  const { dayMatches, loading: dayLoading, error: dayError } = useDayFixtures(selectedDate, apiConfigured && !isTennis, activeSport);

  const isFootball = activeSport === 'football';

  // Championnats africains de la saison (identifiants fournis par l'API)
  const [africanLeagues, setAfricanLeagues] = useState<AfricanLeague[]>([]);
  useEffect(() => {
    if (!apiConfigured) return;
    let alive = true;
    fetchAfricanLeagues().then((l) => alive && setAfricanLeagues(l));
    return () => {
      alive = false;
    };
  }, [apiConfigured]);

  // Titre de l'onglet selon la page
  useEffect(() => {
    const base = 'ScoreAfrica - Résultats Sportifs en Direct & Pronostics IA';
    if (route.name === 'home') document.title = base;
    else if (route.name === 'page') document.title = `${PAGES[route.slug].title} - ScoreAfrica`;
    else if (route.name === 'notfound') document.title = 'Page introuvable - ScoreAfrica';
  }, [route]);

  const displayMatches = useMemo<Match[]>(() => {
    if (!apiConfigured) return matches.filter((m) => m.sportId === activeSport);
    if (!isFootball) return dayMatches; // autres sports : données du jour via API-Sports
    const liveById = new Map<string, Match>(matches.filter((m) => m.id.startsWith('apif-')).map((m): [string, Match] => [m.id, m]));
    return dayMatches.map((m) => liveById.get(m.id) ?? m); // la version « direct » est plus fraîche
  }, [apiConfigured, matches, dayMatches, activeSport, isFootball]);

  // Championnats inconnus du catalogue : on les crée à la volée pour que leurs matchs s'affichent
  const displayLeagues = useMemo<League[]>(() => {
    const known = new Set(leagues.map((l) => l.id));
    const extra: League[] = [];
    const source =
      apiConfigured && isFootball ? [...displayMatches, ...matches.filter((m) => m.id.startsWith('apif-'))] : displayMatches;
    source.forEach((m) => {
      if (!known.has(m.leagueId)) {
        known.add(m.leagueId);
        const african = isFootball && isAfricanLeague(m.leagueCountry, m.leagueName);
        extra.push({
          id: m.leagueId,
          name: m.leagueName,
          country: frCountry(m.leagueCountry),
          flag: african ? '🌍' : m.leagueFlag,
          order: (african ? 100 : 1000) + extra.length, // les compétitions africaines passent juste après les favorites
        });
      }
    });
    return [...leagues, ...extra];
  }, [leagues, displayMatches, matches, apiConfigured, isFootball]);

  const tousMatches = useMemo(
    () => (africaOnly ? displayMatches.filter((m) => isAfricanLeague(m.leagueCountry, m.leagueName)) : displayMatches),
    [africaOnly, displayMatches],
  );

  // La fiche détaillée (stats, compositions) n'existe que pour le football
  const handleSelectMatch = (m: Match) => {
    if (m.sportId === 'football') navigate(matchUrl(m.id));
  };

  // Counts
  // Direct : toujours les vrais matchs en cours (quel que soit le jour choisi) quand l'API est configurée
  const liveMatches =
    apiConfigured && isFootball
      ? matches.filter((m) => m.id.startsWith('apif-') && m.isLive)
      : displayMatches.filter((m) => m.isLive);
  const liveMatchesCount = liveMatches.length;
  const totalMatchesCount = displayMatches.length;

  // Compteurs réels du sport affiché ; les autres ne sont pas connus (on n'affiche plus de faux chiffres)
  const uiSports = useMemo(
    () =>
      apiConfigured
        ? sports.map((s) =>
            s.id === activeSport
              ? { ...s, liveCount: liveMatches.length, totalCount: displayMatches.length }
              : { ...s, liveCount: 0, totalCount: 0 },
          )
        : sports,
    [sports, apiConfigured, activeSport, liveMatches.length, displayMatches.length],
  );
  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  const handleCycleSpeed = () => {
    setSimulationSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : 1));
  };

  const handleSelectMatchById = (matchId: string) => {
    navigate(matchUrl(matchId));
  };

  // Test notification helper
  const handleTestAlert = () => {
    triggerGoalSimulation('m-psg-ars', 'home');
  };

  return (
    <div className="min-h-screen fs-bg text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Top App Bar */}
      <div className={route.name === 'match' || route.name === 'league' || route.name === 'team' ? 'hidden md:block md:sticky md:top-0 md:z-40' : 'contents'}>
      <Navbar
        sports={uiSports}
        activeSport={activeSport}
        onOpenSportSelector={() => setIsSportSelectorOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        unreadNotificationsCount={unreadNotificationsCount}
        isSimulating={isSimulating}
        onToggleSimulation={() => setIsSimulating(!isSimulating)}
        simulationSpeed={simulationSpeed}
        onChangeSpeed={handleCycleSpeed}
        onTriggerGoal={() => triggerGoalSimulation()}
        user={user}
        authChecking={authChecking}
        onOpenAuth={() => setAuthMode('login')}
        onSignOut={signOut}
      />
      </div>

      {/* Floating Live Notification Toast */}
      <LiveToast
        notification={activeToast}
        onDismiss={dismissToast}
        onSelectMatch={handleSelectMatchById}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-28 md:pb-28">
        {route.name === 'home' && (<>
        
        {/* TAB: TOUS LES MATCHS */}
        {activeTab === 'tous' && (
          <div>
            <DateStrip
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              liveMatchesCount={liveMatchesCount}
              totalMatchesCount={totalMatchesCount}
              activeFilter={activeFilter}
              onChangeFilter={setActiveFilter}
              africaOnly={africaOnly}
              onToggleAfrica={isFootball ? () => setAfricaOnly((v) => !v) : undefined}
            />

            {apiConfigured && !isTennis && (dayLoading || dayError || displayMatches.length === 0) && (
              <p className="max-w-7xl mx-auto px-4 pt-3 text-xs text-slate-500 dark:text-slate-400" role="status">
                {dayLoading
                  ? 'Chargement des matchs...'
                  : dayError
                    ? `Matchs indisponibles pour cette date : ${dayError}`
                    : 'Aucun match ce jour-là dans les compétitions couvertes.'}
              </p>
            )}

            <PicksTeaser loggedIn={Boolean(user)} onOpen={() => setActiveTab('pronostics')} />

            <MatchList
              comingSoon={isTennis}
              leagues={displayLeagues}
              matches={tousMatches}
              favoriteMatchIds={favoriteMatchIds}
              onToggleFavoriteMatch={toggleFavoriteMatch}
              onToggleFavoriteLeague={toggleFavoriteLeague}
              onSelectMatch={handleSelectMatch}
              onOpenLeagueStandings={(leagueId) => navigate(leagueUrl(leagueId))}
              activeFilter={activeFilter}
            />
          </div>
        )}

        {/* TAB: DIRECT (LIVE ONLY) */}
        {activeTab === 'direct' && (
          <div>
            {/* Live Header Banner */}
            <div className="bg-accent-600 text-white px-4 py-3 shadow-sm">
              <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <h2 className="text-sm font-extrabold uppercase tracking-wide">
                    Matchs en direct ({liveMatchesCount})
                  </h2>
                </div>
                {!apiConfigured && (
                  <button
                    onClick={() => triggerGoalSimulation()}
                    className="px-2.5 py-1 text-xs font-bold rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors"
                  >
                    ⚡ Simuler un but en direct
                  </button>
                )}
              </div>
            </div>

            {(liveError || (!isFootball && dayError)) && (
              <p className="max-w-7xl mx-auto px-4 pt-3 text-xs text-accent-600 dark:text-accent-300" role="alert">
                Scores en direct indisponibles : {liveError ?? dayError}
              </p>
            )}

            <MatchList
              comingSoon={isTennis}
              leagues={displayLeagues}
              matches={apiConfigured ? liveMatches : displayMatches.filter((m) => m.isLive)}
              favoriteMatchIds={favoriteMatchIds}
              onToggleFavoriteMatch={toggleFavoriteMatch}
              onToggleFavoriteLeague={toggleFavoriteLeague}
              onSelectMatch={handleSelectMatch}
              onOpenLeagueStandings={(leagueId) => navigate(leagueUrl(leagueId))}
              activeFilter="live"
            />
          </div>
        )}

        {/* TAB: FAVORIS */}
        {activeTab === 'favoris' && (
          <div>
            <div className="fs-surface border-b border-slate-200 dark:border-slate-800 px-4 py-3">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Mes Matchs & Équipes Favoris ({favoriteMatchIds.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Alertes automatiques activées pour ces rencontres
                  </p>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-xs font-bold text-accent-600 dark:text-accent-400 hover:underline"
                >
                  Gérer les alertes
                </button>
              </div>
            </div>

            <MatchList
              comingSoon={isTennis}
              leagues={displayLeagues}
              matches={displayMatches}
              favoriteMatchIds={favoriteMatchIds}
              onToggleFavoriteMatch={toggleFavoriteMatch}
              onToggleFavoriteLeague={toggleFavoriteLeague}
              onSelectMatch={handleSelectMatch}
              onOpenLeagueStandings={(leagueId) => navigate(leagueUrl(leagueId))}
              activeFilter="all"
              onlyFavorites={true}
            />
          </div>
        )}

        {/* TAB: PRONOSTICS IA (réservé aux comptes connectés) */}
        {activeTab === 'pronostics' && (
          <PronosticsSection user={user} checking={authChecking} onOpenAuth={setAuthMode} onSessionLost={sessionLost} />
        )}

        {/* TAB: ACTUALITÉS */}
        {activeTab === 'actualites' && (
          <NewsSection news={liveNews} loaded={newsLoaded} />
        )}

        {/* TAB: CLASSEMENTS / CHAMPIONNATS */}
        {activeTab === 'classements' && (
          <StandingsSection africanLeagues={africanLeagues} apiConfigured={apiConfigured} />
        )}

        </>)}

        {route.name === 'league' && (
          <LeaguePage routeId={route.id} apiConfigured={apiConfigured} africanLeagues={africanLeagues} demoMatches={[...matches, ...displayMatches]} />
        )}
        {route.name === 'team' && <TeamPage routeId={route.id} apiConfigured={apiConfigured} demoMatches={[...matches, ...displayMatches]} />}
        {route.name === 'match' && (
          <MatchPage
            routeId={route.id}
            matches={[...displayMatches, ...matches]}
            isFavorite={(id) => favoriteMatchIds.includes(id)}
            onToggleFavorite={toggleFavoriteMatch}
            onSimulateGoal={triggerGoalSimulation}
          />
        )}
        {route.name === 'page' && <StaticPage slug={route.slug} />}
        {route.name === 'notfound' && (
          <div className="max-w-xl mx-auto px-4 py-24 text-center">
            <p className="text-5xl font-black fs-text-gradient">404</p>
            <h1 className="mt-3 text-xl font-black text-slate-900 dark:text-white">Page introuvable</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Cette adresse n'existe pas ou a été déplacée.</p>
            <Link to="/" className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-accent-600 text-white font-bold text-sm">
              Retour aux matchs
            </Link>
          </div>
        )}

        <Footer />
      </main>

      {/* Fixed Bottom Navigation Bar (Matching Screenshots 2, 3, 4, 5) */}
      <BottomNavigation
        activeTab={route.name === 'home' ? activeTab : null}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (route.name !== 'home') navigate('/');
        }}
        liveMatchesCount={liveMatchesCount}
        favoritesCount={favoriteMatchIds.length}
      />

      {/* Modals */}
      <SportSelectorModal
        isOpen={isSportSelectorOpen}
        onClose={() => setIsSportSelectorOpen(false)}
        sports={uiSports}
        activeSport={activeSport}
        onSelectSport={setActiveSport}
      />

      <NotificationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={notificationSettings}
        onUpdateSettings={setNotificationSettings}
        onTriggerTestAlert={handleTestAlert}
        apiStatus={apiStatus}
      />

      <NotificationHistoryModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onClearAll={clearAllNotifications}
        onMarkAllAsRead={markAllNotificationsAsRead}
        onSelectMatchById={handleSelectMatchById}
      />

      <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onChangeMode={setAuthMode} onSubmit={submitAuth} />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        matches={displayMatches}
        onSelectMatch={handleSelectMatch}
      />

    </div>
  );
}
