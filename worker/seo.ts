// Référencement : le site est une application mono-page, donc Google et surtout WhatsApp / Facebook (qui n'exécutent pas
// le JavaScript) ne verraient que la page d'accueil. Le Worker réécrit les balises de chaque adresse avant de l'envoyer.

export interface PageMeta {
  title: string;
  description: string;
  path: string; // adresse canonique, ex. /match/apif-123
  type?: 'website' | 'article';
  image?: string; // chemin ou URL absolue
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
  heading?: string; // texte visible sans JavaScript
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'article'
  );
}

function setTag(html: string, re: RegExp, tag: string): string {
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

export function renderPage(html: string, meta: PageMeta, origin: string): string {
  const title = esc(clip(meta.title, 78));
  const desc = esc(clip(meta.description, 200));
  const url = origin + meta.path;
  const image = meta.image ? (meta.image.startsWith('http') ? meta.image : origin + meta.image) : origin + '/og-image.png';
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  out = setTag(out, /<meta name="description"[^>]*>/, `<meta name="description" content="${desc}" />`);
  out = setTag(out, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}" />`);
  out = setTag(out, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${desc}" />`);
  out = setTag(out, /<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${meta.type ?? 'website'}" />`);
  out = setTag(out, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}" />`);
  out = setTag(out, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}" />`);
  out = setTag(out, /<meta property="og:site_name"[^>]*>/, `<meta property="og:site_name" content="ScoreAfrica" />`);
  out = setTag(out, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(image)}" />`);
  out = setTag(out, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);
  if (meta.noindex) out = setTag(out, /<meta name="robots"[^>]*>/, `<meta name="robots" content="noindex, follow" />`);
  if (meta.jsonLd) {
    const ld = JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c');
    out = out.replace('</head>', `    <script type="application/ld+json">${ld}</script>\n  </head>`);
  }
  // Texte lisible par les robots qui n'exécutent pas le JavaScript
  out = out.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript><h1>${esc(meta.heading ?? meta.title)}</h1><p>${desc}</p></noscript>`);
  return out;
}

export function buildRobots(origin: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function buildSitemap(origin: string, entries: { path: string; lastmod?: string; priority?: string; changefreq?: string }[]): string {
  const rows = entries
    .map(
      (e) =>
        `  <url><loc>${esc(origin + e.path)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : ''}${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ''}${e.priority ? `<priority>${e.priority}</priority>` : ''}</url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}
