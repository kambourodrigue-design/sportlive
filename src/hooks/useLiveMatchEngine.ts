import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_NOTIFICATIONS, INITIAL_LEAGUES, INITIAL_MATCHES, INITIAL_NEWS, INITIAL_SPORTS } from '../data/mockData';
import { League, Match, MatchStatus, NewsArticle, NotificationItem, NotificationSettings, SportId, SportInfo } from '../types';
import { soundManager } from '../utils/sound';
import { checkApiFootballStatus, fetchLiveFixturesFromApi, ApiFootballStatus } from '../services/apiFootball';

export function useLiveMatchEngine() {
  const [sports] = useState<SportInfo[]>(INITIAL_SPORTS);
  const [activeSport, setActiveSport] = useState<SportId>('football');
  const [leagues, setLeagues] = useState<League[]>(INITIAL_LEAGUES);
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [news] = useState<NewsArticle[]>(INITIAL_NEWS);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiFootballStatus>(() => {
    // Visites suivantes : on réutilise le dernier statut connu pour charger les vrais matchs tout de suite
    let known = false;
    try {
      known = localStorage.getItem('fsn_api_configured') === '1';
    } catch {
      /* ignoré */
    }
    return {
      configured: known,
      provider: known ? 'api-sports' : 'demo-simulation',
      baseUrl: null,
      message: 'Chargement du statut API...',
    };
  });
  
  // Favorites persisted in localStorage
  const [favoriteMatchIds, setFavoriteMatchIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fs_favorite_matches');
      return saved ? JSON.parse(saved) : ['m-psg-ars', 'm-rma-bar'];
    } catch {
      return ['m-psg-ars', 'm-rma-bar'];
    }
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem('fs_notification_settings');
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1); // 1 = normal, 3 = fast

  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save favorites & settings
  useEffect(() => {
    try {
      localStorage.setItem('fs_favorite_matches', JSON.stringify(favoriteMatchIds));
    } catch {}
  }, [favoriteMatchIds]);

  useEffect(() => {
    try {
      localStorage.setItem('fs_notification_settings', JSON.stringify(notificationSettings));
    } catch {}
  }, [notificationSettings]);

  // Check API-Football status and poll live fixtures if configured
  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      const status = await checkApiFootballStatus();
      try {
        localStorage.setItem('fsn_api_configured', status.configured ? '1' : '0');
      } catch {
        /* ignoré */
      }
      if (isMounted) {
        setApiStatus(status);
      }
      return status;
    }

    async function pollLiveApi() {
      const result = await fetchLiveFixturesFromApi();
      if (!isMounted) return;

      if (result.apiError) {
        // Erreur de l'API (ex. quota atteint) : on efface les anciens scores pour ne pas afficher de données périmées
        setLiveError(result.apiError);
        setMatches((prev) => prev.filter((m) => !m.id.startsWith('apif-')));
        return;
      }
      if (!result.fromRealApi) return; // réseau indisponible : on garde l'affichage actuel
      setLiveError(null);

      setMatches((prev) => {
        // Détection des nouveaux buts pour les notifications
        result.matches.forEach((newMatch) => {
          const oldMatch = prev.find((m) => m.id === newMatch.id);
          if (oldMatch && (newMatch.score.home > oldMatch.score.home || newMatch.score.away > oldMatch.score.away)) {
            const teamScored = newMatch.score.home > oldMatch.score.home ? newMatch.homeTeam.name : newMatch.awayTeam.name;
            dispatchNotification({
              matchId: newMatch.id,
              type: 'GOAL',
              title: `⚽ BUT EN DIRECT ! ${teamScored}`,
              message: `Nouveau score : ${newMatch.homeTeam.shortName} ${newMatch.score.home} - ${newMatch.score.away} ${newMatch.awayTeam.shortName}`,
              matchTitle: `${newMatch.homeTeam.name} vs ${newMatch.awayTeam.name}`,
            });
          }
        });

        // Les vrais matchs sont remplacés en bloc : un match terminé ne reste plus « en direct »
        const catalogue = prev.filter((m) => !m.id.startsWith('apif-'));
        return [...result.matches, ...catalogue];
      });
    }

    let interval: ReturnType<typeof setInterval> | undefined;

    checkStatus().then((status) => {
      if (status.configured && isMounted) {
        pollLiveApi();
        interval = setInterval(pollLiveApi, 60000); // 60s polling (le serveur met aussi en cache)
      }
    });

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  // Dispatch an alert notification
  const dispatchNotification = useCallback((item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newItem: NotificationItem = {
      ...item,
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      read: false,
    };

    setNotifications((prev) => [newItem, ...prev.slice(0, 49)]);

    // Check settings for sound
    if (notificationSettings.enabled) {
      if (notificationSettings.sound) {
        if (item.type === 'GOAL') {
          soundManager.playGoalSound();
        } else if (item.type === 'RED_CARD') {
          soundManager.playCardAlert();
        } else if (item.type === 'HALF_TIME' || item.type === 'FULL_TIME') {
          soundManager.playWhistle();
        } else {
          soundManager.playTick();
        }
      }

      // Check vibration
      if (notificationSettings.vibrate && typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }

      // Show in-app banner toast
      if (notificationSettings.inAppToast) {
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }
        setActiveToast(newItem);
        toastTimeoutRef.current = setTimeout(() => {
          setActiveToast(null);
        }, 5500);
      }

      // Native browser notification if permitted
      if (notificationSettings.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(item.title, {
          body: item.message,
          icon: '/favicon.ico',
        });
      }
    }
  }, [notificationSettings]);

  // Trigger goal simulation on a match
  const triggerGoalSimulation = useCallback((targetMatchId?: string, forceTeam?: 'home' | 'away') => {
    setMatches((prev) => {
      const liveMatches = prev.filter((m) => m.isLive && m.status !== 'FINISHED' && m.status !== 'HALF_TIME');
      if (liveMatches.length === 0) return prev;

      const matchToUpdate = targetMatchId
        ? prev.find((m) => m.id === targetMatchId)
        : liveMatches[Math.floor(Math.random() * liveMatches.length)];

      if (!matchToUpdate) return prev;

      const teamChoice: 'home' | 'away' = forceTeam || (Math.random() > 0.5 ? 'home' : 'away');
      const teamScoring = teamChoice === 'home' ? matchToUpdate.homeTeam : matchToUpdate.awayTeam;
      const currentScore = { ...matchToUpdate.score };
      if (teamChoice === 'home') {
        currentScore.home += 1;
      } else {
        currentScore.away += 1;
      }

      const scorers = teamChoice === 'home'
        ? (matchToUpdate.homeLineup.startingXI.filter((p) => p.position === 'ATT' || p.position === 'MID'))
        : (matchToUpdate.awayLineup.startingXI.filter((p) => p.position === 'ATT' || p.position === 'MID'));

      const scorerName = scorers.length > 0
        ? scorers[Math.floor(Math.random() * scorers.length)].name
        : (teamChoice === 'home' ? 'Attaquant ' + teamScoring.shortName : 'Buteur ' + teamScoring.shortName);

      const newMinute = Math.min(90, Math.max(matchToUpdate.minute + 1, 1));

      const newEvent = {
        id: 'e-sim-' + Date.now(),
        type: 'GOAL' as const,
        minute: newMinute,
        team: teamChoice,
        playerName: scorerName,
        detail: 'Superbe frappe cadrée',
      };

      // Notify if goals enabled
      if (notificationSettings.events.goals) {
        dispatchNotification({
          matchId: matchToUpdate.id,
          type: 'GOAL',
          title: `⚽ BUT ! ${teamScoring.name}`,
          message: `${scorerName} (${newMinute}') marque ! Nouveau score : ${matchToUpdate.homeTeam.shortName} ${currentScore.home} - ${currentScore.away} ${matchToUpdate.awayTeam.shortName}`,
          matchTitle: `${matchToUpdate.homeTeam.name} vs ${matchToUpdate.awayTeam.name}`,
        });
      }

      return prev.map((m) => {
        if (m.id !== matchToUpdate.id) return m;
        return {
          ...m,
          score: currentScore,
          events: [...m.events, newEvent],
          lastGoalHighlight: {
            team: teamChoice,
            minute: newMinute,
            scorer: scorerName,
            timestamp: Date.now(),
          },
          pitchLive: {
            ballPosition: teamChoice === 'home' ? { x: 88, y: 50 } : { x: 12, y: 50 },
            phase: 'Tir au but',
            attackingTeam: teamChoice,
          },
        };
      });
    });
  }, [dispatchNotification, notificationSettings.events.goals]);

  // Main real-time simulation loop
  useEffect(() => {
    if (!isSimulating) return;

    const intervalMs = Math.max(1200, 4500 / simulationSpeed);

    const interval = setInterval(() => {
      setMatches((prev) => {
        return prev.map((match) => {
          if (!match.isLive || match.status === 'FINISHED') return match;

          // Pitch radar micro-movement
          const newX = Math.floor(Math.random() * 80) + 10;
          const newY = Math.floor(Math.random() * 80) + 10;
          const phases = ['Attaque dangereuse', 'Construction', 'Contre-attaque', 'Coup franc dangereux', 'Corner'] as const;
          const randomPhase = phases[Math.floor(Math.random() * phases.length)];
          const attackingTeam: 'home' | 'away' = newX > 50 ? 'home' : 'away';

          // Advance minute slowly
          let newMinute = match.minute;
          let newStatus: MatchStatus = match.status;

          if (match.status === 'LIVE_1H') {
            newMinute += 1;
            if (newMinute >= 45) {
              newStatus = 'HALF_TIME';
              if (notificationSettings.events.halfTime) {
                dispatchNotification({
                  matchId: match.id,
                  type: 'HALF_TIME',
                  title: `⏸️ Mi-temps : ${match.homeTeam.shortName} ${match.score.home} - ${match.score.away} ${match.awayTeam.shortName}`,
                  message: `Score à la pause : ${match.score.home}-${match.score.away}`,
                  matchTitle: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                });
              }
            }
          } else if (match.status === 'LIVE_2H') {
            newMinute += 1;
            if (newMinute >= 90) {
              newStatus = 'FINISHED';
              if (notificationSettings.events.fullTime) {
                dispatchNotification({
                  matchId: match.id,
                  type: 'FULL_TIME',
                  title: `🏁 Fin du match : ${match.homeTeam.shortName} ${match.score.home} - ${match.score.away} ${match.awayTeam.shortName}`,
                  message: `Score final : ${match.homeTeam.name} ${match.score.home} - ${match.score.away} ${match.awayTeam.name}`,
                  matchTitle: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                });
              }
            }
          }

          return {
            ...match,
            minute: newMinute,
            status: newStatus,
            isLive: newStatus !== 'FINISHED',
            pitchLive: {
              ballPosition: { x: newX, y: newY },
              phase: randomPhase,
              attackingTeam,
            },
          };
        });
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isSimulating, simulationSpeed, dispatchNotification, notificationSettings.events.halfTime, notificationSettings.events.fullTime]);

  const toggleFavoriteMatch = useCallback((id: string) => {
    soundManager.playTick();
    setFavoriteMatchIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const toggleFavoriteLeague = useCallback((id: string) => {
    soundManager.playTick();
    setLeagues((prev) =>
      prev.map((l) => (l.id === id ? { ...l, isFavorite: !l.isFavorite } : l))
    );
  }, []);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return {
    sports,
    activeSport,
    setActiveSport,
    leagues,
    setLeagues,
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
  };
}
