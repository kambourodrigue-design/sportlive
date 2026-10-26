// Alertes de but : abonnement Web Push du navigateur + synchronisation des matchs favoris avec le serveur
export interface PushFavorite {
  id: number;
  ko: string;
}

export const pushSupported = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// iPhone / iPad : les notifications ne marchent que si le site est ajouté à l'écran d'accueil
export const needsHomeScreenInstall = (): boolean => {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
};

const b64uToBytes = (s: string): Uint8Array<ArrayBuffer> => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

async function registration(): Promise<ServiceWorkerRegistration | null> {
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    // Pas encore enregistré : on attend un peu au lieu de rester bloqué indéfiniment
    return await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function post(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function enablePush(favorites: PushFavorite[]): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: "Ce navigateur ne gère pas les notifications." };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, error: "Notifications refusées. Tu peux les réautoriser dans les réglages du navigateur." };
  const reg = await registration();
  if (!reg) return { ok: false, error: "Le service de notifications n'est pas encore prêt. Recharge la page et réessaie." };
  try {
    const res = await fetch('/api/push/key');
    const { publicKey } = (await res.json()) as { publicKey?: string };
    if (!publicKey) return { ok: false, error: 'Service indisponible pour le moment.' };
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(publicKey) });
    const ok = await post('/api/push/subscribe', { subscription: sub.toJSON(), favorites });
    if (!ok) return { ok: false, error: "Impossible d'enregistrer l'abonnement. Réessaie dans un instant." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Impossible d'activer les alertes sur cet appareil." };
  }
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await post('/api/push/unsubscribe', { endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => {});
}

export async function syncFavorites(favorites: PushFavorite[]): Promise<void> {
  const sub = await currentSubscription();
  if (sub) await post('/api/push/sync', { subscription: sub.toJSON(), favorites });
}
