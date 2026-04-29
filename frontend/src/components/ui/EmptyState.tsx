import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  message?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  message = 'Nenhum item encontrado.',
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 gap-4 ${className ?? ''}`}>
      <div className="p-3 rounded-full bg-gray-800/60 text-gray-500">
        {icon ?? <Inbox size={24} />}
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-400">{message}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
