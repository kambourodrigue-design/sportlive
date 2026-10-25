import React from 'react';
import { X, Volume2, ArrowRight } from 'lucide-react';
import { NotificationItem } from '../types';

interface LiveToastProps {
  notification: NotificationItem | null;
  onDismiss: () => void;
  onSelectMatch: (matchId: string) => void;
}

export const LiveToast: React.FC<LiveToastProps> = ({
  notification,
  onDismiss,
  onSelectMatch,
}) => {
  if (!notification) return null;

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 pointer-events-auto animate-slide-down">
      <div 
        onClick={() => {
          onSelectMatch(notification.matchId);
          onDismiss();
        }}
        className="bg-slate-900/95 dark:bg-black/95 text-white backdrop-blur-xl rounded-2xl p-4 shadow-[0_0_32px_-4px_rgba(34,211,238,0.55)] border border-accent-500/70 cursor-pointer hover:border-accent-400 transition-all flex items-start gap-3.5"
      >
        {/* Glow indicator */}
        <div className="p-2.5 rounded-xl bg-accent-600/30 text-accent-400 shrink-0 border border-accent-500/40">
          <span className="text-xl">
            {notification.type === 'GOAL' ? '⚽' : notification.type === 'RED_CARD' ? '🟥' : '🔔'}
          </span>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-wider text-accent-400 uppercase">
              ALERTE EN DIRECT
            </span>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Volume2 className="w-3.5 h-3.5" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="p-1 -mr-1 hover:text-white"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <h4 className="text-sm font-extrabold text-white mt-0.5 truncate">
            {notification.title}
          </h4>

          <p className="text-xs text-slate-300 mt-1 line-clamp-2">
            {notification.message}
          </p>

          <div className="flex items-center gap-1 text-[11px] font-bold text-accent-400 mt-2">
            <span>Ouvrir le match</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
};
