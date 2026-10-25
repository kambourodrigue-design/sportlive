import React from 'react';
import { X, Bell, Trash2, CheckCheck, Volume2 } from 'lucide-react';
import { NotificationItem } from '../types';
import { soundManager } from '../utils/sound';

interface NotificationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onClearAll: () => void;
  onMarkAllAsRead: () => void;
  onSelectMatchById: (matchId: string) => void;
}

export const NotificationHistoryModal: React.FC<NotificationHistoryModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onClearAll,
  onMarkAllAsRead,
  onSelectMatchById,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-accent-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Historique des alertes ({notifications.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between px-5 py-2 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-xs">
            <button
              onClick={onMarkAllAsRead}
              className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-accent-600"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Tout marquer comme lu</span>
            </button>
            <button
              onClick={onClearAll}
              className="flex items-center gap-1 text-slate-400 hover:text-accent-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Effacer</span>
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="p-3 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 flex-1">
          {notifications.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Aucune alerte récente
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Les buts, cartons rouges et événements majeurs de vos matchs apparaîtront ici en direct.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectMatchById(item.matchId);
                  onClose();
                }}
                className="py-3 px-2 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors"
              >
                <div className="p-2 rounded-xl bg-accent-50 dark:bg-accent-950/40 text-accent-600 shrink-0 mt-0.5">
                  <span className="text-sm font-bold">
                    {item.type === 'GOAL' ? '⚽' : item.type === 'RED_CARD' ? '🟥' : '⏱️'}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums shrink-0 ml-2">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {item.message}
                  </p>
                  <p className="text-[10px] font-medium text-slate-400 mt-1">
                    {item.matchTitle}
                  </p>
                </div>

                {/* Replay sound */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.type === 'GOAL') soundManager.playGoalSound();
                    else soundManager.playWhistle();
                  }}
                  className="p-1 text-slate-400 hover:text-accent-600 self-center"
                  title="Rejouer le son"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
