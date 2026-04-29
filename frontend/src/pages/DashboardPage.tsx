import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  TrendingDown,
  Copy,
  Ban,
  XCircle,
  GitMerge,
} from 'lucide-react'
import { dashboardService } from '../services/dashboardService'
import { LoadingState } from '../components/ui/LoadingState'
import { ErrorState } from '../components/ui/ErrorState'
import { EmptyState } from '../components/ui/EmptyState'
import type { DashboardOverview, ReconciliationStatus } from '../types'
import { formatCurrency, formatDateTime } from '../lib/formatters'
import { DashboardHeader } from '../components/layout/DashboardHeader'
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard'
import { ReconciliationDonut } from '../components/dashboard/ReconciliationDonut'
import { ProblemsDetectedList, type ProblemsDetectedItem } from '../components/dashboard/ProblemsDetectedList'
import { FluxFinanceiroLineChart } from '../components/dashboard/FluxFinanceiroLineChart'
import { DashboardAlerts } from '../components/dashboard/DashboardAlerts'
import type { FluxPoint } from '../types'

function makeSparkValues(base: number, trend: 'success' | 'warning' | 'danger' | 'neutral') {
  const points = 14
  const safeBase = Math.max(0, Number.isFinite(base) ? base : 0)
  if (safeBase === 0) {
    const templates: Record<typeof trend, number[]> = {
      success: [6, 8, 7, 9, 10, 9, 11, 12, 11, 13, 14, 15, 14, 16],
      warning: [12, 11, 12, 10, 11, 10, 9, 8, 9, 8, 7, 8, 7, 6],
      danger: [10, 9, 10, 8, 7, 6, 7, 5, 4, 5, 4, 3, 2, 2],
      neutral: [8, 8, 9, 8, 9, 9, 10, 9, 10, 10, 11, 10, 11, 11],
    }
    return templates[trend]
  }

  const start = trend === 'success' ? 0.72 : trend === 'warning' ? 0.64 : trend === 'danger' ? 0.56 : 0.66
  const end = trend === 'success' ? 1.02 : trend === 'warning' ? 0.9 : trend === 'danger' ? 0.78 : 0.95

  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1)
    return safeBase * (start + (end - start) * t)
  })
}

function percent(part: number, total: number) {
  if (total <= 0) return 0
  return (part / total) * 100
}

