import React, { useState } from 'react';
import { 
  X, 
  Bell, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Monitor, 
  Check, 
  Zap,
  ShieldAlert,
  Flame,
  Clock
} from 'lucide-react';
import { NotificationSettings } from '../types';
import { ApiFootballStatus } from '../services/apiFootball';
import { PushCard } from './PushCard';
import { usePush } from '../hooks/usePush';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onUpdateSettings: (newSettings: NotificationSettings) => void;
  onTriggerTestAlert: () => void;
  apiStatus?: ApiFootballStatus;
  push: ReturnType<typeof usePush>;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onTriggerTestAlert,
  apiStatus,
  push,
}) => {
  const [browserPermState, setBrowserPermState] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  if (!isOpen) return null;

  const handleToggle = (path: string) => {
    if (path === 'enabled') {
      onUpdateSettings({ ...settings, enabled: !settings.enabled });
    } else if (path === 'sound') {
      onUpdateSettings({ ...settings, sound: !settings.sound });
    } else if (path === 'vibrate') {
      onUpdateSettings({ ...settings, vibrate: !settings.vibrate });
    } else if (path === 'inAppToast') {
      onUpdateSettings({ ...settings, inAppToast: !settings.inAppToast });
    } else if (path.startsWith('events.')) {
      const eventKey = path.split('.')[1] as keyof NotificationSettings['events'];
      onUpdateSettings({
        ...settings,
        events: {
          ...settings.events,
          [eventKey]: !settings.events[eventKey],
        },
      });
    }
  };

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setBrowserPermState(permission);
        if (permission === 'granted') {
          onUpdateSettings({
            ...settings,
            browserNotifications: true,
          });
        }
      } catch {}
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-100 dark:bg-accent-950/50 text-accent-600 dark:text-cyan-300">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Notifications en direct
              </h2>
              <p className="text-xs text-slate-400">
                Personnalisez vos alertes sonores et visuelles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          
          <PushCard push={push} />

          {/* API-Football Status Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    apiStatus?.configured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="text-xs font-black tracking-wider uppercase text-slate-800 dark:text-slate-200">
                  Flux API-Football
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  apiStatus?.configured
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
              >
                {apiStatus?.configured ? 'En Direct' : 'Mode Démo Réaliste'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              {apiStatus?.configured
                ? 'Données et scores synchronisés avec le serveur officiel API-Football.'
                : 'Le backend est prêt. Pour brancher votre clé en direct, renseignez API_FOOTBALL_KEY dans votre fichier .env.'}
            </p>
          </div>

          {/* Master Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Activer toutes les alertes
              </p>
              <p className="text-xs text-slate-500">
                Recevez les notifications pour vos matchs et équipes suivis
              </p>
            </div>
            <button
              onClick={() => handleToggle('enabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.enabled ? 'bg-accent-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Section: Mode de notification */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Canaux d&apos;alerte
            </h3>

            {/* Son */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Sons de stade
                  </p>
                  <p className="text-xs text-slate-400">
                    Chime signature de but et sifflet d&apos;arbitre
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={() => handleToggle('sound')}
                className="w-4 h-4 accent-accent-600 rounded"
              />
            </div>

            {/* Bannières In-App */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Monitor className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Bannières visuelles en direct
                  </p>
                  <p className="text-xs text-slate-400">
                    Toasts animés en haut de l&apos;écran lors des buts
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.inAppToast}
                onChange={() => handleToggle('inAppToast')}
                className="w-4 h-4 accent-accent-600 rounded"
              />
            </div>

            {/* Vibrations */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Vibrations tactiles
                  </p>
                  <p className="text-xs text-slate-400">
                    Retours haptiques sur smartphones compatibles
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.vibrate}
                onChange={() => handleToggle('vibrate')}
                className="w-4 h-4 accent-accent-600 rounded"
              />
            </div>

            {/* Notifications du navigateur */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Notifications Web système
                  </p>
                  <p className="text-xs text-slate-400">
                    Même lorsque l&apos;onglet est en arrière-plan
                  </p>
                </div>
              </div>
              {browserPermState !== 'granted' ? (
                <button
                  onClick={requestBrowserPermission}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                >
                  Autoriser
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Activé
                </span>
              )}
            </div>
          </div>

          {/* Section: Événements déclencheurs */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Événements surveillés
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: 'goals', label: '⚽ Buts marqués' },
                { key: 'redCards', label: '🟥 Cartons rouges' },
                { key: 'kickoff', label: '⏱️ Coup d’envoi' },
                { key: 'halfTime', label: '⏸️ Mi-temps' },
                { key: 'fullTime', label: '🏁 Fin de match' },
                { key: 'var', label: '🖥️ Décisions VAR' },
              ].map((item) => {
                const isChecked = settings.events[item.key as keyof NotificationSettings['events']];
                return (
                  <button
                    key={item.key}
                    onClick={() => handleToggle(`events.${item.key}`)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors ${
                      isChecked
                        ? 'border-accent-300 bg-accent-50/50 dark:border-accent-900/60 dark:bg-accent-950/20 text-slate-900 dark:text-white font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="w-3.5 h-3.5 accent-accent-600 rounded"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Test Button */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                onTriggerTestAlert();
              }}
              className="w-full py-3 px-4 rounded-xl bg-accent-600 hover:bg-accent-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-accent-600/20 active:scale-98 transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>Tester une alerte de but en direct (Son + Toast)</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
