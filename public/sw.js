// Service worker minimal : l'app s'ouvre même hors-ligne ; l'API (/api/*) n'est jamais mise en cache ici.
const CACHE = 'scoreafrica-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Pages : réseau d'abord (toujours la dernière version), cache en secours hors-ligne
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return r;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Fichiers statiques : cache d'abord
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return r;
        }),
    ),
  );
});

// Alertes de but (Web Push) : affichées même site fermé
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (_) {
    /* message vide */
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'ScoreAfrica', {
      body: d.body || '',
      tag: d.tag || undefined,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: d.url || '/' },
      renotify: true,
      vibrate: [120, 60, 120],
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
