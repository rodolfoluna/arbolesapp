import { useState } from 'react';
import { useAuth, friendlyAuthError } from '../lib/auth';
import { isFirebaseConfigured } from '../lib/firebase';
import { Logo, Spinner, cx } from './ui';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  onOpenFirebaseGuide: () => void;
  onEnterDemoMode?: (role: 'teacher' | 'student') => void;
}

export function LoginView({ onOpenFirebaseGuide, onEnterDemoMode }: Props) {
  const { login } = useAuth();
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError('Por favor llena todos los campos.');
      return;
    }

    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-dvh place-items-center p-4 bg-bg-app text-text-primary transition-colors duration-200">
      {/* Botón superior de Tema Claro / Oscuro */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Logo oficial y Encabezado Material Design */}
        <div className="text-center animate-fade-up">
          <div className="inline-flex justify-center mb-3">
            <Logo className="h-20 w-20 shadow-md rounded-[22px]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Árboles <span className="text-primary font-bold">Binarios</span>
          </h1>
          <p className="mt-1 text-sm text-text-muted max-w-xs mx-auto">
            Plataforma interactiva para la construcción manual y evaluación de árboles
          </p>
        </div>

        {/* Tarjeta de Inicio de Sesión Material 3 */}
        <div className="card space-y-5 animate-fade-up border-outline bg-surface-container shadow-xl">
          {/* Selector de Rol: Alumno / Profesor (Segmented Button M3) */}
          <div className="grid grid-cols-2 gap-1 rounded-full border border-outline bg-surface-variant/70 p-1">
            <button
              type="button"
              onClick={() => {
                setRole('student');
                setError(null);
              }}
              className={cx(
                'rounded-full py-2 text-xs font-semibold transition-all duration-200',
                role === 'student'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              🎓 Soy Alumno
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('teacher');
                setError(null);
              }}
              className={cx(
                'rounded-full py-2 text-xs font-semibold transition-all duration-200',
                role === 'teacher'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              👨‍🏫 Soy Profesor
            </button>
          </div>

          {/* Aviso si Firebase aún no está enlazado */}
          {!isFirebaseConfigured && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 space-y-2">
              <div>
                💡 <b>Modo de Demostración activo</b> (sin Firebase configurado).
              </div>
              <p className="text-[11px] text-text-secondary">
                Puedes explorar la plataforma de inmediato con una cuenta de prueba:
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onEnterDemoMode?.('teacher')}
                  className="btn-tonal btn-sm flex-1 text-xs"
                >
                  Probar como Profesor
                </button>
                <button
                  type="button"
                  onClick={() => onEnterDemoMode?.('student')}
                  className="btn-secondary btn-sm flex-1 text-xs"
                >
                  Probar como Alumno
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {role === 'student' ? (
              <div>
                <label className="label" htmlFor="login-control-number">
                  Número de Control
                </label>
                <input
                  id="login-control-number"
                  type="text"
                  className="input-mono uppercase"
                  placeholder="Ej: 22010456"
                  autoFocus
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
                <span className="mt-1 block text-[11px] text-text-muted">
                  Ingresa tu número de control escolar proporcionado por tu profesor.
                </span>
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="login-email">
                  Correo Electrónico del Profesor
                </label>
                <input
                  id="login-email"
                  type="email"
                  className="input"
                  placeholder="profesor@institucion.edu"
                  autoFocus
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="login-password">
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                className="input"
                placeholder={role === 'student' ? 'Contraseña temporal o personal' : 'Tu contraseña'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {role === 'student' && (
                <span className="mt-1 block text-[11px] text-text-muted">
                  Si es tu primer acceso, usa la contraseña de 6 caracteres que te dio tu profesor.
                </span>
              )}
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm font-semibold tracking-wide"
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4" /> Entrando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Pie con enlace a guía */}
          <div className="border-t border-outline pt-4 text-center">
            <button
              type="button"
              onClick={onOpenFirebaseGuide}
              className="text-xs text-primary hover:underline font-medium"
            >
              ⚙️ ¿Cómo configurar Firebase gratis para mi propia clase?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
