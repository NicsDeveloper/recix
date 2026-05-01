import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, CheckCircle, Copy, Ban, Clock,
  ArrowRight, ShoppingBag, Building2, TrendingUp,
  Download, FileText, Bell, ChevronRight, Info,
} from 'lucide-react'
import { dashboardService } from '../services/dashboardService'
import { LoadingState }     from '../components/ui/LoadingState'
import { ErrorState }       from '../components/ui/ErrorState'
import { DashboardHeader }  from '../components/layout/DashboardHeader'
import { FluxFinanceiroLineChart } from '../components/dashboard/FluxFinanceiroLineChart'
import type { ReconciliationStatus } from '../types'
import { formatCurrency, formatDateTime } from '../lib/formatters'

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
  isOk, divergentAmt, receivedAmt, expectedAmt,
}: { isOk: boolean; divergentAmt: number; receivedAmt: number; expectedAmt: number }) {
  const navigate = useNavigate()

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-gray-800">

        {/* ── Alert panel ── */}
        <div className="flex items-start gap-4 p-6">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isOk ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
            {isOk
              ? <CheckCircle size={22} className="text-green-400" />
              : <AlertTriangle size={22} className="text-red-400" />}
          </div>
          <div>
            <p className={`text-xs font-bold mb-1 ${isOk ? 'text-green-400' : 'text-red-400'}`}>
              {isOk ? 'Tudo certo!' : 'Atenção!'}
            </p>
            {isOk ? (
              <>
                <p className="text-xl font-bold text-gray-50 leading-snug">
                  Seus pagamentos estão <span className="text-green-400">conciliados</span>
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Todos os valores recebidos batem com o esperado.
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-gray-50 leading-snug">
                  Seu financeiro <span className="text-orange-400">NÃO</span> está conciliado
                </p>
                <p className="text-sm text-gray-400 mt-1">Encontramos divergências que totalizam</p>
                <p className="text-3xl font-black text-red-400 tabular-nums mt-1.5 tracking-tight">
                  {formatCurrency(divergentAmt)}
                </p>
                <button
                  onClick={() => navigate('/reconciliations?status=AmountMismatch')}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold transition-all"
                >
                  Ver divergências <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Metric: Total esperado ── */}
        <MetricPanel
          label="Total esperado"
          value={formatCurrency(expectedAmt)}
          sub="Valor das vendas"
          valueCls="text-sky-400"
          icon={<ShoppingBag size={26} className="text-teal-400" />}
          iconBg="bg-teal-500/15"
        />

        {/* ── Metric: Total recebido ── */}
        <MetricPanel
          label="Total recebido"
          value={formatCurrency(receivedAmt)}
          sub="Valor que entrou"
          valueCls="text-green-400"
          icon={<Building2 size={26} className="text-green-400" />}
          iconBg="bg-green-500/15"
        />

        {/* ── Metric: Diferença ── */}
        <MetricPanel
          label="Diferença"
          value={formatCurrency(divergentAmt)}
          sub={divergentAmt > 0 ? 'Acima do esperado' : divergentAmt < 0 ? 'Abaixo do esperado' : 'Tudo conciliado'}
          valueCls={isOk ? 'text-green-400' : 'text-red-400'}
          icon={<TrendingUp size={26} className={isOk ? 'text-green-400' : 'text-red-400'} />}
          iconBg={isOk ? 'bg-green-500/15' : 'bg-red-500/15'}
        />
      </div>
    </div>
  )
}

function MetricPanel({ label, value, sub, valueCls, icon, iconBg }: {
  label: string; value: string; sub: string
  valueCls: string; icon: React.ReactNode; iconBg: string
}) {
  return (
    <div className="flex flex-col justify-between p-6 gap-3">
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-xs text-gray-400 font-medium">{label}</p>
          <Info size={11} className="text-gray-600" />
        </div>
        <p className={`text-2xl font-black tabular-nums tracking-tight leading-none ${valueCls}`}>
          {value}
        </p>
        <p className="text-xs text-gray-500 mt-1.5">{sub}</p>
      </div>
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
    </div>
  )
}

// ─── Problems section ─────────────────────────────────────────────────────────

const PROBLEM_DEFS = [
  { key: 'amountMismatch',       icon: <AlertTriangle size={18} />, color: '#ef4444', bg: 'bg-red-500/15',    label: 'Valor divergente',    getAmt: (s: { totalDivergentAmount: number }) => s.totalDivergentAmount },
  { key: 'duplicatePayment',     icon: <Copy         size={18} />, color: '#f97316', bg: 'bg-orange-500/15', label: 'Pagamento duplicado', getAmt: () => 0 },
  { key: 'paymentWithoutCharge', icon: <Ban          size={18} />, color: '#eab308', bg: 'bg-yellow-500/15', label: 'Sem cobrança',        getAmt: () => 0 },
  { key: 'expiredChargePaid',    icon: <Clock        size={18} />, color: '#6b7280', bg: 'bg-gray-500/15',   label: 'Cobrança expirada',   getAmt: () => 0 },
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
  { icon: <Download size={18} />,      bg: 'bg-indigo-500/15', color: '#818cf8', title: 'Importar extrato',    sub: 'Importe um novo arquivo',         to: '/import' },
  { icon: <FileText size={18} />,      bg: 'bg-cyan-500/15',   color: '#22d3ee', title: 'Gerar relatório',     sub: 'Baixe o relatório do período',     to: '/reports' },
  { icon: <AlertTriangle size={18} />, bg: 'bg-orange-500/15', color: '#f97316', title: 'Ver divergências',    sub: 'Analise todas as divergências',    to: '/reconciliations?status=AmountMismatch' },
  { icon: <Bell size={18} />,          bg: 'bg-purple-500/15', color: '#a78bfa', title: 'Configurar alertas',  sub: 'Receba avisos importantes',        to: '/settings' },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [fromDate, setFromDate] = useState(todayISO)
  const [toDate,   setToDate]   = useState(todayISO)

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
  const divAmt  = s.totalDivergentAmount
  const expAmt  = Math.max(0, recvAmt - divAmt)

  return (
    <div className="space-y-5">

      {/* Header */}
      <DashboardHeader
        title="Dashboard"
        subtitle="Visão geral da sua conciliação financeira em tempo real"
        fromDate={fromDate} toDate={toDate}
        updatedAt={data.updatedAt}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
      />

      {/* 1 — Verdict */}
      <VerdictBlock isOk={isOk} divergentAmt={divAmt} receivedAmt={recvAmt} expectedAmt={expAmt} />

      {/* 2 — Problems + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Problems */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-200">Resumo das divergências</h2>
            <Link to="/reconciliations?status=AmountMismatch"
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
                amount={p.getAmt(s)}
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
                  {['STATUS', 'COBRANÇA', 'ESPERADO', 'PAGO', 'DIFERENÇA', 'DATA', ''].map(h => (
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
