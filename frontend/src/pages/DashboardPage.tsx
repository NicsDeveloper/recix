import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CreditCard, CheckCircle, Clock, AlertTriangle,
  DollarSign, TrendingDown, Copy, Ban, XCircle, GitMerge,
} from 'lucide-react'
import { dashboardService } from '../services/dashboardService'
import { LoadingState } from '../components/ui/LoadingState'
import { ErrorState } from '../components/ui/ErrorState'
import { EmptyState } from '../components/ui/EmptyState'
import type { ReconciliationStatus } from '../types'
import { formatCurrency, formatDateTime } from '../lib/formatters'
import { DashboardHeader } from '../components/layout/DashboardHeader'
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard'
import { ReconciliationDonut } from '../components/dashboard/ReconciliationDonut'
import { ProblemsDetectedList, type ProblemsDetectedItem } from '../components/dashboard/ProblemsDetectedList'
import { FluxFinanceiroLineChart } from '../components/dashboard/FluxFinanceiroLineChart'
import { DashboardAlerts } from '../components/dashboard/DashboardAlerts'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSparkValues(base: number, trend: 'success' | 'warning' | 'danger' | 'neutral') {
  const pts = 14
  if (base <= 0) {
    const shapes: Record<string, number[]> = {
      success: [3,4,4,5,4,6,5,7,6,7,8,7,9,10],
      warning: [6,7,6,8,7,6,8,7,9,8,7,8,7,8],
      danger:  [9,8,9,7,8,7,6,7,5,6,5,4,5,4],
      neutral: [5,6,5,6,5,7,6,5,6,7,6,5,6,7],
    }
    return shapes[trend]
  }
  return Array.from({ length: pts }, (_, i) => {
    const t     = i / (pts - 1)
    const noise = Math.sin(i * 2.3) * 0.06 + Math.cos(i * 1.7) * 0.04
    const slope = trend === 'success' ? 0.80 + t * 0.22
                : trend === 'danger'  ? 1.05 - t * 0.18
                : trend === 'warning' ? 0.88 + Math.sin(t * Math.PI) * 0.14
                : 0.92 + t * 0.1
    return Math.max(0, base * (slope + noise))
  })
}

function pct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0
}

function fmtPct(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Status badge PT-BR ───────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  Matched:              { bg: 'bg-green-500/10',  fg: 'text-green-400',  border: 'border-green-500/20',  label: 'Conciliado' },
  AmountMismatch:       { bg: 'bg-red-500/10',    fg: 'text-red-400',    border: 'border-red-500/20',    label: 'Valor Divergente' },
  DuplicatePayment:     { bg: 'bg-orange-500/10', fg: 'text-orange-400', border: 'border-orange-500/20', label: 'Pagamento Duplicado' },
  PaymentWithoutCharge: { bg: 'bg-red-500/10',    fg: 'text-red-400',    border: 'border-red-500/20',    label: 'Sem Cobrança' },
  ExpiredChargePaid:    { bg: 'bg-yellow-500/10', fg: 'text-yellow-400', border: 'border-yellow-500/20', label: 'Cobrança Expirada' },
  InvalidReference:     { bg: 'bg-purple-500/10', fg: 'text-purple-400', border: 'border-purple-500/20', label: 'Ref. Inválida' },
  ProcessingError:      { bg: 'bg-gray-500/10',   fg: 'text-gray-400',   border: 'border-gray-500/20',   label: 'Erro de Processamento' },
  Processed:            { bg: 'bg-green-500/10',  fg: 'text-green-400',  border: 'border-green-500/20',  label: 'Processado' },
  Processing:           { bg: 'bg-blue-500/10',   fg: 'text-blue-400',   border: 'border-blue-500/20',   label: 'Processando' },
  Received:             { bg: 'bg-indigo-500/10', fg: 'text-indigo-400', border: 'border-indigo-500/20', label: 'Recebido' },
  Failed:               { bg: 'bg-red-500/10',    fg: 'text-red-400',    border: 'border-red-500/20',    label: 'Falhou' },
  IgnoredDuplicate:     { bg: 'bg-gray-500/10',   fg: 'text-gray-400',   border: 'border-gray-500/20',   label: 'Duplicado Ignorado' },
}

