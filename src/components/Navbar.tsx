import { useEffect, useState } from 'react';
import { Brand, cx } from './ui';
import { useAuth } from '../lib/auth';
import { useWriteQueue } from '../lib/syncStore';
import { isFirebaseConfigured } from '../lib/firebase';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  onOpenFirebaseGuide?: () => void;
}

export function Navbar({ onOpenFirebaseGuide }: NavbarProps) {
  const { user, profile, isTeacher, logout } = useAuth();
  const { pending } = useWriteQueue();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Estado de sincronización según requerimiento:
  // 🟢 Sincronizado en la nube: online y sin escrituras pendientes
  // 🟡 Modo sin conexión (Guardado en el dispositivo): offline o con escrituras pendientes
  const isFullySynced = isOnline && pending === 0;

  return (
    <header className="sticky top-0 z-40 border-b border-outline bg-surface/85 backdrop-blur-xl transition-colors duration-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Brand subtitle={isTeacher ? 'Panel del Profesor' : 'Portal de Estudiantes'} />

          {!isFirebaseConfigured && (
            <button
              onClick={onOpenFirebaseGuide}
              className="hidden items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 md:inline-flex transition-colors"
            >
              <span>⚙️ Configurar Firebase</span>
            </button>
          )}
        </div>

        {/* Indicador de Red, Conmutador de Tema y Perfil */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Badge de Sincronización */}
          <div
            className={cx(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isFullySynced
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            )}
            title={
              isFullySynced
                ? 'Todas tus respuestas y ejercicios están sincronizados con la nube.'
                : !isOnline
                ? 'Sin conexión a internet. Los cambios se guardan localmente y se subirán al reconectar.'
                : `Sincronizando ${pending} cambio(s) con la nube...`
            }
          >
            <span
              className={cx(
                'h-2 w-2 rounded-full',
                isFullySynced
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : 'bg-amber-500 animate-pulse-soft'
              )}
            />
            <span className="hidden sm:inline">
              {isFullySynced
                ? '🟢 Sincronizado en la nube'
                : !isOnline
                ? '🟡 Modo sin conexión'
                : `🟡 Subiendo (${pending})...`}
            </span>
            <span className="sm:hidden font-mono">
              {isFullySynced ? '🟢 En línea' : '🟡 Offline'}
            </span>
          </div>

          {/* Conmutador de Tema Claro / Oscuro Material Design */}
          <ThemeToggle />

          {/* Perfil y Cierre de Sesión */}
          {user && (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden text-right text-xs md:block">
                <div className="font-semibold text-text-primary">
                  {profile?.fullName || (isTeacher ? 'Profesor' : profile?.controlNumber)}
                </div>
                <div className="font-mono text-text-muted text-[11px]">
                  {isTeacher ? 'Docente' : `No. Control: ${profile?.controlNumber}`}
                </div>
              </div>

              <button
                id="btn-logout"
                onClick={logout}
                className="btn-ghost btn-sm border border-outline hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 text-text-secondary"
                title="Cerrar sesión"
              >
                <span className="hidden sm:inline">Salir</span>
                <span className="sm:hidden">✕</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
