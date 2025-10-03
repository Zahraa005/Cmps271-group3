import { useTheme } from './useTheme';

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const isDark = mode === 'dark';

  const toggle = () => setMode(isDark ? 'light' : 'dark');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggle}
      className={
        `relative inline-flex h-10 w-20 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500 ring-1 ring-inset ` +
        (isDark
          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 ring-violet-500/40'
          : 'bg-neutral-200 ring-neutral-300')
      }
    >
      {/* Sun (left) */}
      <span
        aria-hidden
        className={`absolute left-3 text-lg transition-all duration-300 ` + (!isDark ? 'opacity-100 text-amber-500' : 'opacity-40 text-amber-300')}
      >
        🌞
      </span>

      {/* Moon (right) */}
      <span
        aria-hidden
        className={`absolute right-3 text-lg transition-all duration-300 ` + (isDark ? 'opacity-100 text-violet-100' : 'opacity-40 text-violet-400')}
      >
        🌙
      </span>

      {/* Thumb */}
      <span
        aria-hidden
        className={
          `absolute left-1 top-1 inline-block h-8 w-8 transform rounded-full bg-white shadow-lg transition-transform duration-300 ` +
          (isDark ? 'translate-x-10 ring-2 ring-violet-300/40' : 'translate-x-0')
        }
      />
    </button>
  );
}