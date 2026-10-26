import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, LogOut, Plus, ArrowLeft, Trash2, Eye } from 'lucide-react';
import { AdminStats } from './AdminStats';
import { AdminQuota } from './AdminQuota';
import { adminRequest, clearAdminToken, getAdminToken, setAdminToken, OwnArticle } from '../services/articles';

const CATEGORIES = ['FOOTBALL', 'MERCATO', 'EUROPE', 'AFRIQUE', 'BASKET', 'TENNIS', 'AUTRE'];
const TONES = ['Informatif', 'Analyse', 'Brève'];
const TO_VERIFY = '[À VÉRIFIER';

interface Draft {
  id?: string;
  title: string;
  summary: string;
  text: string; // paragraphes séparés par une ligne vide
  category: string;
  imageUrl: string;
}

const emptyDraft: Draft = { title: '', summary: '', text: '', category: 'FOOTBALL', imageUrl: '' };
const toParagraphs = (text: string) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

const field =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-white/80 dark:bg-white/[0.06] border border-slate-300/70 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400';
const primary = 'fs-logo text-white font-bold rounded-xl px-4 py-2.5 text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed';
const secondary =
  'rounded-xl px-3 py-2 text-xs font-semibold border border-slate-300/70 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition disabled:opacity-50';

