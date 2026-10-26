import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { adminRequest } from '../services/articles';

interface Summary {
  series: { date: string; views: number; visitors: number }[];
  today: { date: string; views: number; visitors: number };
  last7: { views: number; visitors: number };
  period: { views: number; visitors: number };
  pages: { key: string; views: number }[];
  countries: { key: string; views: number }[];
  devices: { key: string; views: number }[];
  refs: { key: string; views: number }[];
  hours: number[];
}

const nf = new Intl.NumberFormat('fr-FR');
let regionNames: Intl.DisplayNames | null = null;
try {
  regionNames = new Intl.DisplayNames(['fr'], { type: 'region' });
} catch {
  /* noms de pays indisponibles */
}
const country = (c: string) => {
  if (c === 'XX' || c === '(autres)') return 'Inconnu';
  try {
    return regionNames?.of(c) ?? c;
  } catch {
    return c;
  }
};
const pageLabel = (p: string) =>
  p === '/' ? 'Accueil' : p === '/match/*' ? 'Pages match' : p === '/equipe/*' ? 'Pages équipe' : p.startsWith('/championnat/') ? `Championnat ${p.slice(13)}` : p.startsWith('/actualites/') ? `Article ${decodeURIComponent(p.slice(12)).slice(0, 24)}` : p;

const Card: React.FC<{ label: string; views: number; visitors: number }> = ({ label, views, visitors }) => (
  <div className="rounded-2xl fs-card border p-3">
    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</p>
    <p className="text-2xl font-black tabular-nums mt-0.5">{nf.format(visitors)}</p>
    <p className="text-[11px] text-slate-500 dark:text-slate-400">visiteurs · {nf.format(views)} pages vues</p>
  </div>
);

const Table: React.FC<{ title: string; rows: { key: string; views: number }[]; label?: (k: string) => string }> = ({ title, rows, label = (k) => k }) => {
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <div className="rounded-2xl fs-card border p-3">
      <h3 className="text-xs font-bold mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Pas encore de données.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="truncate">{label(r.key)}</span>
                <span className="tabular-nums font-semibold">{nf.format(r.views)}</span>
              </div>
              <div className="h-1 rounded-full bg-slate-200/70 dark:bg-white/10 mt-0.5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-accent-500 to-cyan-400" style={{ width: `${(r.views / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const AdminStats: React.FC = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await adminRequest<Summary>(`/api/admin/stats?days=${days}`);
    if (r.ok) {
      setData(r.data);
      setError('');
    } else setError(r.error ?? 'Statistiques indisponibles.');
  }, [days]);

  useEffect(() => {
    setData(null);
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const max = Math.max(1, ...(data?.series.map((d) => d.views) ?? [1]));

  return (
    <section aria-label="Statistiques de visites" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-300" /> Visites
        </h2>
        <div className="flex gap-1" role="group" aria-label="Période">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${days === d ? 'bg-accent-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
            >
              {d} j
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-fuchsia-600 dark:text-fuchsia-300" role="alert">{error}</p>}
      {!data && !error && (
        <p className="flex items-center gap-2 text-xs text-slate-500" role="status"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement...</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Card label="Aujourd'hui" views={data.today.views} visitors={data.today.visitors} />
            <Card label="7 jours" views={data.last7.views} visitors={data.last7.visitors} />
            <Card label={`${days} jours`} views={data.period.views} visitors={data.period.visitors} />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Les visiteurs sont comptés par jour (empreinte anonyme sans cookie) : sur plusieurs jours, un même visiteur est compté chaque jour où il vient.
          </p>

          <div className="rounded-2xl fs-card border p-3">
            <h3 className="text-xs font-bold mb-2">Pages vues par jour</h3>
            <div className="flex items-end gap-[2px] h-24" role="img" aria-label="Pages vues par jour">
              {data.series.map((d) => (
                <div
                  key={d.date}
                  title={`${new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${nf.format(d.views)} pages vues, ${nf.format(d.visitors)} visiteurs`}
                  className="flex-1 rounded-t bg-gradient-to-t from-accent-600 to-cyan-400 min-h-[2px]"
                  style={{ height: `${Math.max(2, (d.views / max) * 100)}%`, opacity: d.views ? 1 : 0.25 }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              <span>{new Date(data.series[0]?.date ?? '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              <span>Aujourd'hui</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <Table title="Pages les plus vues" rows={data.pages} label={pageLabel} />
            <Table title="Pays" rows={data.countries} label={country} />
            <Table title="Appareils" rows={data.devices} />
            <Table title="Provenance" rows={data.refs} />
          </div>
        </>
      )}
    </section>
  );
};
