import type { ReactNode } from 'react'

interface FilterBarProps {
  children: ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 mb-5 ${className ?? ''}`}>
      {children}
    </div>
  )
}

// ─── Reusable filter sub-components ──────────────────────────────────────────

interface SelectFilterProps<T extends string> {
  label: string
  value: T | ''
  options: { value: T; label: string }[]
  onChange: (value: T | '') => void
  /** Quando false, apenas `options` é renderizado (útil para opções especiais além de ""). */
  prependBlankOption?: boolean
  blankOptionLabel?: string
}

export function SelectFilter<T extends string>({
  label,
  value,
  options,
  onChange,
  prependBlankOption = true,
  blankOptionLabel = 'Todos os status',
}: SelectFilterProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T | '')}
      className="bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
      aria-label={label}
    >
      {prependBlankOption && <option value="">{blankOptionLabel}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

interface SearchInputProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
}

export function SearchInput({ placeholder = 'Buscar...', value, onChange }: SearchInputProps) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors min-w-[200px]"
    />
  )
}
