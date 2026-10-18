import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export const InstallButton: React.FC = () => {
  const { canInstall, install } = usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);

  if (!canInstall) return null;

  const handleClick = async () => {
    const result = await install();
    if (result === 'ios-help') setShowHelp(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-bold text-white fs-logo hover:brightness-110 transition"
        aria-label="Installer l'application"
        title="Installer l'application sur votre écran d'accueil"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Installer</span>
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl fs-card border p-5 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold">Installer sur iPhone / iPad</h3>
              <button onClick={() => setShowHelp(false)} aria-label="Fermer" className="p-1 text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="text-sm space-y-2 list-decimal pl-5 text-slate-600 dark:text-slate-300">
              <li>
                Ouvrez ce site dans <strong>Safari</strong>.
              </li>
              <li className="flex items-center gap-1.5">
                Touchez le bouton Partager <Share className="w-4 h-4 inline" />.
              </li>
              <li>
                Choisissez <strong>Sur l'écran d'accueil</strong>, puis <strong>Ajouter</strong>.
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
};
