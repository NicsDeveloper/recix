import type { ReactNode } from 'react'

interface HeaderProps {
  title: string
  /** Texto ou conteúdo rico (ex.: links) abaixo do título. */
  subtitle?: ReactNode
  action?: ReactNode
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-50">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  )
}
