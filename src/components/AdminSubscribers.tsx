import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search, Users, X } from 'lucide-react';
import { adminRequest } from '../services/articles';

interface Sub {
  email: string;
  name: string;
  createdAt: string;
  trialEndsAt: number | null;
  premiumUntil: number | null;
  status: 'trial' | 'premium' | 'expired';
}
interface Claim {
  email: string;
  name: string;
  note: string;
  createdAt: string;
}
interface Settings {
  link: string;
  price: number;
  days: number;
}
interface Data {
  items: Sub[];
  claims: Claim[];
  settings: Settings;
  trialDays: number;
}

const nf = new Intl.NumberFormat('fr-FR');
const dFr = (ms: number | string | null) => (ms ? new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');

const field =
  'w-full rounded-xl px-3 py-2 text-sm bg-white/80 dark:bg-white/[0.06] border border-slate-300/70 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400';
const btn =
  'rounded-lg px-2.5 py-1.5 text-[11px] font-bold border border-slate-300/70 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition disabled:opacity-50';

const BADGE: Record<Sub['status'], { label: string; cls: string }> = {
  premium: { label: 'Abonné', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  trial: { label: 'Essai', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  expired: { label: 'Expiré', cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
};

export const AdminSubscribers: React.FC = () => {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | Sub['status']>('all');
  const [grantEmail, setGrantEmail] = useState('');
  const [grantDays, setGrantDays] = useState('');
  const [link, setLink] = useState('');
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('');
  const filled = useRef(false); // les champs de réglages ne sont remplis qu'une fois (l'actualisation automatique ne doit pas écraser une saisie)

  const load = useCallback(async () => {
    const r = await adminRequest<Data>('/api/admin/subscribers');
    if (!r.ok) return setError(r.error ?? 'Abonnés indisponibles.');
    setError('');
    setData(r.data);
    if (!filled.current) {
      filled.current = true;
      setLink(r.data.settings.link);
      setPrice(String(r.data.settings.price));
      setDays(String(r.data.settings.days));
      setGrantDays(String(r.data.settings.days));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  async function act(key: string, path: string, body: unknown, okText: string) {
    setBusy(key);
    setMsg(null);
    const r = await adminRequest(path, 'POST', body);
    setBusy(null);
    setMsg({ ok: r.ok, text: r.ok ? okText : r.error ?? 'Action impossible.' });
    if (r.ok) await load();
    return r.ok;
  }

  const grant = (email: string, d: number) => act(`g-${email}-${d}`, '/api/admin/subscribers/grant', { email, days: d }, `+${d} jours pour ${email}.`);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.items ?? []).filter((s) => (filter === 'all' || s.status === filter) && (!q || s.email.includes(q) || s.name.toLowerCase().includes(q)));
  }, [data, query, filter]);

  const counts = useMemo(() => {
    const c = { premium: 0, trial: 0, expired: 0 };
    for (const s of data?.items ?? []) c[s.status]++;
    return c;
  }, [data]);

  const defaultDays = data?.settings.days ?? 30;

  return (
    <section aria-label="Abonnés" className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-300" /> Abonnés
      </h2>

      {error && <p className="text-xs text-fuchsia-600 dark:text-fuchsia-300" role="alert">{error}</p>}
      {!data && !error && <p className="flex items-center gap-2 text-xs text-slate-500" role="status"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement...</p>}
      {msg && (
        <p
          role={msg.ok ? 'status' : 'alert'}
          className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300'}`}
        >
          {msg.text}
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(['premium', 'trial', 'expired'] as const).map((k) => (
              <div key={k} className="rounded-2xl fs-card border p-3">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{k === 'premium' ? 'Abonnés' : k === 'trial' ? 'En essai' : 'Expirés'}</p>
                <p className="text-2xl font-black tabular-nums">{nf.format(counts[k])}</p>
              </div>
            ))}
          </div>

          {/* Demandes « J'ai payé » */}
          <div className="rounded-2xl fs-card border p-3.5 space-y-2">
            <h3 className="text-xs font-bold">Paiements à vérifier ({data.claims.length})</h3>
            {data.claims.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Aucune demande. Les clients qui cliquent sur « J'ai payé » apparaissent ici.</p>
            ) : (
              <ul className="space-y-2">
                {data.claims.map((c) => (
                  <li key={c.email} className="rounded-xl border border-slate-200/70 dark:border-white/10 p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{c.name}</p>
                        <p className="text-xs text-cyan-700 dark:text-cyan-300 break-all">{c.email}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{new Date(c.createdAt).toLocaleString('fr-FR')}</span>
                    </div>
                    {c.note && <p className="text-xs break-words">Paiement : {c.note}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button className={`${btn} inline-flex items-center gap-1`} disabled={busy !== null} onClick={() => grant(c.email, defaultDays)}>
                        <Check className="w-3.5 h-3.5" /> Activer {defaultDays} jours
                      </button>
                      <button
                        className={`${btn} inline-flex items-center gap-1`}
                        disabled={busy !== null}
                        onClick={() => act(`d-${c.email}`, '/api/admin/subscribers/dismiss', { email: c.email }, 'Demande ignorée.')}
                      >
                        <X className="w-3.5 h-3.5" /> Ignorer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Ajouter un abonnement à la main */}
          <form
            className="rounded-2xl fs-card border p-3.5 space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await grant(grantEmail.trim().toLowerCase(), parseInt(grantDays, 10))) setGrantEmail('');
            }}
          >
            <h3 className="text-xs font-bold">Activer un abonnement</h3>
            <div className="grid grid-cols-[1fr_5.5rem_auto] gap-2">
              <input className={field} type="email" required placeholder="E-mail du compte" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} aria-label="E-mail du compte" />
              <input className={field} type="number" min={1} max={3650} required value={grantDays} onChange={(e) => setGrantDays(e.target.value)} aria-label="Nombre de jours" />
              <button className={`${btn} px-3`} type="submit" disabled={busy !== null}>
                Ajouter
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Les jours s'ajoutent à l'abonnement en cours. Fonctionne même si le compte n'apparaît pas encore dans la liste.</p>
          </form>

          {/* Liste */}
          <div className="rounded-2xl fs-card border p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[10rem]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${field} pl-8`} placeholder="Rechercher un nom ou un e-mail" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher" />
              </div>
              <div className="flex gap-1" role="group" aria-label="Filtre">
                {(['all', 'premium', 'trial', 'expired'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    aria-pressed={filter === k}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${filter === k ? 'bg-accent-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    {k === 'all' ? 'Tous' : BADGE[k].label}
                  </button>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Aucun compte à afficher. Les comptes apparaissent ici à leur inscription ou à leur prochaine connexion.</p>
            ) : (
              <ul className="space-y-2">
                {rows.slice(0, 100).map((s) => (
                  <li key={s.email} className="rounded-xl border border-slate-200/70 dark:border-white/10 p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{s.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 break-all">{s.email}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold ${BADGE[s.status].cls}`}>{BADGE[s.status].label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Inscrit le {dFr(s.createdAt)}
                      {s.status === 'premium' && <> · abonnement jusqu'au {dFr(s.premiumUntil)}</>}
                      {s.status === 'trial' && <> · essai jusqu'au {dFr(s.trialEndsAt)}</>}
                      {s.status === 'expired' && s.premiumUntil ? <> · abonnement terminé le {dFr(s.premiumUntil)}</> : null}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[7, defaultDays].filter((d, i, a) => a.indexOf(d) === i).map((d) => (
                        <button key={d} className={btn} disabled={busy !== null} onClick={() => grant(s.email, d)}>
                          +{d} jours
                        </button>
                      ))}
                      {s.status !== 'expired' && (
                        <button
                          className={`${btn} text-fuchsia-600 dark:text-fuchsia-300`}
                          disabled={busy !== null}
                          onClick={() => {
                            if (window.confirm(`Retirer l'accès aux pronostics de ${s.email} ?`)) act(`r-${s.email}`, '/api/admin/subscribers/revoke', { email: s.email }, `Accès retiré pour ${s.email}.`);
                          }}
                        >
                          Retirer l'accès
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {rows.length > 100 && <p className="text-[11px] text-slate-500">100 premiers résultats affichés : utilise la recherche pour affiner.</p>}
          </div>

          {/* Réglages */}
          <form
            className="rounded-2xl fs-card border p-3.5 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              act('settings', '/api/admin/pay-settings', { link, price: Number(price), days: Number(days) }, 'Réglages enregistrés.');
            }}
          >
            <h3 className="text-xs font-bold">Lien de paiement et tarif</h3>
            <div>
              <label htmlFor="pay-link" className="block text-[11px] font-semibold mb-1">Lien de paiement (https://...)</label>
              <input id="pay-link" className={field} type="url" placeholder="https://..." value={link} onChange={(e) => setLink(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="pay-price" className="block text-[11px] font-semibold mb-1">Prix (FCFA)</label>
                <input id="pay-price" className={field} type="number" min={1} required value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <label htmlFor="pay-days" className="block text-[11px] font-semibold mb-1">Durée (jours)</label>
                <input id="pay-days" className={field} type="number" min={1} max={3650} required value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Sans lien, les pronostics restent ouverts à tous les comptes. Dès qu'un lien est enregistré, l'essai gratuit de {data.trialDays} jours s'applique, puis l'abonnement est exigé.
            </p>
            <button type="submit" className={`${btn} px-3 py-2`} disabled={busy !== null}>
              {busy === 'settings' ? '...' : 'Enregistrer'}
            </button>
          </form>
        </>
      )}
    </section>
  );
};
