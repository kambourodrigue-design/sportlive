export interface AccessInfo {
  status: 'trial' | 'premium' | 'expired';
  until: number | null; // fin de l'essai ou de l'abonnement (ms)
  price: number;
  days: number;
  trialDays: number;
  currency: string;
  payments: boolean;
  link: string; // lien de paiement
}

export interface AuthUser {
  name: string;
  email: string;
  access: AccessInfo;
}

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string };

const PICKS_CACHE_KEY = 'fsn_picks_cache_v1';

async function post(path: string, body?: unknown): Promise<any> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return res.json().catch(() => ({ success: false, error: 'Réponse invalide du serveur.' }));
}

// Utilisateur de la session en cours (cookie), ou null
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success && json.user ? (json.user as AuthUser) : null;
  } catch {
    return null;
  }
}

export async function authRequest(
  mode: 'login' | 'register',
  data: { email: string; password: string; name?: string },
): Promise<AuthResult> {
  try {
    const json = await post(mode === 'login' ? '/api/auth/login' : '/api/auth/register', data);
    if (json.success && json.user) return { ok: true, user: json.user as AuthUser };
    return { ok: false, error: typeof json.error === 'string' ? json.error : 'Une erreur est survenue.' };
  } catch {
    return { ok: false, error: 'Connexion au serveur impossible. Vérifie ta connexion internet.' };
  }
}

export async function logoutRequest(): Promise<void> {
  try {
    await post('/api/auth/logout');
  } catch {
    /* le cookie expirera de toute façon */
  }
  try {
    localStorage.removeItem(PICKS_CACHE_KEY); // les pronostics en cache ne doivent pas rester visibles après la déconnexion
  } catch {
    /* ignoré */
  }
}

// ---------- Abonnement ----------
// Le client a payé via le lien : on prévient l'admin, qui active le compte depuis /admin > Abonnés
export async function claimPayment(note: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const json = await post('/api/pay/claim', { note });
    if (json.success) return { ok: true };
    return { ok: false, error: typeof json.error === 'string' ? json.error : 'Envoi impossible pour le moment.' };
  } catch {
    return { ok: false, error: 'Connexion au serveur impossible. Vérifie ta connexion internet.' };
  }
}
