import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  message = 'Ocorreu um erro inesperado.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 gap-4 ${className ?? ''}`}>
      <div className="p-3 rounded-full bg-red-500/10">
        <AlertCircle size={24} className="text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-200">Erro ao carregar</p>
        <p className="text-sm text-gray-400 mt-1 max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={14} />
          Tentar novamente
        </button>
      )}
    </div>
  )
}
