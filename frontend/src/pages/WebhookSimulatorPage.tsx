import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { RefreshCw, Loader2, CheckCircle, AlertTriangle, XCircle, Copy } from 'lucide-react'
import { webhooksService } from '../services/webhooksService'
import { Header } from '../components/layout/Header'
import { useAuth } from '../contexts/AuthContext'

interface FormState {
  eventId: string
  externalChargeId: string
  referenceId: string
  paidAmount: string
  paidAt: string
  provider: string
}

function freshEventId() {
  return `evt_${Date.now()}`
}

function nowLocal() {
  return new Date().toISOString().slice(0, 16)
}

const scenarios = [
  {
    id: 'correct',
    label: 'Pagamento Correto',
    icon: <CheckCircle size={14} />,
    color: 'text-green-400 border-green-500/30 bg-green-500/5 hover:bg-green-500/10',
    description: 'Preenche com valores sugeridos para um pagamento que deve conciliar',
    apply: (): Partial<FormState> => ({
      externalChargeId: '',
      referenceId: '',
      paidAmount: '150.75',
      provider: 'FakePixProvider',
    }),
  },
  {
    id: 'mismatch',
    label: 'Valor Divergente',
    icon: <AlertTriangle size={14} />,
    color: 'text-orange-400 border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10',
    description: 'Preenche com valor diferente do esperado para gerar AmountMismatch',
    apply: (): Partial<FormState> => ({
      externalChargeId: '',
      referenceId: '',
      paidAmount: '99.00',
      provider: 'FakePixProvider',
    }),
  },
  {
    id: 'nocharge',
    label: 'Sem Cobrança',
    icon: <XCircle size={14} />,
    color: 'text-red-400 border-red-500/30 bg-red-500/5 hover:bg-red-500/10',
    description: 'Preenche com ExternalChargeId inválido para gerar PaymentWithoutCharge',
    apply: (): Partial<FormState> => ({
      externalChargeId: 'fakepsp_INVALID_' + Date.now(),
      referenceId: '',
      paidAmount: '150.75',
      provider: 'FakePixProvider',
    }),
  },
  {
    id: 'duplicate',
    label: 'Duplicado',
    icon: <Copy size={14} />,
    color: 'text-purple-400 border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10',
    description: 'Usa o mesmo EventId de um envio anterior para gerar IgnoredDuplicate',
    apply: (current: FormState): Partial<FormState> => ({
      // Keep same eventId to force duplicate
      eventId: current.eventId,
      paidAmount: current.paidAmount || '150.75',
    }),
  },
]

export function WebhookSimulatorPage() {
  const { currentOrg } = useAuth()
  const isAdmin = currentOrg?.role === 'Owner' || currentOrg?.role === 'Admin'
  const queryClient = useQueryClient()

  if (!isAdmin) return <Navigate to="/" replace />

  const [form, setForm] = useState<FormState>({
    eventId: freshEventId(),
    externalChargeId: '',
    referenceId: '',
    paidAmount: '',
    paidAt: nowLocal(),
    provider: 'FakePixProvider',
  })

  const [result, setResult] = useState<{ status: string; eventId: string } | null>(null)

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      webhooksService.sendPixWebhook({
        eventId: form.eventId,
        externalChargeId: form.externalChargeId || undefined,
        referenceId: form.referenceId || undefined,
        paidAmount: parseFloat(form.paidAmount),
        paidAt: new Date(form.paidAt).toISOString(),
        provider: form.provider,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payment-events'] })
      queryClient.invalidateQueries({ queryKey: ['charges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setResult({ status: res.status, eventId: res.eventId })
    },
  })

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setResult(null)
  }

  function applyScenario(scenario: typeof scenarios[number]) {
    const patch = scenario.apply(form)
    setForm((f) => ({
      ...f,
      ...patch,
      eventId: patch.eventId ?? freshEventId(),
      paidAt: nowLocal(),
    }))
    setResult(null)
  }

  const isValid =
    form.eventId.trim() !== '' &&
    !isNaN(parseFloat(form.paidAmount)) &&
    parseFloat(form.paidAmount) > 0

  return (
    <div className="max-w-2xl mx-auto">
      <Header
        title="Simulador PIX"
        subtitle="Envie webhooks de pagamento fake para testar cenários de conciliação"
      />

      {/* Cenários pré-configurados */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Cenários pré-configurados
        </p>
        <div className="grid grid-cols-2 gap-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => applyScenario(s)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors text-left ${s.color}`}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-sm font-semibold text-gray-50 mb-5">Simular Pagamento PIX</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setResult(null)
            mutate()
          }}
          className="space-y-4"
        >
          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {(error as Error).message}
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className={`rounded-lg p-3 text-sm border ${
                result.status === 'Received'
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
              }`}
            >
              {result.status === 'Received'
                ? '✓ Webhook enviado. Aguardando processamento...'
                : '⚠ Evento duplicado detectado (IgnoredDuplicate).'}
              <p className="text-xs mt-0.5 opacity-70">EventId: {result.eventId}</p>
            </div>
          )}

          {/* EventId */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">EventId</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.eventId}
                onChange={(e) => set('eventId', e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => set('eventId', freshEventId())}
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
              value={form.externalChargeId}
              onChange={(e) => set('externalChargeId', e.target.value)}
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
              value={form.referenceId}
              onChange={(e) => set('referenceId', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
            />
          </div>

          {/* Paid Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Valor Pago (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="150.75"
              value={form.paidAmount}
              onChange={(e) => set('paidAmount', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
              required
            />
          </div>

          {/* Paid At */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Data/Hora do Pagamento</label>
            <input
              type="datetime-local"
              value={form.paidAt}
              onChange={(e) => set('paidAt', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Provider</label>
            <input
              type="text"
              value={form.provider}
              onChange={(e) => set('provider', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || !isValid}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {isPending ? 'Enviando...' : 'Enviar Webhook'}
          </button>
        </form>
      </div>
    </div>
  )
}
