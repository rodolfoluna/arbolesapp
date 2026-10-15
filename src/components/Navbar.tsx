import { useEffect, useState } from 'react';
import { Brand, cx } from './ui';
import { useAuth } from '../lib/auth';
import { useWriteQueue } from '../lib/syncStore';
import { isFirebaseConfigured } from '../lib/firebase';

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
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Brand subtitle={isTeacher ? 'Panel del Profesor' : 'Portal de Estudiantes'} />
          
          {!isFirebaseConfigured && (
            <button
              onClick={onOpenFirebaseGuide}
              className="hidden items-center gap-1.5 rounded-full border border-sun-400/30 bg-sun-400/10 px-2.5 py-0.5 text-xs font-medium text-sun-400 hover:bg-sun-400/20 md:inline-flex"
            >
              <span>⚙️ Configurar Firebase</span>
            </button>
          )}
        </div>

        {/* Indicador de Red y Sincronización */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div
            className={cx(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isFullySynced
                ? 'border-mint-400/30 bg-mint-400/10 text-mint-300'
                : 'border-sun-400/30 bg-sun-400/10 text-sun-300'
            )}
            title={
              isFullySynced
                ? 'Todas tus respuestas y árboles están sincronizados con la nube.'
                : !isOnline
                ? 'Sin conexión a internet. Los cambios se guardan localmente y se subirán al reconectar.'
                : `Sincronizando ${pending} cambio(s) con la nube...`
            }
          >
            <span
              className={cx(
                'h-2 w-2 rounded-full',
                isFullySynced ? 'bg-mint-400 shadow-[0_0_8px_#34d399]' : 'bg-sun-400 animate-pulse-soft'
              )}
            />
            <span className="hidden sm:inline">
              {isFullySynced
                ? '🟢 Sincronizado en la nube'
                : !isOnline
                ? '🟡 Modo sin conexión (Guardado en dispositivo)'
                : `🟡 Subiendo (${pending})...`}
            </span>
            <span className="sm:hidden">
              {isFullySynced ? 'Sincronizado' : 'Sin conexión'}
            </span>
          </div>

          {/* Perfil y Cierre de Sesión */}
          {user && (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden text-right text-xs md:block">
                <div className="font-medium text-white">
                  {profile?.fullName || (isTeacher ? 'Profesor' : profile?.controlNumber)}
                </div>
                <div className="font-mono text-slate-400">
                  {isTeacher ? 'Docente' : `No. Control: ${profile?.controlNumber}`}
                </div>
              </div>

              <button
                id="btn-logout"
                onClick={logout}
                className="btn-ghost btn-sm border border-white/10 text-slate-300 hover:border-coral-400/30 hover:bg-coral-400/10 hover:text-coral-400"
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
