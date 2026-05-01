import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, CheckCircle, Copy, Ban, Clock,
  ArrowRight, ShoppingBag, Building2, TrendingUp,
  Download, FileText, Bell, ChevronRight, X,
} from 'lucide-react'
import { dashboardService } from '../services/dashboardService'
import { LoadingState }     from '../components/ui/LoadingState'
import { ErrorState }       from '../components/ui/ErrorState'
import { DashboardHeader }  from '../components/layout/DashboardHeader'
import { FluxFinanceiroLineChart } from '../components/dashboard/FluxFinanceiroLineChart'
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard'
import type { FluxPoint, ReconciliationStatus, RecentReconciliation, DashboardSummary } from '../types'
import { formatCurrency } from '../lib/formatters'
import { effectiveDivergenceAmount } from '../lib/dashboardSummary'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10) }

function fmtShort(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const day   = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const hh    = String(d.getHours()).padStart(2, '0')
    const mm    = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}, ${hh}:${mm}`
  } catch { return iso ?? '—' }
}

function sparkFromSeries(series: FluxPoint[], key: 'received' | 'expected' | 'divergent'): number[] {
  const raw = series.map(p => Number(p[key]) || 0)
  if (raw.length >= 2) return raw
  const v = raw[0] ?? 1
  return [v * 0.2, v * 0.45, v * 0.7, Math.max(v, 1)]
}

type IssueAmounts = {
  amountMismatch: number
  duplicatePayment: number
  paymentWithoutCharge: number
  expiredChargePaid: number
}

function sumsFromRecent(recent: RecentReconciliation[], s: DashboardSummary): IssueAmounts {
  const sumPaid = (st: ReconciliationStatus) =>
    recent.filter(r => r.status === st).reduce((acc, r) => acc + r.paidAmount, 0)
  return {
    amountMismatch:       s.totalDivergentAmount,
    duplicatePayment:     sumPaid('DuplicatePayment'),
    paymentWithoutCharge: sumPaid('PaymentWithoutCharge'),
    expiredChargePaid:    sumPaid('ExpiredChargePaid'),
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const BADGE: Record<string, [string, string, string]> = {
  Matched:              ['bg-green-500/15',  'text-green-400',  'border-green-500/25'],
  AmountMismatch:       ['bg-red-500/15',    'text-red-400',    'border-red-500/25'],
  DuplicatePayment:     ['bg-orange-500/15', 'text-orange-400', 'border-orange-500/25'],
  PaymentWithoutCharge: ['bg-amber-500/15',  'text-amber-400',  'border-amber-500/25'],
  ExpiredChargePaid:    ['bg-yellow-500/15', 'text-yellow-400', 'border-yellow-500/25'],
  InvalidReference:     ['bg-purple-500/15', 'text-purple-400', 'border-purple-500/25'],
  ProcessingError:      ['bg-gray-500/15',   'text-gray-400',   'border-gray-500/25'],
  Processed:            ['bg-green-500/15',  'text-green-400',  'border-green-500/25'],
  Processing:           ['bg-blue-500/15',   'text-blue-400',   'border-blue-500/25'],
  Received:             ['bg-indigo-500/15', 'text-indigo-400', 'border-indigo-500/25'],
  IgnoredDuplicate:     ['bg-gray-500/15',   'text-gray-400',   'border-gray-500/25'],
}

const BADGE_LABEL: Record<string, string> = {
  Matched: 'Conciliado', AmountMismatch: 'Valor divergente',
  DuplicatePayment: 'Pagamento duplicado', PaymentWithoutCharge: 'Sem cobrança',
  ExpiredChargePaid: 'Cobrança expirada', InvalidReference: 'Ref. inválida',
  ProcessingError: 'Erro', Processed: 'Processado', Processing: 'Processando',
  Received: 'Recebido', IgnoredDuplicate: 'Ignorado',
}

function Badge({ status }: { status: ReconciliationStatus | string }) {
  const [bg, fg, border] = BADGE[status] ?? ['bg-gray-500/15', 'text-gray-300', 'border-gray-500/25']
  const label            = BADGE_LABEL[status] ?? status
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${bg} ${fg} ${border} whitespace-nowrap`}>
      {label}
    </span>
  )
}

