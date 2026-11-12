import { useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../lib/models';
import { AuthCtx } from '../lib/auth';
import { centralFetch, endCentralSession, initializeCentralSession, startCentralLogin } from '../lib/central';

export function CentralAuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const invalidate = () => { if (active) { setProfile(null); setError('El acceso ya no está disponible. Vuelve a ingresar con Aula Identidad.'); } };
    window.addEventListener('aula:invalid', invalidate);
    void initializeCentralSession().then((result) => { if (active) setProfile(result); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'No se pudo verificar el acceso.'); })
      .finally(() => { if (active) setLoading(false); });
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void centralFetch<{ profile: UserProfile }>('/api/me').then((result) => { if (active) setProfile(result.profile); }).catch(() => {});
    };
    // Keep local memberships and central identity current without trusting cached profile claims.
    window.addEventListener('aula:datachange', refresh);
    return () => { active = false; window.removeEventListener('aula:invalid', invalidate); window.removeEventListener('aula:datachange', refresh); };
  }, []);
  return <AuthCtx.Provider value={{
    user: profile ? { uid: profile.uid, email: profile.email } as User : null,
    profile, loading, error, isTeacher: profile?.role === 'teacher',
    login: async () => { await startCentralLogin(); },
    logout: async () => { await endCentralSession(); setProfile(null); setError(null); },
    changePassword: async () => { throw new Error('Administra tu contraseña en Aula Identidad.'); },
    enterDemoMode: () => {},
  }}>{children}</AuthCtx.Provider>;
}
