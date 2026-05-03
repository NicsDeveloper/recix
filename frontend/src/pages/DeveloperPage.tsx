import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, ChevronRight, Loader2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { webhooksService } from '../services/webhooksService'
import { chargesService } from '../services/chargesService'
import { formatCurrency } from '../lib/formatters'
import type { Charge } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function freshEventId() { return `evt_${Date.now()}` }
function isExpiredNow(c: Charge) { return new Date() > new Date(c.expiresAt) }

// ─── Pré-condições e cenários ─────────────────────────────────────────────────

type CheckResult =
  | { state: 'ok' }
  | { state: 'warn';    reason: string }
  | { state: 'blocked'; reason: string }

type Scenario = {
  id: string
  label: string
  result: string
  dot: string
  needsCharge: boolean
  check: (c: Charge | null) => CheckResult
  build: (c: Charge) => { externalChargeId?: string; paidAmount: number; paidAt?: string }
}

const SCENARIOS: Scenario[] = [
  {
    id: 'matched',
    label: 'Pagamento correto',
    result: 'Matched',
    dot: 'bg-green-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid')
        return { state: 'blocked', reason: 'Cobrança já liquidada — gerará Duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada — motor rejeita pagamentos' }
      if (isExpiredNow(c))
        return { state: 'blocked', reason: 'Cobrança expirada — use o cenário "Expirada"' }
      if (c.status === 'PendingReview')
        return { state: 'warn', reason: 'Em revisão — o match atual será abandonado e substituído' }
      if (c.status === 'PartiallyPaid')
        return { state: 'warn', reason: 'Parcialmente paga — valor restante será liquidado' }
      if (c.status === 'Divergent')
        return { state: 'warn', reason: 'Marcada como divergente — pode aceitar o pagamento' }
      return { state: 'ok' }
    },
    build: c => ({ externalChargeId: c.externalId, paidAmount: c.amount }),
  },
  {
    id: 'partial',
    label: 'Pagamento parcial',
    result: 'PartialPayment',
    dot: 'bg-sky-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid')
        return { state: 'blocked', reason: 'Cobrança já liquidada — gerará Duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada — motor rejeita pagamentos' }
      if (isExpiredNow(c))
        return { state: 'blocked', reason: 'Cobrança expirada — motor gerará ExpiredChargePaid' }
      if (c.status === 'PartiallyPaid')
        return { state: 'warn', reason: 'Já tem parcial — a soma dos pagamentos pode liquidar a cobrança' }
      if (c.status === 'PendingReview')
        return { state: 'blocked', reason: 'Em revisão — confirme ou rejeite antes de enviar outro pagamento' }
      return { state: 'ok' }
    },
    build: c => ({ externalChargeId: c.externalId, paidAmount: parseFloat((c.amount / 2).toFixed(2)) }),
  },
  {
    id: 'exceeds',
    label: 'Excede o valor',
    result: 'PaymentExceedsExpected',
    dot: 'bg-rose-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid')
        return { state: 'blocked', reason: 'Cobrança já liquidada — gerará Duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada — motor rejeita pagamentos' }
      if (isExpiredNow(c))
        return { state: 'blocked', reason: 'Cobrança expirada — motor gerará ExpiredChargePaid' }
      if (c.status === 'PartiallyPaid')
        return { state: 'warn', reason: 'Parcialmente paga — depende do saldo restante, pode gerar Overpaid' }
      if (c.status === 'PendingReview')
        return { state: 'blocked', reason: 'Em revisão — resolva o review pendente primeiro' }
      return { state: 'ok' }
    },
    build: c => ({ externalChargeId: c.externalId, paidAmount: parseFloat((c.amount + 50).toFixed(2)) }),
  },
  {
    id: 'mismatch',
    label: 'Valor divergente',
    result: 'AmountMismatch',
    dot: 'bg-orange-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid')
        return { state: 'blocked', reason: 'Cobrança já liquidada — gerará Duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada' }
      if (isExpiredNow(c))
        return { state: 'blocked', reason: 'Cobrança expirada — gerará ExpiredChargePaid' }
      return {
        state: 'warn',
        reason: 'Usa fuzzy match (sem ID). Se outra cobrança tiver o mesmo valor, o motor pode conciliar lá em vez de aqui',
      }
    },
    build: c => ({ paidAmount: parseFloat((c.amount + 0.01).toFixed(2)) }),
  },
  {
    id: 'duplicate',
    label: 'Pag. duplicado',
    result: 'DuplicatePayment',
    dot: 'bg-orange-400',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Pending')
        return { state: 'blocked', reason: 'Ainda pendente — gerará Matched. Pague primeiro com "Pagamento correto"' }
      if (c.status === 'PartiallyPaid')
        return { state: 'warn', reason: 'Parcialmente paga — gerará Duplicado se a soma total já cobrir o valor' }
      if (c.status === 'PendingReview')
        return { state: 'blocked', reason: 'Em revisão — resolva o review antes de simular duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada' }
      if (isExpiredNow(c) && c.status !== 'Paid')
        return { state: 'warn', reason: 'Expirada e não paga — gerará ExpiredChargePaid' }
      return { state: 'ok' }
    },
    build: c => ({ externalChargeId: c.externalId, paidAmount: c.amount }),
  },
  {
    id: 'expired',
    label: 'Cobrança expirada',
    result: 'ExpiredChargePaid',
    dot: 'bg-gray-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid')
        return { state: 'blocked', reason: 'Cobrança já liquidada — gerará Duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada' }
      if (!isExpiredNow(c))
        return {
          state: 'blocked',
          reason: `Ainda válida até ${new Date(c.expiresAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} — o motor checa o tempo real, não o paidAt`,
        }
      return { state: 'ok' }
    },
    build: c => ({
      externalChargeId: c.externalId,
      paidAmount: c.amount,
      paidAt: new Date(new Date(c.expiresAt).getTime() + 86_400_000).toISOString(),
    }),
  },
  {
    id: 'invalid-ref',
    label: 'Referência inválida',
    result: 'InvalidReference',
    dot: 'bg-purple-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      return { state: 'ok' }
    },
    build: c => ({ externalChargeId: `INVALID_${c.externalId.slice(0, 8)}`, paidAmount: c.amount }),
  },
  {
    id: 'no-charge',
    label: 'Pag. sem cobrança',
    result: 'PaymentWithoutCharge',
    dot: 'bg-amber-500',
    needsCharge: false,
    check: _c => ({ state: 'ok' }),
    build: _c => ({ externalChargeId: `GHOST_${Date.now()}`, paidAmount: 1.00 }),
  },
  {
    id: 'multiple',
    label: 'Múltiplos candidatos',
    result: 'MultipleMatchCandidates',
    dot: 'bg-indigo-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid' || c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança não disponível para fuzzy match' }
      if (isExpiredNow(c))
        return { state: 'blocked', reason: 'Expirada — gerará ExpiredChargePaid' }
      return {
        state: 'warn',
        reason: 'Requer ≥ 2 cobranças pendentes com exatamente o mesmo valor no sistema',
      }
    },
    build: c => ({ paidAmount: c.amount }),
  },
]

