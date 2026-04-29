import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, RefreshCw } from 'lucide-react'
import { webhooksService } from '../../services/webhooksService'

interface SendWebhookModalProps {
  initialValues?: Partial<{
    externalChargeId: string
    referenceId: string
    paidAmount: string
  }>
  onClose: () => void
}

export function SendWebhookModal({ initialValues, onClose }: SendWebhookModalProps) {
  const queryClient = useQueryClient()

  const [eventId, setEventId] = useState(`evt_${Date.now()}`)
  const [externalChargeId, setExternalChargeId] = useState(initialValues?.externalChargeId ?? '')
  const [referenceId, setReferenceId] = useState(initialValues?.referenceId ?? '')
  const [paidAmount, setPaidAmount] = useState(initialValues?.paidAmount ?? '')
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [provider, setProvider] = useState('FakePixProvider')
  const [result, setResult] = useState<{ status: string; eventId: string } | null>(null)

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      webhooksService.sendPixWebhook({
        eventId,
        externalChargeId: externalChargeId || undefined,
        referenceId: referenceId || undefined,
        paidAmount: parseFloat(paidAmount),
        paidAt: new Date(paidAt).toISOString(),
        provider,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payment-events'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setResult({ status: res.status, eventId: res.eventId })
    },
  })

  const isValid = eventId.trim() !== '' && parseFloat(paidAmount) > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={result ? onClose : undefined} />

      <div className="relative z-10 w-full max-w-lg mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-base font-semibold text-white">Enviar Webhook Fake</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {result ? (
            <div className="space-y-4">
              {result.status === 'Received' ? (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-400">
                  ✓ Webhook enviado. Aguardando processamento...
                  <p className="text-xs mt-1 text-green-500/70">EventId: {result.eventId}</p>
                </div>
              ) : (
                <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-4 text-sm text-purple-400">
                  ⚠ Evento duplicado detectado (IgnoredDuplicate).
                  <p className="text-xs mt-1 text-purple-500/70">EventId: {result.eventId}</p>
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  {(error as Error).message}
                </div>
              )}

              {/* EventId */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">EventId</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setEventId(`evt_${Date.now()}`)}
                    title="Gerar novo EventId"
                    className="px-3 py-2.5 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 hover:text-gray-200 transition-colors"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* ExternalChargeId */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  ExternalChargeId <span className="text-gray-500 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="fakepsp_abc123..."
                  value={externalChargeId}
                  onChange={(e) => setExternalChargeId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
                />
              </div>

              {/* ReferenceId */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  ReferenceId <span className="text-gray-500 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="RECIX-20260429-000001"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
                />
              </div>

              {/* Paid Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Valor Pago (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="150.75"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
                  required
                />
              </div>

              {/* Paid At */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Data/Hora do Pagamento</label>
                <input
                  type="datetime-local"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>

              {/* Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Provider</label>
                <input
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
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
                  {isPending ? 'Enviando...' : 'Enviar Webhook'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
