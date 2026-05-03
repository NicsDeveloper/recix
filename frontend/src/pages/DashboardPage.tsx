import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle, AlertTriangle, Copy, Ban, Clock,
  ArrowRight, ChevronRight, Download, FileText, Bell, Eye,
} from 'lucide-react'
import { dashboardService }          from '../services/dashboardService'
import { reconciliationsService }    from '../services/reconciliationsService'
import { LoadingState }              from '../components/ui/LoadingState'
import { ErrorState }                from '../components/ui/ErrorState'
import { DashboardHeader }           from '../components/layout/DashboardHeader'
import { FluxFinanceiroLineChart }   from '../components/dashboard/FluxFinanceiroLineChart'
import { DashboardKpiCard }          from '../components/dashboard/DashboardKpiCard'
import type { FluxPoint, ReconciliationStatus, DashboardSummary } from '../types'
import { formatCurrency }            from '../lib/formatters'
import { effectiveDivergenceAmount } from '../lib/dashboardSummary'
import { METRIC_LABELS } from '../lib/metricLabels'
import { getLocalTodayYmd, shiftLocalDaysFromToday } from '../lib/dateRangeParam'
import type { DashboardDatePreset } from '../components/layout/DashboardHeader'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtShort(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  } catch { return iso ?? '—' }
}

function sparkFromSeries(series: FluxPoint[], key: 'received' | 'expected' | 'divergent'): number[] {
  const raw = series.map(p => Number(p[key]) || 0)
  if (raw.length >= 2) return raw
  const v = raw[0] ?? 1
  return [v * 0.2, v * 0.45, v * 0.7, Math.max(v, 1)]
}

function trendPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

// ─── Badge ────────────────────────────────────────────────────────────────────

const BADGE: Record<string, [string, string, string]> = {
  Matched:                ['bg-green-500/15',  'text-green-400',  'border-green-500/25'],
  MatchedLowConfidence:   ['bg-amber-500/15',  'text-amber-400',  'border-amber-500/25'],
  PartialPayment:         ['bg-sky-500/15',    'text-sky-400',    'border-sky-500/25'],
  AmountMismatch:         ['bg-red-500/15',    'text-red-400',    'border-red-500/25'],
  PaymentExceedsExpected: ['bg-rose-500/15',   'text-rose-400',   'border-rose-500/25'],
  DuplicatePayment:       ['bg-orange-500/15', 'text-orange-400', 'border-orange-500/25'],
  PaymentWithoutCharge:   ['bg-amber-500/15',  'text-amber-400',  'border-amber-500/25'],
  ChargeWithoutPayment:   ['bg-red-500/15',    'text-red-400',    'border-red-500/25'],
  MultipleMatchCandidates:['bg-indigo-500/15', 'text-indigo-400', 'border-indigo-500/25'],
  ExpiredChargePaid:      ['bg-yellow-500/15', 'text-yellow-400', 'border-yellow-500/25'],
  InvalidReference:       ['bg-purple-500/15', 'text-purple-400', 'border-purple-500/25'],
  ProcessingError:        ['bg-gray-500/15',   'text-gray-400',   'border-gray-500/25'],
  Processed:              ['bg-green-500/15',  'text-green-400',  'border-green-500/25'],
  Processing:             ['bg-blue-500/15',   'text-blue-400',   'border-blue-500/25'],
  Received:               ['bg-indigo-500/15', 'text-indigo-400', 'border-indigo-500/25'],
  IgnoredDuplicate:       ['bg-gray-500/15',   'text-gray-400',   'border-gray-500/25'],
}

