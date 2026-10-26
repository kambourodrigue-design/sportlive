import React, { useEffect } from 'react';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { NewsArticle } from '../types';
import { Link, articleUrl, goBack } from '../router';
import { PageHeader } from '../components/DetailChrome';

interface ArticlePageProps {
  routeId: string;
  news: NewsArticle[];
  loaded: boolean;
}

const dateFr = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const Visual: React.FC<{ article: NewsArticle; className?: string }> = ({ article, className }) =>
  article.imageUrl ? (
    <img src={article.imageUrl} alt={article.title} referrerPolicy="no-referrer" className={className} />
  ) : (
    <div className={`${className ?? ''} bg-gradient-to-br from-violet-600/40 via-slate-800 to-cyan-500/30 flex items-center justify-center`}>
      <span className="text-[11px] font-black tracking-widest text-white/70 uppercase px-3 text-center">{article.category}</span>
    </div>
  );

export const ArticlePage: React.FC<ArticlePageProps> = ({ routeId, news, loaded }) => {
  const article = news.find((n) => n.id === routeId) ?? null;
  const own = routeId.startsWith('own-');

  useEffect(() => {
    if (!article) return;
    document.title = `${article.title} - ScoreAfrica`;
    const desc = document.querySelector('meta[name="description"]');
    const previous = desc?.getAttribute('content') ?? '';
    desc?.setAttribute('content', (article.summary || article.title).slice(0, 200));
    // Actualités reprises d'un flux externe : on ne demande pas à Google de les indexer (contenu de la source)
    let robots: HTMLMetaElement | null = null;
    if (!own) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      robots.content = 'noindex, follow';
      document.head.appendChild(robots);
    }
    return () => {
      desc?.setAttribute('content', previous);
      robots?.remove();
    };
  }, [article?.id]);

  if (!article) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        {loaded ? (
          <>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Article introuvable</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Cet article n'existe plus ou n'est plus affiché.</p>
            <Link to="/" className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-accent-600 text-white font-bold text-sm">Retour aux actualités</Link>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-slate-500" role="status"><Loader2 className="w-4 h-4 animate-spin" /> Chargement de l'article...</p>
        )}
      </div>
    );
  }

  const related = [...news.filter((n) => n.id !== article.id && n.category === article.category), ...news.filter((n) => n.id !== article.id && n.category !== article.category)].slice(0, 4);
  const published = dateFr(article.publishedAt);

  return (
    <div className="max-w-3xl mx-auto md:py-4">
      <PageHeader sport="Actualités" shareTitle={article.title} />

      <article className="md:rounded-3xl md:border border-slate-200/70 dark:border-white/10 fs-surface md:shadow-xl pb-6">
        <button onClick={() => goBack('/')} className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white px-5 pt-3">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <div className="px-4 sm:px-6 pt-4">
          <span className="inline-block px-2.5 py-1 rounded-md bg-accent-600 text-white text-[11px] font-black uppercase tracking-wider">{article.category}</span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">{article.title}</h1>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{article.author}</span>
            {published && <> · {published}</>}
          </p>
        </div>

        {article.imageUrl && (
          <div className="mt-4 sm:mx-6 sm:rounded-2xl overflow-hidden aspect-16/9 bg-slate-100 dark:bg-slate-800">
            <Visual article={article} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="px-4 sm:px-6 mt-5 space-y-4 text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
          {article.summary && own && <p className="font-semibold text-slate-900 dark:text-white">{article.summary}</p>}
          {article.content.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {article.sourceUrl && (
          <div className="px-4 sm:px-6 mt-6">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Extrait publié par {article.sourceName ?? 'la source'}. L'article complet est sur son site.</p>
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-bold text-white fs-logo hover:brightness-110 transition"
            >
              Lire l'article complet sur {article.sourceName ?? 'le site source'} <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {related.length > 0 && (
          <section className="mt-8" aria-label="À lire aussi">
            <h2 className="px-4 sm:px-6 py-2 text-[12px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-white/[0.05]">À lire aussi</h2>
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {related.map((r) => (
                <li key={r.id}>
                  <Link to={articleUrl(r)} className="flex gap-3 px-4 sm:px-6 py-3 hover:bg-slate-100/60 dark:hover:bg-white/[0.04]">
                    <div className="w-24 h-16 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
                      <Visual article={r} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-accent-600 dark:text-cyan-300 uppercase tracking-wider">{r.category}</span>
                      <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{r.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{r.timeAgo}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
};
