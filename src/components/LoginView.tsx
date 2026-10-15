import { useState } from 'react';
import { useAuth, friendlyAuthError } from '../lib/auth';
import { isFirebaseConfigured } from '../lib/firebase';
import { Logo, Spinner, cx } from './ui';

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
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo y Encabezado */}
        <div className="text-center animate-fade-up">
          <div className="inline-flex justify-center mb-3">
            <Logo className="h-16 w-16" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Árboles <span className="gradient-text">Binarios</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Plataforma interactiva para la construcción manual y evaluación de árboles
          </p>
        </div>

        {/* Tarjeta de Inicio de Sesión */}
        <div className="card space-y-5 animate-fade-up">
          {/* Selector de Rol: Alumno / Profesor */}
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-ink-950/60 p-1">
            <button
              type="button"
              onClick={() => {
                setRole('student');
                setError(null);
              }}
              className={cx(
                'rounded-lg py-2 text-xs font-semibold transition',
                role === 'student'
                  ? 'bg-mint-400/20 text-mint-300 border border-mint-400/30'
                  : 'text-slate-400 hover:text-white'
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
                'rounded-lg py-2 text-xs font-semibold transition',
                role === 'teacher'
                  ? 'bg-mint-400/20 text-mint-300 border border-mint-400/30'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              👨‍🏫 Soy Profesor
            </button>
          </div>

          {/* Aviso si Firebase aún no está enlazado */}
          {!isFirebaseConfigured && (
            <div className="rounded-xl border border-sun-400/30 bg-sun-400/10 p-3 text-xs text-sun-300 space-y-2">
              <div>
                ⚠️ <b>Firebase no configurado aún</b> en <code className="text-white">.env.local</code>.
              </div>
              <p className="text-[11px] text-slate-300">
                Puedes explorar la app completa con el modo demo local:
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onEnterDemoMode?.('teacher')}
                  className="btn-iris btn-sm flex-1 text-xs"
                >
                  Entrar como Profesor (Demo)
                </button>
                <button
                  type="button"
                  onClick={() => onEnterDemoMode?.('student')}
                  className="btn-secondary btn-sm flex-1 text-xs"
                >
                  Entrar como Alumno (Demo)
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-coral-400/30 bg-coral-400/10 p-3 text-xs text-coral-400">
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
                <span className="mt-1 block text-[11px] text-slate-500">
                  Ingresa tu número de control proporcionado por tu profesor.
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
                className="input font-mono"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading || !identifier || !password}
              className="btn-primary w-full py-3 font-semibold"
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

          {/* Enlace a Guía de Firebase */}
          <div className="border-t border-white/[0.06] pt-3 text-center">
            <button
              type="button"
              onClick={onOpenFirebaseGuide}
              className="text-xs text-mint-300 hover:underline"
            >
              ⚙️ ¿Cómo configurar Firebase y hospedar gratis en GitHub?
            </button>
          </div>
        </div>

        {/* Info PWA Offline */}
        <div className="text-center text-xs text-slate-500">
          📱 Esta aplicación es una PWA instalable. Funciona completamente sin conexión y se sincroniza al detectar WiFi o red cableada.
        </div>
      </div>
    </div>
  );
}