const BADGE_LABEL: Record<string, string> = {
  Matched:                'Conciliado',
  MatchedLowConfidence:   'Revisar match',
  PartialPayment:         'Parcial',
  AmountMismatch:         'Valor divergente',
  PaymentExceedsExpected: 'Excedente',
  DuplicatePayment:       'Pag. duplicado',
  PaymentWithoutCharge:   'Pag. sem cobrança',
  ChargeWithoutPayment:   'Venda sem pagamento',
  MultipleMatchCandidates:'Múlt. candidatos',
  ExpiredChargePaid:      'Cobrança expirada',
  InvalidReference:       'Ref. inválida',
  ProcessingError:        'Erro',
  Processed:              'Processado',
  Processing:             'Processando',
  Received:               'Recebido',
  IgnoredDuplicate:       'Ignorado',
}

function Badge({ status }: { status: string }) {
  const [bg, fg, border] = BADGE[status] ?? ['bg-gray-500/15', 'text-gray-300', 'border-gray-500/25']
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${bg} ${fg} ${border} whitespace-nowrap`}>
      {BADGE_LABEL[status] ?? status}
    </span>
  )
}

// ─── Pending Review Banner ────────────────────────────────────────────────────

function PendingReviewBanner({ count }: { count: number }) {
  const navigate = useNavigate()
  if (count === 0) return null

  return (
    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-amber-500/30 bg-amber-500/8 bg-gradient-to-r from-amber-950/40 to-gray-950">
      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
        <Eye size={18} className="text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-300">
          {count} conciliação{count !== 1 ? 'ões' : ''} aguardando revisão
        </p>
        <p className="text-xs text-amber-500/80 mt-0.5">
          O período não pode ser fechado enquanto houver itens pendentes. Confirme ou rejeite cada match.
        </p>
      </div>
      <button
        onClick={() => navigate('/reconciliations?tab=review')}
        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-xl hover:bg-amber-500/20 transition-colors"
      >
        Revisar agora <ArrowRight size={12} />
      </button>
    </div>
  )
}

// ─── Verdict Card ─────────────────────────────────────────────────────────────

function VerdictCard({ isOk, divergentAmt, periodCloseable }: { isOk: boolean; divergentAmt: number; periodCloseable: boolean }) {
  const navigate = useNavigate()

  if (isOk) {
    return (
      <div className="rounded-2xl border border-green-500/25 bg-gradient-to-br from-green-950/60 to-gray-950 p-6 flex flex-col justify-center shadow-[0_0_40px_-12px_rgba(34,197,94,0.3)] h-full">
        <div className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mb-4">
          <CheckCircle size={28} className="text-green-400" />
        </div>
        <p className="text-xs font-semibold text-green-400 mb-1">Tudo certo!</p>
        <p className="text-xl font-bold text-gray-50 leading-tight mb-2">
          Seus pagamentos estão conciliados
        </p>
        <p className="text-sm text-gray-400 mb-6">
          Todos os valores recebidos batem com o esperado.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/reconciliations')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-500/30 bg-green-500/10 text-green-300 text-sm font-semibold hover:bg-green-500/20 transition-colors"
          >
            Ver detalhes <ArrowRight size={14} />
          </button>
          <button
            disabled={!periodCloseable}
            title={periodCloseable ? 'Fechar o período atual' : 'Há conciliações aguardando revisão — resolva-as antes de fechar o período'}
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-500/30 bg-green-500/15 text-green-200 text-sm font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Fechar período
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/60 to-gray-950 p-6 flex flex-col justify-center shadow-[0_0_48px_-12px_rgba(239,68,68,0.35)] h-full">
      <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-red-400" />
      </div>
      <p className="text-xs font-semibold text-red-400 mb-1">Atenção!</p>
      <p className="text-xl font-bold text-gray-50 leading-tight mb-2">
        Seu financeiro <span className="text-orange-400">NÃO</span> está conciliado
      </p>
      <p className="text-3xl font-black text-red-400 tabular-nums mb-5">
        {formatCurrency(divergentAmt)}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigate('/reconciliations?filter=divergent')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-red-500/20"
        >
          Ver divergências <ArrowRight size={14} />
        </button>
        <button
          onClick={() => navigate('/reconciliations')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold transition-colors"
        >
          Entenda os motivos
        </button>
      </div>
    </div>
  )
}

// ─── Divergence Summary Panel ─────────────────────────────────────────────────

type IssueKey = 'amountMismatch' | 'duplicatePayment' | 'paymentWithoutCharge' | 'expiredChargePaid'

const ISSUE_DEFS: Array<{
  key: IssueKey
  icon: React.ReactNode
  color: string
  bg: string
  label: string
}> = [
  { key: 'amountMismatch',       icon: <AlertTriangle size={20}/>, color: '#ef4444', bg: 'bg-red-500/15',    label: 'Valor divergente' },
  { key: 'duplicatePayment',     icon: <Copy          size={20}/>, color: '#f97316', bg: 'bg-orange-500/15', label: 'Pagamento duplicado' },
  { key: 'paymentWithoutCharge', icon: <Ban           size={20}/>, color: '#eab308', bg: 'bg-yellow-500/15', label: 'Pagamento sem venda' },
  { key: 'expiredChargePaid',    icon: <Clock         size={20}/>, color: '#6b7280', bg: 'bg-gray-500/15',   label: 'Cobrança expirada' },
]

function DivergenceSummary({
  ri, amounts,
}: {
  ri: DashboardSummary['reconciliationIssues']
  amounts: Record<IssueKey, number>
}) {
  const allZero = Object.values(amounts).every(v => v === 0) && (ri.amountMismatch + (ri.paymentExceedsExpected ?? 0) + ri.duplicatePayment + ri.paymentWithoutCharge + ri.expiredChargePaid) === 0

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-200">Resumo das divergências</h2>
        <Link to="/reconciliations?filter=divergent"
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          Ver todas as divergências <ArrowRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {ISSUE_DEFS.map(def => {
          const count = ri[def.key as keyof typeof ri] as number
          const amount = amounts[def.key]
          const active = count > 0
          return (
            <div key={def.key}
              className={`rounded-xl border p-3.5 flex flex-col gap-2 transition-colors ${active ? 'border-gray-700 bg-gray-800/60' : 'border-gray-800 bg-gray-900/40'}`}>
              <div className={`w-9 h-9 rounded-lg ${def.bg} flex items-center justify-center`} style={{ color: def.color }}>
                {def.icon}
              </div>
              <div>
                <p className="text-2xl font-black leading-none tabular-nums" style={{ color: active ? def.color : '#374151' }}>
                  {count}
                </p>
                <p className={`text-xs font-medium mt-1 leading-tight ${active ? 'text-gray-200' : 'text-gray-500'}`}>
                  {def.label}
                </p>
                <p className={`text-xs mt-0.5 tabular-nums ${active ? 'text-gray-400' : 'text-gray-600'}`}>
                  {formatCurrency(amount)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {allZero ? (
        <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
          <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-300">
              Excelente! <span className="font-normal text-gray-400">Não há divergências no período selecionado.</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Continue assim e mantenha seus dados sempre conciliados.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">
              Divergências detectadas <span className="font-normal text-gray-400">no período selecionado.</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Revise as ocorrências e corrija as inconsistências encontradas.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Quick Actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: <Download size={18}/>, bg: 'bg-indigo-500/15', color: '#818cf8', title: 'Importar extrato',   sub: 'Traga seu extrato bancário',  to: '/import' },
  { icon: <FileText size={18}/>, bg: 'bg-cyan-500/15',   color: '#22d3ee', title: 'Gerar relatório',    sub: 'Baixe em PDF ou Excel',       to: '/reports' },
  { icon: <AlertTriangle size={18}/>, bg: 'bg-orange-500/15', color: '#f97316', title: 'Ver divergências', sub: 'Analise e resolva pendências', to: '/reconciliations?filter=divergent' },
  { icon: <Bell size={18}/>,     bg: 'bg-amber-500/15',  color: '#fbbf24', title: 'Configurar alertas', sub: 'Receba avisos importantes',    to: '/alerts' },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [fromDate, setFromDate] = useState(() => shiftLocalDaysFromToday(-6))
  const [toDate,   setToDate]   = useState(getLocalTodayYmd)
  const [verdictDismissed, setVerdictDismissed] = useState(false)

  function applyDatePreset(preset: DashboardDatePreset) {
    const today = getLocalTodayYmd()
    if (preset === 'today') {
      setFromDate(today)
      setToDate(today)
    } else if (preset === '7d') {
      setFromDate(shiftLocalDaysFromToday(-6))
      setToDate(today)
    } else {
      setFromDate(shiftLocalDaysFromToday(-29))
      setToDate(today)
    }
    setVerdictDismissed(false)
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey:        ['dashboard-overview', fromDate, toDate],
    queryFn:         () => dashboardService.getOverview({ fromDate, toDate }),
    staleTime:       0,
    refetchInterval: false,
  })

  const { data: pendingReview } = useQuery({
    queryKey:        ['pending-review'],
    queryFn:         () => reconciliationsService.getPendingReview(),
    staleTime:       0,
    refetchInterval: false,
  })

  const pendingReviewCount = pendingReview?.totalCount ?? 0

  if (isLoading) return <LoadingState />
  if (isError)   return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  if (!data)     return null

  const s    = data.summary
  const prev = data.previousPeriodSummary
  const ri   = s.reconciliationIssues

  const recvAmt = s.totalReceivedAmount
  const divAmt  = effectiveDivergenceAmount(s)
  const expAmt  = Number(s.totalExpectedAmount ?? 0)
  const isOk    = pendingReviewCount === 0 &&
    (ri.amountMismatch + (ri.paymentExceedsExpected ?? 0) + ri.duplicatePayment + ri.paymentWithoutCharge + ri.chargeWithoutPayment +
     ri.multipleMatchCandidates + ri.expiredChargePaid + ri.invalidReference + ri.processingError) === 0

  // ── Sparklines from flux ────────────────────────────────────────────────────
  const spExp  = sparkFromSeries(data.fluxSeries, 'expected')
  const spRecv = sparkFromSeries(data.fluxSeries, 'received')
  const spDiv  = sparkFromSeries(data.fluxSeries, 'divergent')

  // ── Trend percentages ───────────────────────────────────────────────────────
  const prevExpAmt  = Number(prev.totalExpectedAmount ?? 0)
  const prevRecvAmt = prev.totalReceivedAmount
  const prevDivAmt  = effectiveDivergenceAmount(prev)

  // ── Issue amounts ────────────────────────────────────────────────────────────
  const recentR = data.recentReconciliations
  const sumPaid = (st: ReconciliationStatus) =>
    recentR.filter(r => r.status === st).reduce((acc, r) => acc + r.paidAmount, 0)

  const issueAmts = {
    amountMismatch:       s.totalDivergentAmount,
    duplicatePayment:     sumPaid('DuplicatePayment'),
    paymentWithoutCharge: sumPaid('PaymentWithoutCharge'),
    expiredChargePaid:    sumPaid('ExpiredChargePaid'),
  }

  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <DashboardHeader
        title="Dashboard"
        subtitle="Visão geral da conciliação financeira em tempo real"
        fromDate={fromDate} toDate={toDate}
        updatedAt={data.updatedAt}
        onFromDateChange={v => { setFromDate(v); setVerdictDismissed(false) }}
        onToDateChange={v => { setToDate(v); setVerdictDismissed(false) }}
        onDatePreset={applyDatePreset}
      />

      {/* ── Banner de revisão pendente (aparece sempre que há itens) ─────────── */}
      <PendingReviewBanner count={pendingReviewCount} />

      {/* ── Row 1: Verdict + KPI cards ──────────────────────────────────────── */}
      {!verdictDismissed && (
        <div className="grid grid-cols-12 gap-4">
          {/* Verdict */}
          <div className="col-span-12 lg:col-span-4">
            <VerdictCard isOk={isOk} divergentAmt={divAmt} periodCloseable={s.periodCloseable} />
          </div>

          {/* KPI cards */}
          <div className="col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DashboardKpiCard
              title={METRIC_LABELS.expectedTotalTitle}
              value={formatCurrency(expAmt)}
              subtitle={METRIC_LABELS.expectedTotalSubtitle}
              sparkValues={spExp}
              lineColor="#38bdf8"
              trendPct={trendPct(expAmt, prevExpAmt)}
            />
            <DashboardKpiCard
              title="Total recebido"
              value={formatCurrency(recvAmt)}
              subtitle="Valor que entrou"
              sparkValues={spRecv}
              lineColor="#22c55e"
              trendPct={trendPct(recvAmt, prevRecvAmt)}
            />
            <DashboardKpiCard
              title="Diferença"
              value={formatCurrency(divAmt)}
              subtitle={isOk ? 'Sem divergências' : 'Valor em divergência'}
              sparkValues={spDiv}
              lineColor={isOk ? '#8b5cf6' : '#ef4444'}
              trendPct={trendPct(divAmt, prevDivAmt)}
            />
          </div>
        </div>
      )}

      {/* ── Row 2: Divergences + Chart ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DivergenceSummary ri={ri} amounts={issueAmts} />
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 flex flex-col">
          <FluxFinanceiroLineChart fluxSeries={data.fluxSeries} summary={s} />
        </div>
      </div>

      {/* ── Row 3: Tables ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Últimas conciliações */}
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
                  {['STATUS', 'REFERÊNCIA', 'ESPERADO', 'RECEBIDO', 'DIFERENÇA', 'DATA', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentReconciliations.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-600">Nenhuma conciliação no período.</td></tr>
                ) : data.recentReconciliations.map(r => {
                  const diff     = r.expectedAmount != null ? r.paidAmount - r.expectedAmount : null
                  const diffText = diff == null ? '—' : diff === 0 ? formatCurrency(0) : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`
                  const diffCls  = diff == null ? 'text-gray-600' : diff === 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'
                  return (
                    <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors">
                      <td className="px-4 py-3"><Badge status={r.status} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[130px] truncate">
                        {r.chargeReferenceId ?? <span className="text-gray-600 font-sans">PIX sem venda</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">
                        {r.expectedAmount != null ? formatCurrency(r.expectedAmount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-200 font-semibold tabular-nums">{formatCurrency(r.paidAmount)}</td>
                      <td className={`px-4 py-3 text-xs tabular-nums ${diffCls}`}>{diffText}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtShort(r.createdAt)}</td>
                      <td className="pr-3 text-right">
                        {r.chargeId ? (
                          <Link
                            to={`/charges/${r.chargeId}`}
                            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
                            title="Ver cobrança"
                          >
                            Cobrança <ChevronRight size={13} className="text-indigo-500/80" />
                          </Link>
                        ) : (
                          <ChevronRight size={13} className="text-gray-700 inline-block" />
                        )}
                      </td>
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

        {/* Últimos eventos de pagamento */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200">Últimos eventos de pagamento</h2>
            <Link to="/payment-events"
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 transition-colors">
              Ver todos
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {['EVENTO', 'REFERÊNCIA', 'VALOR', 'PROVEDOR', 'STATUS', 'RECEBIDO EM'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentPaymentEvents.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-600">Nenhum evento de pagamento no período.</td></tr>
                ) : data.recentPaymentEvents.map(e => (
                  <tr key={e.eventId} className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400">PIX recebido</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-300 max-w-[120px] truncate" title={e.referenceId ?? e.eventId}>
                      {e.referenceId ?? e.eventId.slice(0, 16)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-200 font-semibold tabular-nums text-right">{formatCurrency(e.paidAmount)}</td>
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

      {/* ── Row 4: Quick Actions ─────────────────────────────────────────────── */}
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
