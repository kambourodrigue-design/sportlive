import React, { useState } from 'react';
import { Clock, Eye, Share2, X, ChevronRight } from 'lucide-react';
import { NewsArticle } from '../types';

interface NewsSectionProps {
  news: NewsArticle[];
}

export const NewsSection: React.FC<NewsSectionProps> = ({ news }) => {
  const [activeCategory, setActiveCategory] = useState<string>('TOUS');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  const categories = ['TOUS', 'FOOTBALL', 'LIGUE 1', 'LALIGA', 'EUROPE'];

  const filteredNews = news.filter((item) => {
    if (activeCategory === 'TOUS') return true;
    return item.category.toUpperCase() === activeCategory;
  });

  const featured = filteredNews[0] || news[0];
  const others = filteredNews.slice(1);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-6">
      
      {/* Category Pills (Matching Screenshot 5) */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Featured Big News Item */}
      {featured && (
        <div
          onClick={() => setSelectedArticle(featured)}
          className="group relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:shadow-md transition-all"
        >
          <div className="relative aspect-16/9 md:aspect-21/9 overflow-hidden bg-slate-100 dark:bg-slate-800">
            <img
              src={featured.imageUrl}
              alt={featured.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            
            <div className="absolute top-4 left-4">
              <span className="px-2.5 py-1 rounded-md bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">
                {featured.category}
              </span>
            </div>

            <div className="absolute bottom-4 left-4 right-4 text-white">
              <div className="flex items-center gap-2 text-xs text-slate-300 mb-1.5">
                <span>{featured.author}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {featured.timeAgo}
                </span>
              </div>

              <h2 className="text-lg sm:text-2xl font-extrabold leading-snug drop-shadow-sm group-hover:text-red-300 transition-colors">
                {featured.title}
              </h2>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
              {featured.summary}
            </p>
            <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {featured.views.toLocaleString()} lectures
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                Lire l&apos;article complet <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Secondary Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {others.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedArticle(item)}
            className="group flex flex-col sm:flex-row gap-3.5 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-md cursor-pointer transition-all"
          >
            <div className="w-full sm:w-44 aspect-16/9 sm:aspect-auto rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
              <img
                src={item.imageUrl}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            <div className="flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                  {item.category}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-2 mt-0.5">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                  {item.summary}
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2">
                <span>{item.timeAgo}</span>
                <span>·</span>
                <span>{item.author}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full Article Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Top Bar */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-red-600 uppercase">
                Flashscore Actualités · {selectedArticle.category}
              </span>
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                {selectedArticle.title}
              </h1>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedArticle.author}</span>
                <span>·</span>
                <span>{selectedArticle.timeAgo}</span>
                <span>·</span>
                <span>{selectedArticle.views.toLocaleString()} vues</span>
              </div>

              <div className="rounded-xl overflow-hidden aspect-16/9 bg-slate-100">
                <img
                  src={selectedArticle.imageUrl}
                  alt={selectedArticle.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {selectedArticle.content.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
