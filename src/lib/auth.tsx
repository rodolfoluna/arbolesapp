import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  TEACHER_EMAIL,
  getDb,
  getFirebaseAuth,
  isFirebaseConfigured,
  normalizeControlNumber,
  syntheticEmail,
} from './firebase';
import type { UserProfile } from './models';

interface AuthState {
  loading: boolean;
  user: User | null;
  profile: UserProfile | null;
  isTeacher: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  enterDemoMode: (role: 'teacher' | 'student', studentCn?: string) => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Número de control o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/network-request-failed':
      return 'Sin conexión. El primer inicio de sesión requiere internet.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/requires-recent-login':
      return 'Por seguridad, cierra sesión y vuelve a entrar antes de cambiar la contraseña.';
    case 'auth/user-disabled':
      return 'Tu cuenta está deshabilitada. Contacta a tu profesor.';
    default:
      return e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let unsubProfile: (() => void) | null = null;
    const unsub = onAuthStateChanged(getFirebaseAuth(), (u) => {
      unsubProfile?.();
      unsubProfile = null;
      setUser(u);
      setProfile(null);
      if (!u) {
        setLoading(false);
        return;
      }
      const email = (u.email ?? '').toLowerCase();
      if (TEACHER_EMAIL && email === TEACHER_EMAIL) {
        setProfile({
          uid: u.uid,
          role: 'teacher',
          controlNumber: '',
          fullName: u.displayName || 'Profesor',
          email,
          groupIds: [],
          mustChangePassword: false,
        });
        setLoading(false);
        return;
      }
      // Alumno: el perfil se escucha en tiempo real (y se sirve desde caché sin conexión).
      unsubProfile = onSnapshot(
        doc(getDb(), 'users', u.uid),
        (snap) => {
          if (!snap.exists()) {
            if (!snap.metadata.fromCache) {
              setError('Tu cuenta no tiene perfil registrado. Contacta a tu profesor.');
              signOut(getFirebaseAuth());
            }
            return;
          }
          const p = { ...(snap.data() as UserProfile), uid: snap.id };
          if (p.disabled) {
            setError('Esta cuenta fue reemplazada o dada de baja. Usa la contraseña nueva que te dio tu profesor.');
            signOut(getFirebaseAuth());
            return;
          }
          setProfile(p);
          setLoading(false);
        },
        (e) => {
          setError(friendlyAuthError(e));
          setLoading(false);
        },
      );
    });
    return () => {
      unsub();
      unsubProfile?.();
    };
  }, []);

  const enterDemoMode = (role: 'teacher' | 'student', studentCn?: string) => {
    if (role === 'teacher') {
      const demoUser = { uid: 'demo-teacher', email: 'profesor@demo.app', displayName: 'Profesor' } as User;
      setUser(demoUser);
      setProfile({
        uid: 'demo-teacher',
        role: 'teacher',
        controlNumber: '',
        fullName: 'Profesor Demo',
        email: 'profesor@demo.app',
        groupIds: [],
        mustChangePassword: false,
      });
    } else {
      const lsStudents: UserProfile[] = JSON.parse(localStorage.getItem('arboles_demo_students') || '[]');
      const found = (lsStudents.length > 0 ? lsStudents : []).find(
        (s) => s.controlNumber === (studentCn || '22010456')
      );
      const studentProfile: UserProfile = found || {
        uid: 'demo-student-1',
        role: 'student',
        controlNumber: studentCn || '22010456',
        fullName: 'Juan Pérez López',
        email: `${studentCn || '22010456'}@arboles.app`,
        groupIds: ['gpo-ed-3a'],
        mustChangePassword: false,
      };
      const demoUser = { uid: studentProfile.uid, email: studentProfile.email } as User;
      setUser(demoUser);
      setProfile(studentProfile);
    }
    setError(null);
  };

  const value = useMemo<AuthState>(
    () => ({
      loading,
      user,
      profile,
      isTeacher: profile?.role === 'teacher',
      error,
      enterDemoMode,
      async login(identifier, password) {
        setError(null);
        if (!isFirebaseConfigured) {
          // Si no está Firebase configurado, autentica en modo demo local
          const id = identifier.trim();
          if (id.includes('@') || id.toLowerCase().includes('profe')) {
            enterDemoMode('teacher');
            return;
          }
          enterDemoMode('student', normalizeControlNumber(id));
          return;
        }

        const id = identifier.trim();
        let email: string;
        if (id.includes('@')) {
          email = id.toLowerCase();
        } else {
          const cn = normalizeControlNumber(id);
          email = syntheticEmail(cn);
          // Si el profesor restableció la contraseña, el alias de correo cambia (.r1, .r2...).
          try {
            const alias = await getDoc(doc(getDb(), 'logins', cn));
            if (alias.exists() && alias.data().email) email = String(alias.data().email);
          } catch {
            /* sin conexión o sin permiso: se usa el correo por defecto */
          }
        }
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      },
      async logout() {
        if (!isFirebaseConfigured) {
          setUser(null);
          setProfile(null);
          return;
        }
        await signOut(getFirebaseAuth());
      },
      async changePassword(newPassword) {
        if (!isFirebaseConfigured) {
          if (profile) {
            setProfile({ ...profile, mustChangePassword: false });
          }
          return;
        }
        const u = getFirebaseAuth().currentUser;
        if (!u) throw new Error('No hay sesión activa.');
        await updatePassword(u, newPassword);
        await updateDoc(doc(getDb(), 'users', u.uid), {
          mustChangePassword: false,
          passwordChangedAt: serverTimestamp(),
        });
      },
    }),
    [loading, user, profile, error],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