function formatPct(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function mapPaymentStatusLabel(status: string) {
  const map: Record<string, string> = {
    Received: 'Recebido',
    Processing: 'Processando',
    Processed: 'Processado',
    Failed: 'Falhou',
    IgnoredDuplicate: 'Duplicado ignorado',
  }
  return map[status] ?? status
}

function toInputDate(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function LightStatusBadge({ status }: { status: ReconciliationStatus | string }) {
  const s = status as ReconciliationStatus
  const map: Record<string, { bg: string; fg: string; border: string; label: string }> = {
    Matched: {
      bg: 'bg-green-500/10',
      fg: 'text-green-400',
      border: 'border-green-500/20',
      label: 'Conciliada',
    },
    AmountMismatch: {
      bg: 'bg-red-500/10',
      fg: 'text-red-400',
      border: 'border-red-500/20',
      label: 'Divergência de valor',
    },
    DuplicatePayment: {
      bg: 'bg-orange-500/10',
      fg: 'text-orange-400',
      border: 'border-orange-500/20',
      label: 'Pagamento duplicado',
    },
    PaymentWithoutCharge: {
      bg: 'bg-red-500/10',
      fg: 'text-red-400',
      border: 'border-red-500/20',
      label: 'Sem cobrança',
    },
    ExpiredChargePaid: {
      bg: 'bg-yellow-500/10',
      fg: 'text-yellow-400',
      border: 'border-yellow-500/20',
      label: 'Cobrança expirada paga',
    },
  }

  const cfg =
    map[s] ?? { bg: 'bg-gray-500/10', fg: 'text-gray-200', border: 'border-gray-500/20', label: String(status) }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${cfg.bg} ${cfg.fg} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}

const MOCK_OVERVIEW: DashboardOverview = {
  updatedAt: new Date().toISOString(),
  summary: {
    totalCharges: 1248,
    paidCharges: 892,
    pendingCharges: 256,
    divergentCharges: 100,
    expiredCharges: 0,
    totalReceivedAmount: 215430.75,
    totalDivergentAmount: 8430.5,
    reconciliationIssues: {
      amountMismatch: 180,
      duplicatePayment: 100,
      paymentWithoutCharge: 50,
      expiredChargePaid: 20,
      invalidReference: 4,
      processingError: 2,
    },
  },
  previousPeriodSummary: {
    totalCharges: 1109,
    paidCharges: 790,
    pendingCharges: 240,
    divergentCharges: 79,
    expiredCharges: 0,
    totalReceivedAmount: 195000.25,
    totalDivergentAmount: 7000.0,
    reconciliationIssues: {
      amountMismatch: 160,
      duplicatePayment: 90,
      paymentWithoutCharge: 42,
      expiredChargePaid: 18,
      invalidReference: 3,
      processingError: 1,
    },
  },
  fluxSeries: Array.from({ length: 8 }, (_, i) => {
    const t = i / 7
    const received = 215430.75 * t
    const divergent = 8430.5 * t
    return {
      label: i === 0 ? '00:00' : `${String(6 * i).padStart(2, '0')}:00`,
      received,
      divergent,
      expected: received - divergent,
    } satisfies FluxPoint & { expected: number }
  }),
  recentReconciliations: [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'Matched',
      reason: 'Pagamento conciliado.',
      expectedAmount: 150.75,
      paidAmount: 150.75,
      chargeReferenceId: 'REF123456',
      paymentEventId: 'EVT123',
      createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      status: 'AmountMismatch',
      reason: 'Valor recebido diferente do esperado.',
      expectedAmount: 150.75,
      paidAmount: 140.0,
      chargeReferenceId: 'REF123457',
      paymentEventId: 'EVT124',
      createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      status: 'DuplicatePayment',
      reason: 'Evento duplicado detectado.',
      expectedAmount: null,
      paidAmount: 150.75,
      chargeReferenceId: 'REF123458',
      paymentEventId: 'EVT125',
      createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      status: 'PaymentWithoutCharge',
      reason: 'Sem cobrança correspondente.',
      expectedAmount: null,
      paidAmount: 99.0,
      chargeReferenceId: null,
      paymentEventId: 'EVT126',
      createdAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      status: 'ExpiredChargePaid',
      reason: 'Cobrança expirada recebeu pagamento.',
      expectedAmount: 50.0,
      paidAmount: 50.0,
      chargeReferenceId: 'REF123459',
      paymentEventId: 'EVT127',
      createdAt: new Date(Date.now() - 26 * 60_000).toISOString(),
    },
  ],
  recentPaymentEvents: [
    {
      eventId: 'EVT123',
      referenceId: 'REF123456',
      paidAmount: 150.75,
      provider: 'FakePixProvider',
      status: 'Processed',
      paidAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      processedAt: new Date(Date.now() - 2 * 60_000 + 6_000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 60_000 + 1_000).toISOString(),
    },
    {
      eventId: 'EVT124',
      referenceId: 'REF123457',
      paidAmount: 140.0,
      provider: 'FakePixProvider',
      status: 'Processed',
      paidAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      processedAt: new Date(Date.now() - 5 * 60_000 + 6_000).toISOString(),
      createdAt: new Date(Date.now() - 5 * 60_000 + 1_000).toISOString(),
    },
    {
      eventId: 'EVT125',
      referenceId: 'REF123458',
      paidAmount: 150.75,
      provider: 'FakePixProvider',
      status: 'Processed',
      paidAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      processedAt: new Date(Date.now() - 10 * 60_000 + 6_000).toISOString(),
      createdAt: new Date(Date.now() - 10 * 60_000 + 1_000).toISOString(),
    },
    {
      eventId: 'EVT126',
      referenceId: null,
      paidAmount: 99.0,
      provider: 'FakePixProvider',
      status: 'Processed',
      paidAt: new Date(Date.now() - 18 * 60_000).toISOString(),
      processedAt: new Date(Date.now() - 18 * 60_000 + 6_000).toISOString(),
      createdAt: new Date(Date.now() - 18 * 60_000 + 1_000).toISOString(),
    },
    {
      eventId: 'EVT127',
      referenceId: 'REF123459',
      paidAmount: 50.0,
      provider: 'FakePixProvider',
      status: 'Processed',
      paidAt: new Date(Date.now() - 26 * 60_000).toISOString(),
      processedAt: new Date(Date.now() - 26 * 60_000 + 6_000).toISOString(),
      createdAt: new Date(Date.now() - 26 * 60_000 + 1_000).toISOString(),
    },
  ],
  alerts: [
    {
      type: 'amountMismatch',
      count: 180,
      lastDetectedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      description: 'Divergência de valor detectada no período.',
      routeStatus: 'AmountMismatch',
    },
    {
      type: 'duplicatePayment',
      count: 100,
      lastDetectedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      description: 'Pagamentos duplicados detectados no período.',
      routeStatus: 'DuplicatePayment',
    },
    {
      type: 'paymentWithoutCharge',
      count: 50,
      lastDetectedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
      description: 'Pagamentos sem cobrança correspondente detectados.',
      routeStatus: 'PaymentWithoutCharge',
    },
  ],
}

export function DashboardPage() {
  const today = new Date()
  const defaultToDate = toInputDate(today)
  const defaultFromDate = toInputDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000))
  const [fromDate, setFromDate] = useState(defaultFromDate)
  const [toDate, setToDate] = useState(defaultToDate)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-overview', fromDate, toDate],
    queryFn: () => dashboardService.getOverview({ fromDate, toDate }),
    staleTime: 30_000,
  })

  const overview = useMemo<DashboardOverview>(() => {
    if (!data) return MOCK_OVERVIEW
    return data
  }, [data])

  if (isLoading) return <LoadingState />
  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  }

  const totalCharges = overview.summary.totalCharges
  const paidCharges = overview.summary.paidCharges
  const pendingCharges = overview.summary.pendingCharges
  const divergentCharges = overview.summary.divergentCharges

  const paidPct = percent(paidCharges, totalCharges)
  const pendingPct = percent(pendingCharges, totalCharges)
  const divergentPct = percent(divergentCharges, totalCharges)

  const prevTotal = overview.previousPeriodSummary.totalCharges
  const deltaPct = prevTotal > 0 ? ((totalCharges - prevTotal) / prevTotal) * 100 : 0
  const deltaText = `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1).replace('.', ',')}% vs período anterior`
  const deltaTrend: 'success' | 'neutral' | 'danger' = deltaPct >= 0 ? 'success' : 'danger'

  // Donut: Deriva “Matched” para garantir que a soma das fatias (legend + centro) feche no total.
  const issuesSum =
    overview.summary.reconciliationIssues.amountMismatch +
    overview.summary.reconciliationIssues.duplicatePayment +
    overview.summary.reconciliationIssues.paymentWithoutCharge +
    overview.summary.reconciliationIssues.expiredChargePaid +
    overview.summary.reconciliationIssues.invalidReference +
    overview.summary.reconciliationIssues.processingError

  const matched = Math.max(0, paidCharges - issuesSum)

  const donutItems = [
    { key: 'Matched', label: 'Conciliadas', value: matched, color: '#22C55E' },
    { key: 'AmountMismatch', label: 'Divergência de valor', value: overview.summary.reconciliationIssues.amountMismatch, color: '#EF4444' },
    { key: 'DuplicatePayment', label: 'Pagamento duplicado', value: overview.summary.reconciliationIssues.duplicatePayment, color: '#F97316' },
    { key: 'PaymentWithoutCharge', label: 'Sem cobrança', value: overview.summary.reconciliationIssues.paymentWithoutCharge, color: '#F87171' },
    { key: 'ExpiredChargePaid', label: 'Cobrança expirada paga', value: overview.summary.reconciliationIssues.expiredChargePaid, color: '#F59E0B' },
    { key: 'InvalidReference', label: 'Referência inválida', value: overview.summary.reconciliationIssues.invalidReference, color: '#8B5CF6' },
    { key: 'ProcessingError', label: 'Erro de processamento', value: overview.summary.reconciliationIssues.processingError, color: '#6B7280' },
  ] as const

  const problems: ProblemsDetectedItem[] = [
    {
      label: 'Divergência de valor',
      description: 'Valor recebido diferente do cobrado.',
      count: overview.summary.reconciliationIssues.amountMismatch,
      percent: percent(overview.summary.reconciliationIssues.amountMismatch, totalCharges),
      color: '#EF4444',
      icon: <AlertTriangle size={16} />,
    },
    {
      label: 'Pagamento duplicado',
      description: 'Pagamentos duplicados detectados.',
      count: overview.summary.reconciliationIssues.duplicatePayment,
      percent: percent(overview.summary.reconciliationIssues.duplicatePayment, totalCharges),
      color: '#F97316',
      icon: <Copy size={16} />,
    },
    {
      label: 'Pagamento sem cobrança',
      description: 'Evento sem cobrança correspondente.',
      count: overview.summary.reconciliationIssues.paymentWithoutCharge,
      percent: percent(overview.summary.reconciliationIssues.paymentWithoutCharge, totalCharges),
      color: '#F87171',
      icon: <Ban size={16} />,
    },
    {
      label: 'Cobrança expirada paga',
      description: 'Cobrança expirada recebeu pagamento.',
      count: overview.summary.reconciliationIssues.expiredChargePaid,
      percent: percent(overview.summary.reconciliationIssues.expiredChargePaid, totalCharges),
      color: '#F59E0B',
      icon: <XCircle size={16} />,
    },
  ]

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Painel"
        subtitle="Visão geral da saúde financeira em tempo real"
        fromDate={fromDate}
        toDate={toDate}
        updatedAt={overview.updatedAt}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <DashboardKpiCard
          title="Total de Cobranças"
          value={totalCharges.toLocaleString('pt-BR')}
          subtitle={deltaText}
          icon={<CreditCard size={16} />}
          trend={deltaTrend}
          sparkValues={makeSparkValues(totalCharges, deltaTrend)}
        />
        <DashboardKpiCard
          title="Cobranças Pagas"
          value={paidCharges.toLocaleString('pt-BR')}
          subtitle={`${formatPct(paidPct)}%`}
          icon={<CheckCircle size={16} />}
          trend="success"
          sparkValues={makeSparkValues(paidCharges, 'success')}
        />
        <DashboardKpiCard
          title="Cobranças Pendentes"
          value={pendingCharges.toLocaleString('pt-BR')}
          subtitle={`${formatPct(pendingPct)}%`}
          icon={<Clock size={16} />}
          trend="warning"
          sparkValues={makeSparkValues(pendingCharges, 'warning')}
        />
        <DashboardKpiCard
          title="Cobranças Divergentes"
          value={divergentCharges.toLocaleString('pt-BR')}
          subtitle={`${formatPct(divergentPct)}%`}
          icon={<AlertTriangle size={16} />}
          trend="danger"
          sparkValues={makeSparkValues(divergentCharges, 'danger')}
        />
        <DashboardKpiCard
          title="Valor Total Recebido"
          value={formatCurrency(overview.summary.totalReceivedAmount)}
          subtitle="Em pagamentos"
          icon={<DollarSign size={16} />}
          trend="success"
          sparkValues={makeSparkValues(overview.summary.totalReceivedAmount, 'success')}
        />
        <DashboardKpiCard
          title="Valor Divergente"
          value={formatCurrency(overview.summary.totalDivergentAmount)}
          subtitle="Em divergências"
          icon={<TrendingDown size={16} />}
          trend="danger"
          sparkValues={makeSparkValues(overview.summary.totalDivergentAmount, 'danger')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ReconciliationDonut
          total={overview.summary.paidCharges}
          centerLabel="Pagas"
          items={donutItems.map((d) => ({
            key: d.key,
            label: d.label,
            value: d.value,
            color: d.color,
            dotColor: d.color,
          }))}
          viewAllTo="/reconciliations"
        />

        <div className="min-w-0">
          <ProblemsDetectedList title="Problemas Detectados" total={totalCharges} items={problems} />
        </div>

        <FluxFinanceiroLineChart fluxSeries={overview.fluxSeries} summary={overview.summary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-gray-900 border border-gray-800 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Últimas Conciliações</h2>

          {overview.recentReconciliations.length === 0 ? (
            <EmptyState message="Nenhuma conciliação registrada ainda." icon={<GitMerge size={24} />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Cobrança</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Pagamento</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Valor Esperado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Valor Pago</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentReconciliations.map((r, idx) => (
                    <tr key={r.id} className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}>
                      <td className="px-4 py-3.5">
                        <LightStatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-200">
                        {r.chargeReferenceId ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-200">
                        {r.paymentEventId ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-200">
                        {r.expectedAmount == null ? '—' : formatCurrency(r.expectedAmount)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-50">
                        {formatCurrency(r.paidAmount)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-300">{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-gray-900 border border-gray-800 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Últimos Eventos de Pagamento</h2>

          {overview.recentPaymentEvents.length === 0 ? (
            <EmptyState message="Nenhum evento de pagamento registrado ainda." icon={<CreditCard size={24} />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">ID do evento</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Referência</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Valor Pago</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Provedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Recebido em</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentPaymentEvents.map((e, idx) => (
                    <tr key={e.eventId} className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-200">{e.eventId}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-200">{e.referenceId ?? '—'}</td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-50">{formatCurrency(e.paidAmount)}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-300">{e.provider}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border border-green-500/20 bg-green-500/10 text-green-400">
                          {mapPaymentStatusLabel(e.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-300">{formatDateTime(e.paidAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DashboardAlerts alerts={overview.alerts} />
    </div>
  )
}
