import React, { useEffect, useRef, useState } from 'react';
import { Check, Link2, MessageCircle, Send, Share2 } from 'lucide-react';

interface ShareButtonProps {
  title: string;
  text?: string;
  /** Adresse à partager : chemin du site (« /match/123 ») ou adresse complète. Par défaut : la page courante. */
  path?: string;
  /** icon : bouton rond discret | pill : bouton avec texte | bar : bouton large (fin d'article, pied de page) */
  variant?: 'icon' | 'pill' | 'bar';
  label?: string;
  className?: string;
  /** Côté d'ouverture du menu (ordinateur) */
  align?: 'left' | 'right';
  size?: 'sm' | 'md';
  /** Pas de menu : partage natif, sinon copie directe du lien (pour les listes qui rognent les menus) */
  direct?: boolean;
  /** Le menu s'ouvre vers le haut (pied de page) */
  up?: boolean;
}

const absoluteUrl = (path?: string) => {
  try {
    return new URL(path ?? window.location.href, window.location.origin).toString();
  } catch {
    return window.location.href;
  }
};

const prefersNativeSheet = () => {
  try {
    return typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};

const Letter: React.FC<{ c: string }> = ({ c }) => (
  <span className="w-4 h-4 inline-flex items-center justify-center text-[13px] font-black leading-none" aria-hidden="true">{c}</span>
);

export const ShareButton: React.FC<ShareButtonProps> = ({ title, text, path, variant = 'icon', label = 'Partager', className = '', align = 'right', size = 'md', direct = false, up = false }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e instanceof MouseEvent && box.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const copy = async () => {
    const url = absoluteUrl(path);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = document.createElement('textarea');
      t.value = url;
      document.body.appendChild(t);
      t.select();
      try {
        document.execCommand('copy');
      } catch {
        /* copie impossible */
      }
      t.remove();
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 1400);
  };

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (prefersNativeSheet()) {
      try {
        await navigator.share({ title, text, url: absoluteUrl(path) });
      } catch {
        /* partage annulé */
      }
      return;
    }
    if (direct) {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text, url: absoluteUrl(path) });
        } catch {
          /* partage annulé */
        }
        return;
      }
      await copy();
      return;
    }
    setOpen((o) => !o);
  };

  const url = absoluteUrl(path);
  const message = text ? `${title} - ${text}` : title;
  const targets = [
    { name: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`, icon: <MessageCircle className="w-4 h-4" /> },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, icon: <Letter c="f" /> },
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`, icon: <Letter c="𝕏" /> },
    { name: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`, icon: <Send className="w-4 h-4" /> },
  ];

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const base =
    variant === 'icon'
      ? `${size === 'sm' ? 'p-1.5' : 'p-2'} rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition`
      : variant === 'pill'
        ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-300/70 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition'
        : 'inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-bold text-white fs-logo hover:brightness-110 transition';

  return (
    <div ref={box} className={`relative ${/\b(hidden|flex|block)\b/.test(className) ? '' : 'inline-block'} ${className}`}>
      <button type="button" onClick={onClick} className={base} aria-label={`${label} : ${title}`} aria-haspopup="menu" aria-expanded={open}>
        {copied ? <Check className={`${iconSize} text-emerald-500`} /> : <Share2 className={variant === 'icon' ? iconSize : 'w-4 h-4'} />}
        {variant !== 'icon' && <span>{copied ? 'Lien copié' : label}</span>}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-50 ${up ? 'bottom-full mb-2' : 'mt-2'} w-52 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl p-1.5 ${align === 'right' ? 'right-0' : 'left-0'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {targets.map((t) => (
            <a
              key={t.name}
              role="menuitem"
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              {t.icon} {t.name}
            </a>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={copy}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />} {copied ? 'Lien copié' : 'Copier le lien'}
          </button>
        </div>
      )}
    </div>
  );
};