// ─── Verdict block ─────────────────────────────────────────────────────────────

function VerdictBlock({
  isOk, divergentAmt, receivedAmt, expectedAmt, fluxSeries, nonFinancialIssuesOnly, onDismiss,
}: {
  isOk: boolean
  divergentAmt: number
  receivedAmt: number
  expectedAmt: number
  fluxSeries: FluxPoint[]
  nonFinancialIssuesOnly?: boolean
  onDismiss?: () => void
}) {
  const navigate = useNavigate()
  const spExp = sparkFromSeries(fluxSeries, 'expected')
  const spRecv = sparkFromSeries(fluxSeries, 'received')
  const spDiv = sparkFromSeries(fluxSeries, 'divergent')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
      {/* Alert card */}
      <div
        className={[
          'lg:col-span-5 rounded-2xl border p-6 flex flex-col justify-center min-h-[200px]',
          isOk
            ? 'border-green-500/25 bg-gradient-to-br from-green-950/50 to-gray-950 shadow-[0_0_40px_-12px_rgba(34,197,94,0.25)]'
            : 'border-red-500/30 bg-gradient-to-br from-red-950/70 to-gray-950 shadow-[0_0_48px_-12px_rgba(239,68,68,0.35)]',
        ].join(' ')}
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isOk ? 'bg-green-500/15' : 'bg-red-500/20'}`}>
            {isOk
              ? <CheckCircle size={26} className="text-green-400" />
              : <AlertTriangle size={26} className="text-red-400" />}
          </div>
          <div className="min-w-0 flex-1 relative">
            {!isOk && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="absolute -top-1 -right-1 p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors"
                title="Fechar alerta"
              >
                <X size={16} />
              </button>
            )}
            {isOk ? (
              <>
                <p className="text-lg font-bold text-gray-50 leading-snug">
                  Seus pagamentos estão <span className="text-green-400">conciliados</span>
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Todos os valores recebidos batem com o esperado.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg sm:text-xl font-bold text-gray-50 leading-snug">
                  <span className="text-red-400">Atenção!</span>{' '}
                  Seu financeiro <span className="text-orange-400 font-extrabold">NÃO</span> está conciliado
                </p>
                {nonFinancialIssuesOnly ? (
                  <p className="text-sm text-gray-400 mt-2">
                    Há pendências de conciliação que precisam de revisão. Neste período não há valor monetário
                    associado a essas ocorrências no total exibido.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-400 mt-2">
                      Encontramos divergências que totalizam
                    </p>
                    <p className="text-3xl font-black text-red-400 tabular-nums mt-3 tracking-tight">
                      {formatCurrency(divergentAmt)}
                    </p>
                  </>
                )}
                <div className="flex flex-wrap gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => navigate('/reconciliations?filter=divergent')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-red-500/20"
                  >
                    Ver divergências <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/reconciliations')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold transition-colors"
                  >
                    Entenda os motivos
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI com sparklines */}
      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardKpiCard
          title="Total esperado"
          value={formatCurrency(expectedAmt)}
          icon={<ShoppingBag size={20} />}
          trend="info"
          sparkValues={spExp}
          valueClassName="text-sky-400"
        />
        <DashboardKpiCard
          title="Total recebido"
          value={formatCurrency(receivedAmt)}
          icon={<Building2 size={20} />}
          trend="success"
          sparkValues={spRecv}
          valueClassName="text-green-400"
        />
        <DashboardKpiCard
          title="Diferença"
          value={formatCurrency(divergentAmt)}
          icon={<TrendingUp size={20} />}
          trend={isOk ? 'success' : 'danger'}
          sparkValues={spDiv}
          valueClassName={isOk ? 'text-green-400' : 'text-red-400'}
        />
      </div>
    </div>
  )
}

// ─── Problems section ─────────────────────────────────────────────────────────

const PROBLEM_DEFS: Array<{
  key: keyof IssueAmounts
  icon: ReactNode
  color: string
  bg: string
  label: string
}> = [
  { key: 'amountMismatch',       icon: <AlertTriangle size={18} />, color: '#ef4444', bg: 'bg-red-500/15',    label: 'Valor divergente' },
  { key: 'duplicatePayment',     icon: <Copy         size={18} />, color: '#f97316', bg: 'bg-orange-500/15', label: 'Pagamento duplicado' },
  { key: 'paymentWithoutCharge', icon: <Ban          size={18} />, color: '#eab308', bg: 'bg-yellow-500/15', label: 'Pagamento sem venda' },
  { key: 'expiredChargePaid',    icon: <Clock        size={18} />, color: '#6b7280', bg: 'bg-gray-500/15',   label: 'Cobrança expirada' },
]

function ProblemCard({ icon, color, bg, count, label, amount }: {
  icon: React.ReactNode; color: string; bg: string
  count: number; label: string; amount: number
}) {
  const active = count > 0
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${active ? 'border-gray-700 bg-gray-800/60' : 'border-gray-800 bg-gray-900/40'}`}>
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`} style={{ color }}>
        {icon}
      </div>
      <div>
        <p className="text-3xl font-black leading-none tabular-nums" style={{ color: active ? color : '#374151' }}>
          {count}
        </p>
        <p className={`text-sm font-medium mt-1.5 leading-tight ${active ? 'text-gray-200' : 'text-gray-500'}`}>
          {label}
        </p>
        <p className={`text-xs mt-0.5 tabular-nums ${active ? 'text-gray-400' : 'text-gray-600'}`}>
          {formatCurrency(amount)}
        </p>
      </div>
    </div>
  )
}

// ─── Quick actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: <Download size={18} />,      bg: 'bg-indigo-500/15', color: '#818cf8', title: 'Importar extrato',    sub: 'Envie seu extrato bancário.',      to: '/import' },
  { icon: <FileText size={18} />,      bg: 'bg-cyan-500/15',   color: '#22d3ee', title: 'Gerar relatório',     sub: 'Baixe em PDF ou Excel.',           to: '/reports' },
  { icon: <AlertTriangle size={18} />, bg: 'bg-orange-500/15', color: '#f97316', title: 'Ver divergências',    sub: 'Analise e resolva pendências.',     to: '/reconciliations?filter=divergent' },
  { icon: <Bell size={18} />,          bg: 'bg-amber-500/15',   color: '#fbbf24', title: 'Configurar alertas',  sub: 'Receba avisos importantes.',       to: '/alerts' },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [fromDate, setFromDate]           = useState(todayISO)
  const [toDate,   setToDate]             = useState(todayISO)
  const [verdictDismissed, setVerdictDismissed] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey:       ['dashboard-overview', fromDate, toDate],
    queryFn:        () => dashboardService.getOverview({ fromDate, toDate }),
    staleTime:      20_000,
    refetchInterval: 60_000,
  })

  if (isLoading) return <LoadingState />
  if (isError)   return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  if (!data)     return null

  const s      = data.summary
  const ri     = s.reconciliationIssues
  const isOk   = (ri.amountMismatch + ri.duplicatePayment + ri.paymentWithoutCharge + ri.expiredChargePaid + ri.invalidReference) === 0
  const recvAmt = s.totalReceivedAmount
  const divAmt  = effectiveDivergenceAmount(s)
  const expAmt  = Math.max(0, recvAmt - divAmt)
  const issueAmts = sumsFromRecent(data.recentReconciliations, s)
  const nonFinancialIssuesOnly = !isOk && divAmt === 0

  return (
    <div className="space-y-5">

      {/* Header */}
      <DashboardHeader
        title="Dashboard"
        subtitle="Visão geral da conciliação financeira em tempo real"
        fromDate={fromDate} toDate={toDate}
        updatedAt={data.updatedAt}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
      />

      {/* 1 — Verdict */}
      {!verdictDismissed && (
        <VerdictBlock
          isOk={isOk}
          divergentAmt={divAmt}
          receivedAmt={recvAmt}
          expectedAmt={expAmt}
          fluxSeries={data.fluxSeries}
          nonFinancialIssuesOnly={nonFinancialIssuesOnly}
          onDismiss={() => setVerdictDismissed(true)}
        />
      )}

      {/* 2 — Problems + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Problems */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-200">Resumo das divergências</h2>
            <Link to="/reconciliations?filter=divergent"
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Ver todas as divergências <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PROBLEM_DEFS.map(p => (
              <ProblemCard
                key={p.key}
                icon={p.icon}
                color={p.color}
                bg={p.bg}
                count={ri[p.key as keyof typeof ri] as number}
                label={p.label}
                amount={issueAmts[p.key]}
              />
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 flex flex-col">
          <FluxFinanceiroLineChart fluxSeries={data.fluxSeries} summary={s} />
        </div>
      </div>

      {/* 3 — Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Reconciliations */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200">Últimas conciliações</h2>
            <Link to="/reconciliations"
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 transition-colors">
              Ver todas
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {['STATUS', 'REFERÊNCIA', 'ESPERADO', 'PAGO', 'DIFERENÇA', 'DATA', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentReconciliations.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-600">Nenhuma conciliação no período.</td></tr>
                ) : data.recentReconciliations.map(r => {
                  const diff     = r.expectedAmount != null ? r.paidAmount - r.expectedAmount : null
                  const diffText = diff == null ? '—'
                    : diff === 0 ? formatCurrency(0)
                    : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`
                  const diffCls  = diff == null ? 'text-gray-600'
                    : diff === 0 ? 'text-green-400'
                    : 'text-red-400'
                  return (
                    <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors">
                      <td className="px-4 py-3"><Badge status={r.status} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[130px] truncate">
                        {r.chargeReferenceId ?? <span className="text-gray-600 not-italic">PIX sem venda</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">
                        {r.expectedAmount != null ? formatCurrency(r.expectedAmount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-200 font-semibold tabular-nums">
                        {formatCurrency(r.paidAmount)}
                      </td>
                      <td className={`px-4 py-3 text-xs font-bold tabular-nums ${diffCls}`}>{diffText}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtShort(r.createdAt)}</td>
                      <td className="pr-3"><ChevronRight size={13} className="text-gray-700" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-gray-800">
            <Link to="/reconciliations" className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Ver todas as conciliações <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Payment events */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200">Últimos eventos de pagamento</h2>
            <Link to="/payment-events"
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 transition-colors">
              Ver todas
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {['EVENTO', 'REFERÊNCIA', 'VALOR', 'PROVEDOR', 'STATUS', 'RECEBIDO EM'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentPaymentEvents.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-600">Nenhum evento de pagamento no período.</td></tr>
                ) : data.recentPaymentEvents.map(e => (
                  <tr key={e.eventId} className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[100px] truncate" title={e.eventId}>
                      {e.eventId.slice(0, 18)}…
                    </td>
                    <td className="px-4 py-3 font-mono text-xs max-w-[130px] truncate">
                      {e.referenceId
                        ? <span className="text-gray-300">{e.referenceId}</span>
                        : <span className="text-gray-600">PIX sem venda</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-200 font-semibold tabular-nums text-right">
                      {formatCurrency(e.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{e.provider}</td>
                    <td className="px-4 py-3"><Badge status={e.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtShort(e.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-gray-800">
            <Link to="/payment-events" className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Ver todos os eventos <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* 4 — Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_1fr_1fr] items-center gap-3">
        <p className="text-sm font-semibold text-gray-400 whitespace-nowrap">Ações rápidas</p>
        {QUICK_ACTIONS.map(a => (
          <Link key={a.to} to={a.to}
            className="flex items-center gap-3 p-4 rounded-2xl border border-gray-800 bg-gray-900 hover:bg-gray-800/70 hover:border-gray-700 transition-all group">
            <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center flex-shrink-0`} style={{ color: a.color }}>
              {a.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors leading-tight">{a.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight truncate">{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
