import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  message?: string
  className?: string
}

export function LoadingState({ message = 'Carregando...', className }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 gap-3 ${className ?? ''}`}>
      <Loader2 size={24} className="text-indigo-400 animate-spin" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}
