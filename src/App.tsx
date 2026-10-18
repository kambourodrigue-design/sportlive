import { useState, useEffect, useMemo } from 'react';
import { 
  useLiveMatchEngine 
} from './hooks/useLiveMatchEngine';
import { Navbar } from './components/Navbar';
import { DateStrip } from './components/DateStrip';
import { MatchList } from './components/MatchList';
import { MatchDetailModal } from './components/MatchDetailModal';
import { SportSelectorModal } from './components/SportSelectorModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { NotificationHistoryModal } from './components/NotificationHistoryModal';
import { NewsSection } from './components/NewsSection';
import { StandingsSection } from './components/StandingsSection';
import { SearchModal } from './components/SearchModal';
import { LiveToast } from './components/LiveToast';
import { AIPicks } from './components/AIPicks';
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
  const [selectedStandingsLeagueId, setSelectedStandingsLeagueId] = useState<string | undefined>(undefined);

  // Modal states
  const [isSportSelectorOpen, setIsSportSelectorOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

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
  const { dayMatches, loading: dayLoading, error: dayError } = useDayFixtures(selectedDate, apiConfigured, activeSport);

  const isFootball = activeSport === 'football';

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
        extra.push({ id: m.leagueId, name: m.leagueName, country: m.leagueCountry, flag: m.leagueFlag, order: 1000 + extra.length });
      }
    });
    return [...leagues, ...extra];
  }, [leagues, displayMatches, matches, apiConfigured, isFootball]);

  // La fiche détaillée (stats, compositions) n'existe que pour le football
  const handleSelectMatch = (m: Match) => {
    if (m.sportId === 'football') setSelectedMatch(m);
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
    const found = displayMatches.find((m) => m.id === matchId) ?? matches.find((m) => m.id === matchId);
    if (found) {
      setSelectedMatch(found);
    }
  };

  // Test notification helper
  const handleTestAlert = () => {
    triggerGoalSimulation('m-psg-ars', 'home');
  };

  return (
    <div className="min-h-screen fs-bg text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Top App Bar */}
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
      />

      {/* Floating Live Notification Toast */}
      <LiveToast
        notification={activeToast}
        onDismiss={dismissToast}
        onSelectMatch={handleSelectMatchById}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-20 md:pb-24">
        
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
            />

            {apiConfigured && (dayLoading || dayError || displayMatches.length === 0) && (
              <p className="max-w-7xl mx-auto px-4 pt-3 text-xs text-slate-500 dark:text-slate-400" role="status">
                {dayLoading
                  ? 'Chargement des matchs...'
                  : dayError
                    ? `Matchs indisponibles pour cette date : ${dayError}`
                    : 'Aucun match ce jour-là dans les compétitions couvertes.'}
              </p>
            )}

            <AIPicks />

            <MatchList
              leagues={displayLeagues}
              matches={displayMatches}
              favoriteMatchIds={favoriteMatchIds}
              onToggleFavoriteMatch={toggleFavoriteMatch}
              onToggleFavoriteLeague={toggleFavoriteLeague}
              onSelectMatch={handleSelectMatch}
              onOpenLeagueStandings={(leagueId) => {
                setSelectedStandingsLeagueId(leagueId);
                setActiveTab('classements');
              }}
              activeFilter={activeFilter}
            />
          </div>
        )}

        {/* TAB: DIRECT (LIVE ONLY) */}
        {activeTab === 'direct' && (
          <div>
            {/* Live Header Banner */}
            <div className="bg-red-600 text-white px-4 py-3 shadow-sm">
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
              <p className="max-w-7xl mx-auto px-4 pt-3 text-xs text-red-600 dark:text-red-300" role="alert">
                Scores en direct indisponibles : {liveError ?? dayError}
              </p>
            )}

            <MatchList
              leagues={displayLeagues}
              matches={apiConfigured ? liveMatches : displayMatches.filter((m) => m.isLive)}
              favoriteMatchIds={favoriteMatchIds}
              onToggleFavoriteMatch={toggleFavoriteMatch}
              onToggleFavoriteLeague={toggleFavoriteLeague}
              onSelectMatch={handleSelectMatch}
              onOpenLeagueStandings={(leagueId) => {
                setSelectedStandingsLeagueId(leagueId);
                setActiveTab('classements');
              }}
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
                  className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
                >
                  Gérer les alertes
                </button>
              </div>
            </div>

            <MatchList
              leagues={displayLeagues}
              matches={displayMatches}
              favoriteMatchIds={favoriteMatchIds}
              onToggleFavoriteMatch={toggleFavoriteMatch}
              onToggleFavoriteLeague={toggleFavoriteLeague}
              onSelectMatch={handleSelectMatch}
              onOpenLeagueStandings={(leagueId) => {
                setSelectedStandingsLeagueId(leagueId);
                setActiveTab('classements');
              }}
              activeFilter="all"
              onlyFavorites={true}
            />
          </div>
        )}

        {/* TAB: ACTUALITÉS */}
        {activeTab === 'actualites' && (
          <NewsSection news={liveNews} loaded={newsLoaded} />
        )}

        {/* TAB: CLASSEMENTS / CHAMPIONNATS */}
        {activeTab === 'classements' && (
          <StandingsSection initialCompetitionId={selectedStandingsLeagueId} />
        )}

      </main>

      {/* Fixed Bottom Navigation Bar (Matching Screenshots 2, 3, 4, 5) */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'classements') {
            // If already on classements or switching to it, let user see all championships list if desired
            if (activeTab === 'classements') {
              setSelectedStandingsLeagueId(undefined);
            }
          }
          setActiveTab(tab);
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

      <MatchDetailModal
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
        isFavorite={selectedMatch ? favoriteMatchIds.includes(selectedMatch.id) : false}
        onToggleFavorite={toggleFavoriteMatch}
        onSimulateGoal={triggerGoalSimulation}
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

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        matches={displayMatches}
        onSelectMatch={handleSelectMatch}
      />

    </div>
  );
}
