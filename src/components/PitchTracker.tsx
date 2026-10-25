import React from 'react';
import { MapPin, ShieldAlert } from 'lucide-react';
import { Match } from '../types';

// Terrain 2D animé : simulation, uniquement pour les matchs de démonstration
export const PitchTracker: React.FC<{ match: Match }> = ({ match }) => (
  <div className="space-y-4 p-4">
    <div className="relative w-full aspect-16/9 bg-gradient-to-br from-emerald-800 to-emerald-950 rounded-xl overflow-hidden border border-emerald-700/50 shadow-inner flex items-center justify-center">
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[repeating-linear-gradient(90deg,transparent,transparent_30px,rgba(255,255,255,0.08)_30px,rgba(255,255,255,0.08)_60px)]" />
      <div className="absolute inset-3 border border-white/40 rounded-sm">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/40 -translate-x-1/2" />
        <div className="absolute left-1/2 top-1/2 w-16 h-16 sm:w-20 sm:h-20 border border-white/40 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 bg-white/80 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute left-0 top-1/4 bottom-1/4 w-12 sm:w-16 border-r border-y border-white/40" />
        <div className="absolute right-0 top-1/4 bottom-1/4 w-12 sm:w-16 border-l border-y border-white/40" />
      </div>
      {match.pitchLive && (
        <div
          className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 pointer-events-none z-10"
          style={{ left: `${match.pitchLive.ballPosition.x}%`, top: `${match.pitchLive.ballPosition.y}%` }}
        >
          <span className="absolute inset-0 rounded-full bg-amber-400/60 animate-ping" />
          <span className="relative block w-5 h-5 bg-white text-black rounded-full shadow-lg border border-slate-900 text-[10px] text-center font-black">⚽</span>
        </div>
      )}
      <div className="absolute bottom-4 left-4 right-4 bg-slate-950/80 backdrop-blur-md rounded-lg p-2.5 flex items-center justify-between text-white text-xs border border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
          <span className="font-bold">{match.pitchLive?.phase || 'En cours de jeu'}</span>
        </div>
        <span className="text-[11px] text-slate-300">{match.pitchLive?.attackingTeam === 'home' ? match.homeTeam.name : match.awayTeam.name}</span>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-slate-400" />
        <div className="min-w-0">
          <p className="text-slate-400 text-[10px] uppercase font-bold">Stade</p>
          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{match.stadium || 'Stade Municipal'}</p>
        </div>
      </div>
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-slate-400" />
        <div className="min-w-0">
          <p className="text-slate-400 text-[10px] uppercase font-bold">Arbitre</p>
          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{match.referee || 'Arbitre FIFA'}</p>
        </div>
      </div>
    </div>
  </div>
);
