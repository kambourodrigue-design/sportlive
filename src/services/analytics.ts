// Mesure d'audience sans cookie : une page vue par changement d'adresse. Respecte « Ne pas me suivre ».
let lastPath = '';

export function trackPageView(path: string): void {
  try {
    if (navigator.doNotTrack === '1' || path.startsWith('/admin') || path === lastPath) return;
    lastPath = path;
    const body = JSON.stringify({ path, ref: document.referrer || '' });
    if (!navigator.sendBeacon?.('/api/hit', new Blob([body], { type: 'text/plain' }))) {
      fetch('/api/hit', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* la mesure ne doit jamais gêner le site */
  }
}
