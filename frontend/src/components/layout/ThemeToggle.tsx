import { useTheme } from '../../contexts/ThemeContext'

export function ThemeToggle({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { theme, setTheme } = useTheme()

  const btnClass =
    size === 'md'
      ? 'px-3 py-2 text-sm'
      : 'px-2 py-1.5 text-xs sm:text-sm'

  const barClass = size === 'md' ? 'p-1.5 gap-1.5' : 'p-1 gap-1'

  return (
    <div className={`inline-flex items-center rounded-lg bg-gray-900 border border-gray-800 ${barClass}`}>
      <button
        type="button"
        aria-pressed={theme === 'dark'}
        onClick={() => setTheme('dark')}
        className={[
          'rounded-md transition-colors whitespace-nowrap',
          btnClass,
          theme === 'dark'
            ? 'bg-gray-700 text-gray-50'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/70',
        ].join(' ')}
      >
        Dark
      </button>
      <button
        type="button"
        aria-pressed={theme === 'light'}
        onClick={() => setTheme('light')}
        className={[
          'rounded-md transition-colors whitespace-nowrap',
          btnClass,
          theme === 'light'
            ? 'bg-gray-700 text-gray-50'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/70',
        ].join(' ')}
      >
        Claro
      </button>
    </div>
  )
}

