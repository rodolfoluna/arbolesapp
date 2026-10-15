import { useEffect, useRef, type ReactNode } from 'react';

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className={className} draggable={false} />;
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Logo />
      <div className="leading-tight">
        <div className="font-semibold tracking-tight text-white">
          Árboles <span className="gradient-text">Binarios</span>
        </div>
        {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={cx('animate-spin text-mint-400', className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FullScreenLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4 animate-fade-up">
        <Logo className="h-16 w-16 animate-pulse-soft" />
        <div className="flex items-center gap-2 text-sm text-slate-400">
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
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm animate-[fade-up_0.2s_both]" onClick={onClose} />
      <div
        ref={ref}
        className={cx(
          'glass relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl sm:rounded-3xl animate-fade-up bg-ink-900/95',
          width,
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button className="btn-ghost btn-sm -mr-2" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/5 px-5 py-3 safe-bottom">{footer}</div>}
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
      <div className="text-sm text-slate-300">{message}</div>
    </Modal>
  );
}

export function EmptyState({ icon = '🌱', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-12 text-center animate-fade-up">
      <div className="text-4xl">{icon}</div>
      <div className="text-lg font-medium text-white">{title}</div>
      {children && <div className="max-w-md text-sm text-slate-400">{children}</div>}
    </div>
  );
}

export function scoreTone(score: number | null | undefined) {
  if (score == null) return 'text-slate-500 bg-white/5 border-white/5';
  if (score >= 90) return 'text-mint-300 bg-mint-400/10 border-mint-400/25';
  if (score >= 70) return 'text-aqua-400 bg-aqua-400/10 border-aqua-400/25';
  if (score >= 50) return 'text-sun-400 bg-sun-400/10 border-sun-400/25';
  return 'text-coral-400 bg-coral-400/10 border-coral-400/25';
}

export function ScorePill({ score, label }: { score: number | null | undefined; label?: string }) {
  return (
    <span className={cx('badge border font-mono', scoreTone(score))}>{score == null ? (label ?? '—') : `${score}%`}</span>
  );
}

export function ProgressRing({ value, size = 44 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(255 255 255 / 0.08)" strokeWidth="5" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#ring-grad)"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <defs>
        <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
    </svg>
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
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition',
          checked ? 'border-mint-400/50 bg-mint-400/30' : 'border-white/10 bg-white/5',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all',
            checked ? 'left-5.5 bg-mint-300' : 'left-0.5 bg-slate-400',
          )}
        />
      </button>
      <span className="text-sm">
        <span className="text-slate-200">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
