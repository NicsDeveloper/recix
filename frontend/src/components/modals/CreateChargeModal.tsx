import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2 } from 'lucide-react'
import { chargesService } from '../../services/chargesService'

interface CreateChargeModalProps {
  onClose: () => void
}

export function CreateChargeModal({ onClose }: CreateChargeModalProps) {
  const queryClient = useQueryClient()

  const [amount, setAmount] = useState('')
  const [expiresInMinutes, setExpiresInMinutes] = useState('30')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      chargesService.create({
        amount: parseFloat(amount),
        expiresInMinutes: parseInt(expiresInMinutes, 10),
      }),
    onSuccess: (charge) => {
      queryClient.invalidateQueries({ queryKey: ['charges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setSuccessMessage(`Cobrança criada com sucesso! ReferenceId: ${charge.referenceId}`)
    },
    onError: (err: Error & { validationErrors?: Record<string, string[]> }) => {
      if (err.validationErrors) setErrors(err.validationErrors)
    },
  })

  const amountNum = parseFloat(amount)
  const expiresNum = parseInt(expiresInMinutes, 10)
  const isValid = !isNaN(amountNum) && amountNum > 0 && !isNaN(expiresNum) && expiresNum > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={successMessage ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">Nova Cobrança</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {successMessage ? (
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-400">
              {successMessage}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error banner */}
              {error && !Object.keys(errors).length && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  {(error as Error).message}
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="150.75"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
                  required
                />
                {errors['amount'] && (
                  <p className="mt-1 text-xs text-red-400">{errors['amount'].join(', ')}</p>
                )}
              </div>

              {/* Expires In Minutes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Expira em (minutos)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="30"
                  value={expiresInMinutes}
                  onChange={(e) => setExpiresInMinutes(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
                  required
                />
                {errors['expiresInMinutes'] && (
                  <p className="mt-1 text-xs text-red-400">{errors['expiresInMinutes'].join(', ')}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !isValid}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? 'Criando...' : 'Criar Cobrança'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer after success */}
        {successMessage && (
          <div className="px-6 pb-5">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
