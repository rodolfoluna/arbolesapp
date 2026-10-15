import { useTheme } from '../lib/theme';
import { cx } from './ui';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      id="btn-theme-toggle"
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      className={cx(
        'group relative inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-all duration-200',
        'border-outline bg-surface-variant/60 hover:bg-surface-variant text-text-secondary hover:text-text-primary',
        className
      )}
    >
      <span className="text-sm transition-transform duration-200 group-hover:scale-110">
        {isDark ? '🌙' : '☀️'}
      </span>
      <span className="hidden sm:inline font-sans font-medium">
        {isDark ? 'Oscuro' : 'Claro'}
      </span>
    </button>
  );
}
