import React, { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { ALL_COMPETITIONS } from '../data/mockData';
import { Link, leagueUrl } from '../router';
import { Logo } from './Logo';
import { AfricanLeague, CATALOGUE_TO_API_ID, leagueLogoUrl } from '../services/football';
import { flagFromCode, frCountry } from '../utils/africa';

// Repli si la liste des compétitions africaines n'a pas pu être chargée depuis l'API
const FALLBACK_AFRICA: AfricanLeague[] = [
  { id: 6, name: "Coupe d'Afrique des Nations", country: 'Afrique', code: null, continental: true, season: 0 },
  { id: 12, name: 'CAF Champions League', country: 'Afrique', code: null, continental: true, season: 0 },
  { id: 20, name: 'CAF Confederation Cup', country: 'Afrique', code: null, continental: true, season: 0 },
];

interface Entry {
  key: string;
  to: string;
  name: string;
  country: string;
  flag: string;
  logoId?: number;
}

interface StandingsSectionProps {
  africanLeagues: AfricanLeague[];
  apiConfigured: boolean;
}

export const StandingsSection: React.FC<StandingsSectionProps> = ({ africanLeagues, apiConfigured }) => {
  const [query, setQuery] = useState('');

  const africa: Entry[] = (africanLeagues.length ? africanLeagues : FALLBACK_AFRICA).map((l) => ({
    key: `af-${l.id}`,
    to: leagueUrl(l.id),
    name: l.name,
    country: l.continental ? 'Afrique' : frCountry(l.country),
    flag: l.continental ? '🌍' : flagFromCode(l.code ?? undefined),
    logoId: l.id,
  }));

  const popular: Entry[] = ALL_COMPETITIONS.filter((c) => c.category === 'COMPÉTITIONS FAVORITES').map((c) => ({
    key: c.id,
    to: leagueUrl(c.id),
    name: c.name,
    country: c.country,
    flag: c.flag,
    logoId: CATALOGUE_TO_API_ID[c.id],
  }));

  const q = query.trim().toLowerCase();
  const match = (e: Entry) => !q || e.name.toLowerCase().includes(q) || e.country.toLowerCase().includes(q);
  const sections = [
    { title: 'Afrique', items: africa.filter(match) },
    { title: 'Compétitions populaires', items: popular.filter(match) },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4">
      <div className="px-2 pb-3">
        <h1 className="text-lg font-black text-slate-900 dark:text-white">Championnats et classements</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choisis une compétition pour voir ses matchs, son classement et ses buteurs.</p>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un championnat..."
          aria-label="Rechercher un championnat ou un pays"
          className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500/60"
        />
      </div>

      {sections.length === 0 && <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Aucune compétition trouvée.</p>}

      {sections.map((s) => (
        <section key={s.title} className="mb-5 fs-card rounded-2xl border overflow-hidden">
          <h2 className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-white/[0.03] border-b border-slate-200/60 dark:border-white/5">
            {s.title}
          </h2>
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {s.items.map((e) => (
              <li key={e.key}>
                <Link to={e.to} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100/70 dark:hover:bg-white/[0.04] group">
                  <Logo src={apiConfigured && e.logoId ? leagueLogoUrl(e.logoId) : undefined} fallback={e.flag} size={28} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">{e.country}</span>
                    <span className="block text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-accent-600 dark:group-hover:text-cyan-300">{e.name}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