const AdminPanel: React.FC = () => {
  const [authed, setAuthed] = useState<boolean>(() => !!getAdminToken());
  const [password, setPassword] = useState('');
  const [articles, setArticles] = useState<OwnArticle[]>([]);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [tone, setTone] = useState('Informatif');
  const [titleIdeas, setTitleIdeas] = useState<string[]>([]);
  const [messages, setMessages] = useState<{ id: string; name: string; email: string; message: string; createdAt: string }[]>([]);

  const loadMessages = useCallback(async () => {
    const r = await adminRequest<{ items: typeof messages }>('/api/admin/messages');
    if (r.ok) setMessages(r.data.items ?? []);
  }, []);

  async function deleteMessage(id: string) {
    if (!window.confirm('Supprimer ce message ?')) return;
    const r = await adminRequest('/api/admin/messages/delete', 'POST', { id });
    if (r.ok) setMessages((m) => m.filter((x) => x.id !== id));
  }

  // Thème identique au site, page non indexée
  useEffect(() => {
    document.title = 'Rédaction';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    const saved = localStorage.getItem('fs_theme');
    document.documentElement.classList.toggle('dark', saved ? saved === 'dark' : true);
    return () => {
      robots.remove();
    };
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    setAuthed(false);
    setArticles([]);
  }, []);

  const loadArticles = useCallback(async () => {
    const r = await adminRequest<{ items: OwnArticle[] }>('/api/admin/articles');
    if (r.status === 401) {
      setAuthed(false);
      setMsg({ type: 'err', text: r.error ?? 'Session expirée.' });
      return;
    }
    if (r.ok) setArticles(r.data.items ?? []);
    else setMsg({ type: 'err', text: r.error ?? 'Chargement impossible.' });
  }, []);

  useEffect(() => {
    if (authed) {
      loadArticles();
      loadMessages();
    }
  }, [authed, loadArticles, loadMessages]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy('login');
    setMsg(null);
    const r = await adminRequest<{ token: string }>('/api/admin/login', 'POST', { password });
    setBusy(null);
    if (r.ok && r.data.token) {
      setAdminToken(r.data.token);
      setPassword('');
      setAuthed(true);
    } else {
      setMsg({ type: 'err', text: r.error ?? 'Connexion impossible.' });
    }
  }

  function openEditor(a?: OwnArticle) {
    setMsg(null);
    setTitleIdeas([]);
    setTopic('');
    setNotes('');
    setDraft(
      a
        ? { id: a.id, title: a.title, summary: a.summary, text: a.content.join('\n\n'), category: a.category, imageUrl: a.imageUrl ?? '' }
        : emptyDraft,
    );
    setView('edit');
  }

  const hasToVerify = [draft.title, draft.summary, draft.text].some((t) => t.includes(TO_VERIFY));

  async function generate() {
    setBusy('draft');
    setMsg(null);
    const r = await adminRequest<{ title: string; summary: string; paragraphs: string[] }>('/api/admin/ai/draft', 'POST', {
      category: draft.category,
      topic,
      tone,
      notes,
    });
    setBusy(null);
    if (!r.ok) return setMsg({ type: 'err', text: r.error ?? "Échec de l'IA." });
    setDraft((d) => ({ ...d, title: r.data.title, summary: r.data.summary, text: r.data.paragraphs.join('\n\n') }));
    setMsg({ type: 'ok', text: "Brouillon généré. Relis tout et vérifie chaque fait avant de publier ; remplace les « [À VÉRIFIER] »." });
  }

  async function improve(mode: 'rewrite' | 'shorten' | 'proofread' | 'titles') {
    setBusy(mode);
    setMsg(null);
    const r = await adminRequest<{ paragraphs?: string[]; titles?: string[] }>('/api/admin/ai/improve', 'POST', {
      mode,
      title: draft.title,
      content: toParagraphs(draft.text),
    });
    setBusy(null);
    if (!r.ok) return setMsg({ type: 'err', text: r.error ?? "Échec de l'IA." });
    if (mode === 'titles') setTitleIdeas(r.data.titles ?? []);
    else if (r.data.paragraphs) setDraft((d) => ({ ...d, text: r.data.paragraphs!.join('\n\n') }));
  }

  async function save(status: 'draft' | 'published') {
    setBusy('save');
    setMsg(null);
    const r = await adminRequest('/api/admin/articles', 'POST', {
      id: draft.id,
      title: draft.title,
      summary: draft.summary,
      content: toParagraphs(draft.text),
      category: draft.category,
      imageUrl: draft.imageUrl,
      status,
    });
    setBusy(null);
    if (!r.ok) {
      if (r.status === 401) setAuthed(false);
      return setMsg({ type: 'err', text: r.error ?? 'Enregistrement impossible.' });
    }
    await loadArticles();
    setView('list');
    setMsg({ type: 'ok', text: status === 'published' ? 'Article publié : il apparaît dans Actualités.' : 'Brouillon enregistré.' });
  }

  async function togglePublish(a: OwnArticle) {
    const r = await adminRequest('/api/admin/articles', 'POST', { ...a, status: a.status === 'published' ? 'draft' : 'published' });
    if (!r.ok) setMsg({ type: 'err', text: r.error ?? 'Action impossible.' });
    else await loadArticles();
  }

  async function remove(a: OwnArticle) {
    if (!window.confirm(`Supprimer « ${a.title} » ? Cette action est définitive.`)) return;
    const r = await adminRequest('/api/admin/articles/delete', 'POST', { id: a.id });
    if (!r.ok) setMsg({ type: 'err', text: r.error ?? 'Suppression impossible.' });
    else await loadArticles();
  }

  const shell = 'min-h-screen fs-bg text-slate-900 dark:text-slate-100 font-sans';

  const banner = msg && (
    <p
      role={msg.type === 'err' ? 'alert' : 'status'}
      className={`rounded-xl px-3 py-2 text-sm ${
        msg.type === 'err' ? 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      }`}
    >
      {msg.text}
    </p>
  );

  // ---------- Connexion ----------
  if (!authed) {
    return (
      <div className={`${shell} flex items-center justify-center p-4`}>
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl fs-card border p-5 space-y-4">
          <h1 className="text-lg font-bold">Rédaction</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Accès réservé. Entre le mot de passe administrateur.</p>
          <div>
            <label htmlFor="pw" className="block text-xs font-semibold mb-1">
              Mot de passe
            </label>
            <input
              id="pw"
              type="password"
              autoComplete="current-password"
              className={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {banner}
          <button type="submit" className={`${primary} w-full`} disabled={busy === 'login' || password.length === 0}>
            {busy === 'login' ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    );
  }

  // ---------- Éditeur ----------
  if (view === 'edit') {
    const aiBusy = busy !== null;
    return (
      <div className={shell}>
        <div className="max-w-2xl mx-auto p-3 sm:p-5 space-y-4">
          <button onClick={() => setView('list')} className={`${secondary} inline-flex items-center gap-1`}>
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
          </button>
          <h1 className="text-lg font-bold">{draft.id ? "Modifier l'article" : 'Nouvel article'}</h1>
          {banner}

          {/* Assistant IA */}
          <section className="rounded-2xl fs-card border p-4 space-y-3" aria-label="Assistant IA">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="w-4 h-4 text-cyan-500 dark:text-cyan-300" /> Assistant IA
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Donne les faits, l'IA rédige. Elle n'invente rien : ce qui manque est marqué « [À VÉRIFIER] ». Tu relis et tu publies.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="cat" className="block text-xs font-semibold mb-1">
                  Rubrique
                </label>
                <select id="cat" className={field} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tone" className="block text-xs font-semibold mb-1">
                  Ton
                </label>
                <select id="tone" className={field} value={tone} onChange={(e) => setTone(e.target.value)}>
                  {TONES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="topic" className="block text-xs font-semibold mb-1">
                Sujet (une ligne)
              </label>
              <input id="topic" className={field} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex. Victoire du PSG contre Metz" />
            </div>
            <div>
              <label htmlFor="notes" className="block text-xs font-semibold mb-1">
                Faits et informations à utiliser
              </label>
              <textarea
                id="notes"
                rows={5}
                className={field}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Score, buteurs, contexte, déclarations vérifiées, chiffres..."
              />
            </div>
            <button onClick={generate} disabled={aiBusy || notes.trim().length < 40} className={`${primary} w-full`}>
              {busy === 'draft' ? "L'IA rédige..." : 'Générer un brouillon'}
            </button>
          </section>

          {/* Article */}
          <section className="rounded-2xl fs-card border p-4 space-y-3" aria-label="Article">
            <div>
              <label htmlFor="title" className="block text-xs font-semibold mb-1">
                Titre
              </label>
              <input id="title" className={field} value={draft.title} maxLength={140} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              {titleIdeas.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {titleIdeas.map((t) => (
                    <li key={t}>
                      <button className={`${secondary} w-full text-left`} onClick={() => { setDraft({ ...draft, title: t }); setTitleIdeas([]); }}>
                        {t}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label htmlFor="summary" className="block text-xs font-semibold mb-1">
                Résumé (affiché dans la liste)
              </label>
              <textarea id="summary" rows={2} className={field} value={draft.summary} maxLength={320} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
            </div>
            <div>
              <label htmlFor="text" className="block text-xs font-semibold mb-1">
                Texte (sépare les paragraphes par une ligne vide)
              </label>
              <textarea id="text" rows={12} className={field} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
              <div className="flex flex-wrap gap-2 mt-2">
                <button className={secondary} disabled={aiBusy || !draft.text.trim()} onClick={() => improve('rewrite')}>
                  {busy === 'rewrite' ? '...' : 'Reformuler'}
                </button>
                <button className={secondary} disabled={aiBusy || !draft.text.trim()} onClick={() => improve('shorten')}>
                  {busy === 'shorten' ? '...' : 'Raccourcir'}
                </button>
                <button className={secondary} disabled={aiBusy || !draft.text.trim()} onClick={() => improve('proofread')}>
                  {busy === 'proofread' ? '...' : "Corriger l'orthographe"}
                </button>
                <button className={secondary} disabled={aiBusy || !draft.text.trim()} onClick={() => improve('titles')}>
                  {busy === 'titles' ? '...' : '3 idées de titres'}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="img" className="block text-xs font-semibold mb-1">
                Image (optionnel, lien https dont tu as les droits)
              </label>
              <input id="img" className={field} value={draft.imageUrl} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} placeholder="https://..." />
            </div>
          </section>

          {hasToVerify && (
            <p role="alert" className="rounded-xl px-3 py-2 text-sm bg-amber-500/15 text-amber-700 dark:text-amber-300">
              Il reste des « [À VÉRIFIER ... ] » dans le texte : confirme l'information et retire-les pour pouvoir publier.
            </p>
          )}

          <div className="flex gap-2 pb-8">
            <button className={`${secondary} flex-1 py-2.5`} disabled={busy !== null || !draft.title.trim()} onClick={() => save('draft')}>
              Enregistrer le brouillon
            </button>
            <button
              className={`${primary} flex-1`}
              disabled={busy !== null || !draft.title.trim() || !draft.text.trim() || hasToVerify}
              onClick={() => save('published')}
            >
              {busy === 'save' ? '...' : 'Publier'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Liste ----------
  return (
    <div className={shell}>
      <div className="max-w-2xl mx-auto p-3 sm:p-5 space-y-4">
        <header className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold">Rédaction</h1>
          <div className="flex gap-2">
            <a href="/" className={`${secondary} inline-flex items-center gap-1`}>
              <Eye className="w-3.5 h-3.5" /> Site
            </a>
            <button onClick={logout} className={`${secondary} inline-flex items-center gap-1`}>
              <LogOut className="w-3.5 h-3.5" /> Quitter
            </button>
          </div>
        </header>
        {banner}
        <AdminQuota />
        <AdminStats />
        <button onClick={() => openEditor()} className={`${primary} w-full inline-flex items-center justify-center gap-2`}>
          <Plus className="w-4 h-4" /> Nouvel article
        </button>

        {articles.length === 0 ? (
          <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-10">Aucun article pour le moment.</p>
        ) : (
          <ul className="space-y-2.5">
            {articles.map((a) => (
              <li key={a.id} className="rounded-2xl fs-card border p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300">{a.category}</p>
                    <h2 className="text-sm font-bold leading-snug">{a.title}</h2>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      a.status === 'published' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {a.status === 'published' ? 'Publié' : 'Brouillon'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={secondary} onClick={() => openEditor(a)}>
                    Modifier
                  </button>
                  <button className={secondary} onClick={() => togglePublish(a)}>
                    {a.status === 'published' ? 'Dépublier' : 'Publier'}
                  </button>
                  <button className={`${secondary} inline-flex items-center gap-1 text-fuchsia-600 dark:text-fuchsia-300`} onClick={() => remove(a)}>
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <section aria-label="Messages de contact" className="pt-4">
          <h2 className="text-sm font-bold mb-2">Messages de contact ({messages.length})</h2>
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Aucun message reçu pour le moment.</p>
          ) : (
            <ul className="space-y-2.5">
              {messages.map((m) => (
                <li key={m.id} className="rounded-2xl fs-card border p-3.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{m.name}</p>
                      <a href={`mailto:${m.email}`} className="text-xs text-cyan-700 dark:text-cyan-300 hover:underline break-all">{m.email}</a>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{new Date(m.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                  <button className={`${secondary} inline-flex items-center gap-1 text-fuchsia-600 dark:text-fuchsia-300`} onClick={() => deleteMessage(m.id)}>
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminPanel;