const STATUS_LABEL: Record<string, string> = {
  Pending:       'Pendente',
  PendingReview: 'Em revisão',
  PartiallyPaid: 'Parcial',
  Paid:          'Pago',
  Expired:       'Expirada',
  Divergent:     'Divergente',
  Overpaid:      'Excedente',
  Cancelled:     'Cancelada',
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function DeveloperPage() {
  const queryClient = useQueryClient()
  const [selected,    setSelected]    = useState<Charge | null>(null)
  const [lastResult,  setLastResult]  = useState<{ scenarioId: string; status: string } | null>(null)
  const [search,      setSearch]      = useState('')

  const { data: chargesData, isLoading } = useQuery({
    queryKey: ['dev-charges'],
    queryFn: () => chargesService.list({ pageSize: 50 }),
    staleTime: 30_000,
  })

  const { mutate, isPending, variables: pending } = useMutation({
    mutationFn: ({ scenario, charge }: { scenario: Scenario; charge: Charge }) => {
      const payload = scenario.build(charge)
      return webhooksService.sendPixWebhook({
        eventId:          freshEventId(),
        externalChargeId: payload.externalChargeId,
        paidAmount:       payload.paidAmount,
        paidAt:           payload.paidAt ?? new Date().toISOString(),
        provider:         'FakePixProvider',
      })
    },
    onSuccess: (_res, { scenario }) => {
      queryClient.invalidateQueries({ queryKey: ['payment-events'] })
      queryClient.invalidateQueries({ queryKey: ['charges'] })
      queryClient.invalidateQueries({ queryKey: ['dev-charges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setLastResult({ scenarioId: scenario.id, status: 'ok' })
    },
    onError: (_err, { scenario }) => {
      setLastResult({ scenarioId: scenario.id, status: 'error' })
    },
  })

  const charges = (chargesData?.items ?? []).filter(c =>
    !search.trim() ||
    c.referenceId.toLowerCase().includes(search.toLowerCase()) ||
    c.externalId?.toLowerCase().includes(search.toLowerCase())
  )

  function fire(scenario: Scenario) {
    const chk = scenario.check(selected)
    if (chk.state === 'blocked') return

    const charge: Charge = selected ?? {
      id: '', referenceId: '', externalId: `ghost_${Date.now()}`,
      amount: 1, status: 'Pending',
      expiresAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      updatedAt: null, pixCopiaECola: null,
    }
    setLastResult(null)
    mutate({ scenario, charge })
  }

  return (
    <div className="space-y-6">
      <Header
        title="Ferramentas de desenvolvedor"
        subtitle="Simule cenários de pagamento PIX contra o motor real de conciliação."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">

        {/* Lista de cobranças */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs font-semibold text-gray-300 mb-2">1. Selecione uma cobrança</p>
            <input
              type="search"
              placeholder="Buscar referência…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60" style={{ maxHeight: 440 }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={18} className="text-gray-600 animate-spin" />
              </div>
            ) : charges.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-xs text-gray-600">Nenhuma cobrança encontrada.</p>
                <Link to="/charges" className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block">
                  Criar cobrança
                </Link>
              </div>
            ) : (
              charges.map(c => {
                const isSel = selected?.id === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelected(c); setLastResult(null) }}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2',
                      isSel ? 'bg-indigo-500/10 border-indigo-500' : 'hover:bg-gray-800/50 border-transparent',
                    ].join(' ')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-mono font-medium truncate ${isSel ? 'text-indigo-300' : 'text-gray-300'}`}>
                        {c.referenceId}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-500">{formatCurrency(c.amount)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          c.status === 'Paid'     ? 'bg-green-500/15 text-green-400' :
                          c.status === 'Expired'  ? 'bg-gray-500/15 text-gray-400' :
                          c.status === 'Divergent'? 'bg-orange-500/15 text-orange-400' :
                          'bg-amber-500/15 text-amber-400'
                        }`}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </div>
                    </div>
                    {isSel && <CheckCircle size={13} className="text-indigo-400 flex-shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Cenários */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-300">2. Escolha o cenário</p>
            {lastResult && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                lastResult.status === 'ok'
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {lastResult.status === 'ok' ? '✓ Webhook enviado' : '✕ Erro ao enviar'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {SCENARIOS.map(s => {
              const chk       = s.check(selected)
              const isBlocked = chk.state === 'blocked'
              const isWarn    = chk.state === 'warn'
              const isRunning = isPending && (pending as { scenario: Scenario } | undefined)?.scenario?.id === s.id
              const wasLast   = lastResult?.scenarioId === s.id

              return (
                <button
                  key={s.id}
                  onClick={() => !isBlocked && fire(s)}
                  disabled={isBlocked || isPending}
                  className={[
                    'group flex flex-col gap-1.5 px-4 py-3 rounded-xl border text-left transition-all',
                    isBlocked
                      ? 'border-gray-800/60 bg-gray-900/30 cursor-not-allowed opacity-50'
                      : isWarn
                        ? 'border-amber-500/20 bg-amber-500/[0.03] hover:border-amber-500/35 hover:bg-amber-500/[0.06]'
                        : wasLast && lastResult?.status === 'ok'
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-gray-800 bg-gray-900 hover:border-gray-600 hover:bg-gray-800/60',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot} ${isBlocked ? 'opacity-30' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold leading-tight ${isBlocked ? 'text-gray-500' : 'text-gray-200'}`}>
                        {s.label}
                      </p>
                      <p className={`text-[10px] font-mono ${isBlocked ? 'text-gray-700' : 'text-gray-600'}`}>
                        → {s.result}
                      </p>
                    </div>
                    <span className="flex-shrink-0">
                      {isRunning
                        ? <Loader2 size={13} className="text-gray-400 animate-spin" />
                        : wasLast && lastResult?.status === 'ok'
                          ? <CheckCircle size={13} className="text-green-400" />
                          : !isBlocked && <ChevronRight size={13} className="text-gray-700 group-hover:text-gray-400 transition-colors" />}
                    </span>
                  </div>

                  {chk.state !== 'ok' && (
                    <p className={`text-[10px] leading-snug pl-[18px] ${
                      isBlocked ? 'text-red-400/70' : 'text-amber-500/80'
                    }`}>
                      {(chk as { reason: string }).reason}
                    </p>
                  )}
                </button>
              )
            })}
          </div>

          {!selected && (
            <p className="text-xs text-gray-600 pt-1">
              Selecione uma cobrança para habilitar os cenários.{' '}
              <span className="text-amber-600/70">"Pag. sem cobrança"</span> funciona sem seleção.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
