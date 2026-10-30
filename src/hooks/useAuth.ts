import { useCallback, useEffect, useState } from 'react';
import { AuthUser, authRequest, fetchMe, logoutRequest } from '../services/auth';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchMe().then((u) => {
      if (!alive) return;
      setUser(u);
      setChecking(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const submit = useCallback(async (mode: 'login' | 'register', data: { email: string; password: string; name?: string }) => {
    const r = await authRequest(mode, data);
    if (r.ok) setUser(r.user);
    return r;
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    await logoutRequest();
  }, []);

  // Session expirée côté serveur (réponse 401) : on repasse en « déconnecté »
  const sessionLost = useCallback(() => setUser(null), []);

  // Relit l'état du compte (essai, abonnement) auprès du serveur
  const refresh = useCallback(async () => {
    setUser(await fetchMe());
  }, []);

  return { user, checking, submit, signOut, sessionLost, refresh };
}
