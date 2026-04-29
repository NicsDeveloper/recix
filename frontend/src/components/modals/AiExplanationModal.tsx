import { useQuery } from '@tanstack/react-query'
import { X, Sparkles } from 'lucide-react'
import { aiService } from '../../services/aiService'
import { StatusBadge } from '../ui/StatusBadge'
import { LoadingState } from '../ui/LoadingState'
import { ErrorState } from '../ui/ErrorState'
import type { ReconciliationStatus } from '../../types'

interface AiExplanationModalProps {
  reconciliationId: string
  status: ReconciliationStatus
  onClose: () => void
}

export function AiExplanationModal({ reconciliationId, status, onClose }: AiExplanationModalProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ai-explanation', reconciliationId],
    queryFn: () => aiService.explainReconciliation(reconciliationId),
    staleTime: Infinity,
    retry: 1,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-indigo-500/10">
              <Sparkles size={15} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Explicação da IA</h2>
              <div className="mt-0.5">
                <StatusBadge status={status} />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[120px]">
          {isLoading ? (
            <LoadingState message="Gerando explicação..." />
          ) : isError ? (
            <ErrorState
              message={(error as Error)?.message}
              onRetry={() => refetch()}
            />
          ) : data ? (
            <p className="text-sm text-gray-300 leading-relaxed">{data.explanation}</p>
          ) : null}
        </div>

        {/* Footer */}
        {data && (
          <div className="px-6 pb-5 pt-1 border-t border-gray-800/60 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Modelo: <span className="text-gray-400">{data.model}</span>
            </p>
            <p className="text-xs text-gray-600 italic text-right max-w-[240px]">
              A IA explica dados processados e não altera registros.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
