import React from 'react';
import { Logo } from './Logo';
import { Link, teamUrl } from '../router';
import { StatLine, TableGroup, teamLogoUrl } from '../services/football';

export type Scope = 'all' | 'home' | 'away';

interface Row {
  rank: number;
  teamId?: number;
  name: string;
  logo?: string;
  s: StatLine;
  pts: number;
  form: string;
  desc: string;
}

const zero: StatLine = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };

const descClass = (desc: string): string => {
  if (/relegat/i.test(desc)) return 'border-fuchsia-500';
  if (/caf champions|champions league|promotion/i.test(desc)) return 'border-accent-500';
  if (/conference|confederation/i.test(desc)) return 'border-emerald-500';
  if (/europa|qualif/i.test(desc)) return 'border-sky-400';
  return 'border-transparent';
};

const formChip: Record<string, string> = {
  W: 'bg-emerald-600 text-white',
  D: 'bg-slate-400 text-white',
  L: 'bg-fuchsia-600 text-white',
};

export function buildRows(group: TableGroup, scope: Scope): Row[] {
  const rows = group.rows.map((r) => {
    const s = r[scope] ?? r.all ?? zero;
    return { rank: r.rank, teamId: r.team.id, name: r.team.name, s, pts: scope === 'all' ? r.points : s.w * 3 + s.d, form: r.form, desc: r.desc } as Row;
  });
  if (scope !== 'all') {
    rows.sort((a, b) => b.pts - a.pts || b.s.gf - b.s.ga - (a.s.gf - a.s.ga) || b.s.gf - a.s.gf);
    rows.forEach((r, i) => (r.rank = i + 1));
  }
  return rows;
}

export const StandingsTable: React.FC<{ rows: Row[]; showLogos: boolean; showForm: boolean; highlight?: number[] }> = ({ rows, showLogos, showForm, highlight = [] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-white/10">
          <th className="py-2 pl-3 pr-1 text-left w-10">#</th>
          <th className="py-2 px-2 text-left">Équipe</th>
          <th className="py-2 px-1.5 text-center" title="Matchs joués">J</th>
          <th className="py-2 px-1.5 text-center hidden sm:table-cell" title="Victoires">V</th>
          <th className="py-2 px-1.5 text-center hidden sm:table-cell" title="Nuls">N</th>
          <th className="py-2 px-1.5 text-center hidden sm:table-cell" title="Défaites">D</th>
          <th className="py-2 px-1.5 text-center hidden sm:table-cell" title="Buts pour : contre">Buts</th>
          <th className="py-2 px-1.5 text-center" title="Différence de buts">+/-</th>
          <th className="py-2 px-2 text-center" title="Points">Pts</th>
          {showForm && <th className="py-2 px-2 text-center hidden md:table-cell">Forme</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.rank}-${r.name}`} className={`border-b border-slate-100 dark:border-white/5 hover:bg-slate-100/60 dark:hover:bg-white/[0.03] ${r.teamId && highlight.includes(r.teamId) ? 'bg-accent-500/10' : ''}`}>
            <td className={`py-2.5 pl-3 pr-1 border-l-4 ${descClass(r.desc)} font-bold tabular-nums text-slate-600 dark:text-slate-300`}>{r.rank}</td>
            <td className="py-2.5 px-2 min-w-[8rem]">
              {r.teamId ? (
                <Link to={teamUrl(r.teamId)} className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white hover:text-accent-600 dark:hover:text-cyan-300">
                  {showLogos && <Logo src={teamLogoUrl(r.teamId)} size={20} />}
                  <span className="truncate">{r.name}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                  {r.logo && <span aria-hidden="true">{r.logo}</span>}
                  <span className="truncate">{r.name}</span>
                </span>
              )}
            </td>
            <td className="py-2.5 px-1.5 text-center tabular-nums">{r.s.p}</td>
            <td className="py-2.5 px-1.5 text-center tabular-nums hidden sm:table-cell">{r.s.w}</td>
            <td className="py-2.5 px-1.5 text-center tabular-nums hidden sm:table-cell">{r.s.d}</td>
            <td className="py-2.5 px-1.5 text-center tabular-nums hidden sm:table-cell">{r.s.l}</td>
            <td className="py-2.5 px-1.5 text-center tabular-nums hidden sm:table-cell">{r.s.gf}:{r.s.ga}</td>
            <td className="py-2.5 px-1.5 text-center tabular-nums">{r.s.gf - r.s.ga > 0 ? '+' : ''}{r.s.gf - r.s.ga}</td>
            <td className="py-2.5 px-2 text-center tabular-nums font-black text-accent-600 dark:text-cyan-300">{r.pts}</td>
            {showForm && (
              <td className="py-2.5 px-2 hidden md:table-cell">
                <div className="flex justify-center gap-0.5">
                  {r.form.split('').slice(-5).map((c, i) => (
                    <span key={i} className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${formChip[c] ?? 'bg-slate-300'}`}>
                      {c}
                    </span>
                  ))}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

