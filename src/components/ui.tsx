import { useEffect, useRef, type ReactNode } from 'react';

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

/**
 * Logo oficial en vector SVG con el estilo Google Material Design 3.
 * Representa un árbol binario interactivo con los colores característicos de Google:
 * Azul Google (#1A73E8), Verde Google (#34A853), Amarillo (#FBBC04) y Rojo (#EA4335).
 * Al ser un SVG inline, NUNCA falla al cargar, escala a cualquier tamaño y se adapta al tema.
 */
export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cx('shrink-0 select-none transition-transform duration-200 hover:scale-105', className)}
      aria-label="Logo Árboles Binarios"
    >
      <defs>
        <linearGradient id="m3-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1A73E8" />
          <stop offset="100%" stopColor="#4285F4" />
        </linearGradient>
        <linearGradient id="m3-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0F9D58" />
          <stop offset="100%" stopColor="#34A853" />
        </linearGradient>
        <linearGradient id="m3-yellow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F4B400" />
          <stop offset="100%" stopColor="#FBBC04" />
        </linearGradient>
        <linearGradient id="m3-red" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D93025" />
          <stop offset="100%" stopColor="#EA4335" />
        </linearGradient>
        <linearGradient id="m3-purple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>

      {/* Chip contenedor de fondo estilo Material 3 */}
      <rect
        width="64"
        height="64"
        rx="18"
        className="fill-surface-variant/80 stroke-outline"
        strokeWidth="1.5"
      />

      {/* Ramas / Conexiones del Árbol Binario */}
      <g stroke="#9AA0A6" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.75">
        <path d="M32 16 L19 28" />
        <path d="M32 16 L45 28" />
        <path d="M19 28 L12 43" />
        <path d="M19 28 L26 43" />
        <path d="M45 28 L52 43" />
      </g>

      {/* Nodos circulares con elevación Material */}
      {/* Nodo Raíz (Google Blue) */}
      <circle cx="32" cy="16" r="6.5" fill="url(#m3-blue)" />
      <circle cx="32" cy="16" r="2.5" fill="#FFFFFF" />

      {/* Hijo Izquierdo (Google Green) */}
      <circle cx="19" cy="28" r="5.5" fill="url(#m3-green)" />
      <circle cx="19" cy="28" r="2" fill="#FFFFFF" />

      {/* Hijo Derecho (Google Yellow) */}
      <circle cx="45" cy="28" r="5.5" fill="url(#m3-yellow)" />
      <circle cx="45" cy="28" r="2" fill="#FFFFFF" />

      {/* Hojas */}
      {/* Hoja Izq-Izq (Google Red) */}
      <circle cx="12" cy="43" r="4.5" fill="url(#m3-red)" />
      <circle cx="12" cy="43" r="1.5" fill="#FFFFFF" />

      {/* Hoja Izq-Der (Google Purple) */}
      <circle cx="26" cy="43" r="4.5" fill="url(#m3-purple)" />
      <circle cx="26" cy="43" r="1.5" fill="#FFFFFF" />

      {/* Hoja Der-Der (Google Blue claro) */}
      <circle cx="52" cy="43" r="4.5" fill="url(#m3-blue)" />
      <circle cx="52" cy="43" r="1.5" fill="#FFFFFF" />
    </svg>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Logo className="h-10 w-10" />
      <div className="leading-tight">
        <div className="text-base font-semibold tracking-tight text-text-primary">
          Árboles <span className="font-bold text-primary">Binarios</span>
        </div>
        {subtitle && <div className="text-xs text-text-muted">{subtitle}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={cx('animate-spin text-primary', className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FullScreenLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg-app">
      <div className="flex flex-col items-center gap-4 animate-fade-up">
        <Logo className="h-16 w-16 animate-pulse-soft" />
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Spinner className="h-4 w-4" /> {label}
        </div>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-6xl' }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      {/* Fondo con desenfoque Material */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      {/* Diálogo Material Design 3 (rounded-[28px], elevación suave) */}
      <div
        ref={ref}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] sm:rounded-[28px] border border-outline bg-surface-container shadow-2xl animate-fade-up',
          width
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 border-b border-outline px-6 py-4.5">
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <button
              className="btn-ghost btn-sm -mr-2 rounded-full h-8 w-8 !p-0 inline-flex items-center justify-center text-text-secondary hover:text-text-primary"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5 text-text-secondary">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2.5 border-t border-outline px-6 py-3.5 safe-bottom bg-surface-variant/30 rounded-b-[28px]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            id="confirm-dialog-ok"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-text-secondary">{message}</div>
    </Modal>
  );
}

export function EmptyState({ icon = '🌱', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2.5 py-12 text-center animate-fade-up">
      <div className="text-4xl">{icon}</div>
      <div className="text-lg font-semibold text-text-primary">{title}</div>
      {children && <div className="max-w-md text-sm text-text-muted">{children}</div>}
    </div>
  );
}

export function scoreTone(score: number | null | undefined) {
  if (score == null) return 'text-text-muted bg-surface-variant border-outline';
  if (score >= 90) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (score >= 70) return 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/30';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30';
  return 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30';
}

export function ScorePill({ score, label }: { score: number | null | undefined; label?: string }) {
  return (
    <span className={cx('badge border font-mono font-medium', scoreTone(score))}>
      {score == null ? (label ?? '—') : `${score}%`}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 select-none">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-primary bg-primary' : 'border-outline bg-surface-variant'
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4.5 w-4.5 rounded-full transition-transform duration-200 shadow-sm',
            checked ? 'translate-x-5.5 bg-on-primary' : 'translate-x-0.5 bg-text-muted'
          )}
        />
      </button>
      <span className="text-sm">
        <span className="font-medium text-text-primary">{label}</span>
        {hint && <span className="block text-xs text-text-muted mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