function StatusBadgePt({ status }: { status: ReconciliationStatus | string }) {
  const cfg = STATUS_MAP[status] ?? { bg: 'bg-gray-500/10', fg: 'text-gray-300', border: 'border-gray-500/20', label: status }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${cfg.bg} ${cfg.fg} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [fromDate, setFromDate] = useState(todayISO)
  const [toDate,   setToDate]   = useState(todayISO)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-overview', fromDate, toDate],
    queryFn:  () => dashboardService.getOverview({ fromDate, toDate }),
    staleTime: 20_000,
    refetchInterval: 60_000,
  })

  if (isLoading) return <LoadingState />
  if (isError)   return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  if (!data)     return null

  const s  = data.summary
  const ps = data.previousPeriodSummary
  const ri = s.reconciliationIssues

  const deltaPct   = ps.totalCharges > 0 ? ((s.totalCharges - ps.totalCharges) / ps.totalCharges) * 100 : 0
  const deltaText  = `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1).replace('.', ',')}% vs período anterior`
  const deltaTrend: 'success' | 'neutral' | 'danger' = deltaPct >= 0 ? 'success' : 'danger'

  // Donut — usa contagens reais de reconciliações (não de cobranças)
  const donutItems = [
    { key: 'Matched',              label: 'Conciliado',            value: ri.matched,              color: '#22C55E' },
    { key: 'AmountMismatch',       label: 'Valor Divergente',      value: ri.amountMismatch,       color: '#EF4444' },
    { key: 'DuplicatePayment',     label: 'Pagamento Duplicado',   value: ri.duplicatePayment,     color: '#F97316' },
    { key: 'PaymentWithoutCharge', label: 'Sem Cobrança',          value: ri.paymentWithoutCharge, color: '#F87171' },
    { key: 'ExpiredChargePaid',    label: 'Cobrança Expirada',     value: ri.expiredChargePaid,    color: '#F59E0B' },
    { key: 'InvalidReference',     label: 'Ref. Inválida',         value: ri.invalidReference,     color: '#8B5CF6' },
    { key: 'ProcessingError',      label: 'Erro de Processamento', value: ri.processingError,      color: '#6B7280' },
  ]

  const donutTotal = donutItems.reduce((acc, i) => acc + i.value, 0)

  const problems: ProblemsDetectedItem[] = [
    { label: 'Valor Divergente',    description: 'Valor recebido diferente do cobrado.',   count: ri.amountMismatch,       percent: pct(ri.amountMismatch, s.totalCharges),       color: '#EF4444', icon: <AlertTriangle size={16} /> },
    { label: 'Pagamento Duplicado', description: 'Pagamentos duplicados detectados.',       count: ri.duplicatePayment,     percent: pct(ri.duplicatePayment, s.totalCharges),     color: '#F97316', icon: <Copy size={16} /> },
    { label: 'Sem Cobrança',        description: 'Evento sem cobrança correspondente.',     count: ri.paymentWithoutCharge, percent: pct(ri.paymentWithoutCharge, s.totalCharges), color: '#F87171', icon: <Ban size={16} /> },
    { label: 'Cobrança Expirada',   description: 'Cobrança expirada recebeu pagamento.',    count: ri.expiredChargePaid,    percent: pct(ri.expiredChargePaid, s.totalCharges),    color: '#F59E0B', icon: <XCircle size={16} /> },
  ]

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Dashboard"
        subtitle="Visão geral da saúde financeira em tempo real"
        fromDate={fromDate}
        toDate={toDate}
        updatedAt={data.updatedAt}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <DashboardKpiCard title="Total de Cobranças"    value={s.totalCharges.toLocaleString('pt-BR')}   subtitle={deltaText}                                    icon={<CreditCard size={16} />}    trend={deltaTrend} sparkValues={makeSparkValues(s.totalCharges, deltaTrend)} />
        <DashboardKpiCard title="Cobranças Pagas"       value={s.paidCharges.toLocaleString('pt-BR')}    subtitle={fmtPct(pct(s.paidCharges, s.totalCharges))}   icon={<CheckCircle size={16} />}   trend="success"    sparkValues={makeSparkValues(s.paidCharges, 'success')} />
        <DashboardKpiCard
          title="Cobranças Pendentes"
          value={s.pendingCharges.toLocaleString('pt-BR')}
          subtitle={s.expiredCharges > 0
            ? `${fmtPct(pct(s.pendingCharges, s.totalCharges))} · ${s.expiredCharges} expirada${s.expiredCharges !== 1 ? 's' : ''}`
            : fmtPct(pct(s.pendingCharges, s.totalCharges))}
          icon={<Clock size={16} />}
          trend="warning"
          sparkValues={makeSparkValues(s.pendingCharges, 'warning')}
        />
        <DashboardKpiCard title="Cobranças Divergentes" value={s.divergentCharges.toLocaleString('pt-BR')} subtitle={fmtPct(pct(s.divergentCharges, s.totalCharges))} icon={<AlertTriangle size={16} />} trend="danger"  sparkValues={makeSparkValues(s.divergentCharges, 'danger')} />
        <DashboardKpiCard title="Valor Total Recebido"  value={formatCurrency(s.totalReceivedAmount)}    subtitle="Em pagamentos"                                icon={<DollarSign size={16} />}    trend="success"    sparkValues={makeSparkValues(s.totalReceivedAmount, 'success')} />
        <DashboardKpiCard title="Valor Divergente"      value={formatCurrency(s.totalDivergentAmount)}   subtitle="Em divergências"                              icon={<TrendingDown size={16} />}  trend="danger"     sparkValues={makeSparkValues(s.totalDivergentAmount, 'danger')} />
      </div>

      {/* Donut + Problemas + Fluxo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ReconciliationDonut
          total={donutTotal}
          centerLabel="Conciliações"
          items={donutItems.map(d => ({ key: d.key, label: d.label, value: d.value, color: d.color, dotColor: d.color }))}
          viewAllTo="/reconciliations"
        />
        <div className="min-w-0">
          <ProblemsDetectedList title="Problemas Detectados" total={s.totalCharges} items={problems} />
        </div>
        <FluxFinanceiroLineChart fluxSeries={data.fluxSeries} summary={s} />
      </div>

      {/* Últimas conciliações + eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Últimas Conciliações</h2>
          {data.recentReconciliations.length === 0 ? (
            <EmptyState message="Nenhuma conciliação no período selecionado." icon={<GitMerge size={24} />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/60">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Cobrança</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Esperado</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Pago</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {data.recentReconciliations.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-3 py-3"><StatusBadgePt status={r.status} /></td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-300">{r.chargeReferenceId ?? '—'}</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-300">{r.expectedAmount == null ? '—' : formatCurrency(r.expectedAmount)}</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-50 font-medium">{formatCurrency(r.paidAmount)}</td>
                      <td className="px-3 py-3 text-xs text-gray-400">{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Últimos Eventos de Pagamento</h2>
          {data.recentPaymentEvents.length === 0 ? (
            <EmptyState message="Nenhum evento de pagamento no período." icon={<CreditCard size={24} />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/60">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">EventId</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Referência</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Valor Pago</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Provedor</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Recebido em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {data.recentPaymentEvents.map((e) => (
                    <tr key={e.eventId} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-3 py-3 font-mono text-xs text-gray-300 max-w-[100px] truncate" title={e.eventId}>{e.eventId}</td>
                      <td className="px-3 py-3 font-mono text-xs" title={e.referenceId ?? `EventId: ${e.eventId}`}>
                        {e.referenceId
                          ? <span className="text-gray-300">{e.referenceId}</span>
                          : <span className="text-gray-600 italic" title={e.eventId}>{e.eventId.slice(0, 18)}…</span>
                        }
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-gray-50 font-medium">{formatCurrency(e.paidAmount)}</td>
                      <td className="px-3 py-3 text-xs text-gray-400">{e.provider}</td>
                      <td className="px-3 py-3"><StatusBadgePt status={e.status} /></td>
                      <td className="px-3 py-3 text-xs text-gray-400">{formatDateTime(e.paidAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DashboardAlerts alerts={data.alerts} />
    </div>
  )
}
