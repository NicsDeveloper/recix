import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Download, Sparkles, GitMerge, ArrowRight,
  CheckCircle, AlertTriangle, Copy, Clock, Ban,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  MoreVertical, Zap, CreditCard, Banknote, SlidersHorizontal,
  Calendar,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { dashboardService } from '../services/dashboardService'
import { reconciliationsService } from '../services/reconciliationsService'
import { AiExplanationModal } from '../components/modals/AiExplanationModal'
import { LoadingState } from '../components/ui/LoadingState'
import { formatCurrency } from '../lib/formatters'
import type { RecentReconciliation, ReconciliationStatus, FluxPoint } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10) }
function sevenDaysAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 6)
  return d.toISOString().slice(0, 10)
}

function fmtDateShort(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}


function pctStr(part: number, total: number) {
  if (total === 0) return '0,0%'
  return `${(part / total * 100).toFixed(1).replace('.', ',')}%`
}

function isDivergent(status: ReconciliationStatus) {
  return ['AmountMismatch','DuplicatePayment','PaymentWithoutCharge','ExpiredChargePaid','InvalidReference','ProcessingError'].includes(status)
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="w-20 h-7" />
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const W = 80, H = 28
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 6) - 3
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={W} height={H}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, subtitle, sparkValues, color, textColor }: {
  title: string; value: string; subtitle: string
  sparkValues: number[]; color: string; textColor: string
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <p className="text-xs font-medium text-gray-400 mb-2">{title}</p>
      <p className={`text-2xl font-black tabular-nums leading-none ${textColor}`}>{value}</p>
      <div className="flex items-end justify-between mt-3">
        <p className="text-xs text-gray-500">{subtitle}</p>
        <Sparkline values={sparkValues} color={color} />
      </div>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

type BadgeCfg = { label: string; cls: string; icon: React.ReactNode }

const STATUS_MAP: Record<string, BadgeCfg> = {
  Matched:              { label: 'Conciliado',             cls: 'bg-green-500/15  text-green-400  border-green-500/25',  icon: <CheckCircle  size={11}/> },
  AmountMismatch:       { label: 'Valor divergente',       cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25', icon: <AlertTriangle size={11}/> },
  DuplicatePayment:     { label: 'Pagamento duplicado',    cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25', icon: <Copy         size={11}/> },
  PaymentWithoutCharge: { label: 'Pagamento sem cobrança', cls: 'bg-amber-500/15  text-amber-400  border-amber-500/25',  icon: <Ban          size={11}/> },
  ExpiredChargePaid:    { label: 'Cobrança expirada',      cls: 'bg-gray-500/15   text-gray-400   border-gray-500/25',   icon: <Clock        size={11}/> },
  InvalidReference:     { label: 'Ref. inválida',          cls: 'bg-purple-500/15 text-purple-400 border-purple-500/25', icon: <AlertTriangle size={11}/> },
  ProcessingError:      { label: 'Erro de proc.',          cls: 'bg-red-500/15    text-red-400    border-red-500/25',    icon: <AlertTriangle size={11}/> },
}

function ReconcStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, cls: 'bg-gray-500/15 text-gray-300 border-gray-500/25', icon: null }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

// ─── Payment Type ──────────────────────────────────────────────────────────────

function PaymentType({ provider }: { provider?: string | null }) {
  const p = (provider ?? '').toLowerCase()
  if (p.includes('boleto') || p.includes('billet'))
    return <span className="flex items-center gap-1.5 text-orange-400 text-xs"><Banknote size={13}/>Boleto</span>
  if (p.includes('card') || p.includes('cartao') || p.includes('credit') || p.includes('debit'))
    return <span className="flex items-center gap-1.5 text-purple-400 text-xs"><CreditCard size={13}/>Cartão</span>
  return <span className="flex items-center gap-1.5 text-green-400 text-xs"><Zap size={13}/>PIX</span>
}

// ─── Progress Donut ───────────────────────────────────────────────────────────

const DONUT_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#6b7280']

function ProgressDonut({ data }: { data: { label: string; value: number; pct: string; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const chartData = data.filter(d => d.value > 0)

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 h-full">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Progresso da conciliação</h3>
      <div className="flex items-start gap-4">
        {/* Donut */}
        <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData.length > 0 ? chartData : [{ label: 'Vazio', value: 1, color: '#1f2937' }]}
                dataKey="value" innerRadius={58} outerRadius={76} paddingAngle={2} stroke="none">
                {(chartData.length > 0 ? chartData : [{ color: '#1f2937' }]).map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-lg font-black text-gray-50 leading-none tabular-nums">
              {total.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">total</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 min-w-0 space-y-3">
          {data.map(d => (
            <div key={d.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-gray-300 truncate">{d.label}</span>
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-xs font-semibold text-gray-200 tabular-nums">{formatCurrency(d.value)}</span>
                <span className="text-[10px] text-gray-500">{d.pct}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-800">
        <Link to="/reconciliations?filter=divergent"
          className="inline-flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
          Ver detalhes do progresso <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}

// ─── Divergence Reasons ────────────────────────────────────────────────────────

type DivergenceRow = { label: string; amount: number; count: number; maxAmount: number }

function DivergenceReasons({ rows }: { rows: DivergenceRow[] }) {
  const max = Math.max(...rows.map(r => r.amount), 1)
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 h-full">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Divergências por motivo</h3>
      <div className="space-y-4">
        {rows.map(r => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-300">{r.label}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-200 font-semibold tabular-nums">{formatCurrency(r.amount)}</span>
                <span className="text-gray-500 w-4 text-right">{r.count}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full rounded-full bg-red-500 transition-all"
                style={{ width: `${(r.amount / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t border-gray-800">
        <Link to="/reconciliations?filter=divergent"
          className="inline-flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
          Ver todas as divergências <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}

// ─── By Day Chart ─────────────────────────────────────────────────────────────

function ByDayChart({ fluxSeries }: { fluxSeries: FluxPoint[] }) {
  const [period, setPeriod] = useState<'Por dia' | 'Por semana'>('Por dia')
  const [open, setOpen] = useState(false)

  const chartData = fluxSeries.map(p => ({
    label: p.label,
    conciliado: Math.max(0, p.received - p.divergent),
    pendente: Math.max(0, p.expected - p.received),
    divergente: Math.max(0, p.divergent),
  }))

  function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 shadow-xl">
        <p className="text-xs font-semibold text-gray-200 mb-1.5">{label}</p>
        {payload.map(p => (
          <div key={p.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="text-gray-400">{p.name}</span>
            <span className="font-bold tabular-nums" style={{ color: p.color }}>{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200">Conciliações por dia</h3>
        <div className="relative">
          <button onClick={() => setOpen(v => !v)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">
            {period} <ChevronRight size={11} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 w-28 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-10 overflow-hidden">
              {(['Por dia', 'Por semana'] as const).map(p => (
                <button key={p} onClick={() => { setPeriod(p); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${p === period ? 'text-indigo-400 bg-indigo-500/10' : 'text-gray-300 hover:bg-gray-700'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3">
        {[{ label: 'Conciliado', color: '#22c55e' }, { label: 'Pendente', color: '#3b82f6' }, { label: 'Divergente', color: '#ef4444' }].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: l.color }} />
            <span className="text-xs text-gray-400">{l.label}</span>
          </div>
        ))}
      </div>

      <div className="flex-1" style={{ minHeight: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }} barSize={10}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `R$${v/1000}k` : `R$${v}`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="conciliado" name="Conciliado" stackId="a" fill="#22c55e" radius={[0,0,0,0]} />
            <Bar dataKey="pendente"   name="Pendente"   stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
            <Bar dataKey="divergente" name="Divergente" stackId="a" fill="#ef4444" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, pageSize, total, onPage, onPageSize }: {
  page: number; pageSize: number; total: number
  onPage: (p: number) => void; onPageSize: (s: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    if (totalPages <= 5) return i + 1
    if (page <= 3) return i + 1
    if (page >= totalPages - 2) return totalPages - 4 + i
    return page - 2 + i
  })

  const btnCls = (active: boolean, disabled?: boolean) =>
    `h-8 min-w-[32px] px-1.5 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
      disabled ? 'text-gray-700 cursor-default' :
      active   ? 'bg-indigo-600 text-white' :
                 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
    }`

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 border-t border-gray-800">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Mostrar</span>
        <select value={pageSize} onChange={e => { onPageSize(Number(e.target.value)); onPage(1) }}
          className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1 focus:outline-none focus:border-indigo-500">
          {[10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-500">itens por página</span>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => onPage(1)}        disabled={page === 1}          className={btnCls(false, page === 1)}><ChevronsLeft  size={14}/></button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1}          className={btnCls(false, page === 1)}><ChevronLeft   size={14}/></button>
        {pages.map(p => <button key={p} onClick={() => onPage(p)} className={btnCls(p === page)}>{p}</button>)}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages}  className={btnCls(false, page >= totalPages)}><ChevronRight  size={14}/></button>
        <button onClick={() => onPage(totalPages)} disabled={page >= totalPages} className={btnCls(false, page >= totalPages)}><ChevronsRight size={14}/></button>
      </div>

      <p className="text-xs text-gray-500">
        {from}–{to} de {total.toLocaleString('pt-BR')} itens
      </p>
    </div>
  )
}

// ─── Filter Select ─────────────────────────────────────────────────────────────

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
      className="bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors h-9">
      <option value="">{label}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'by-charge' | 'by-event'

const STATUS_OPTIONS: { value: ReconciliationStatus; label: string }[] = [
  { value: 'Matched',              label: 'Conciliado' },
  { value: 'AmountMismatch',       label: 'Valor divergente' },
  { value: 'DuplicatePayment',     label: 'Pagamento duplicado' },
  { value: 'PaymentWithoutCharge', label: 'Pagamento sem cobrança' },
  { value: 'ExpiredChargePaid',    label: 'Cobrança expirada' },
  { value: 'InvalidReference',     label: 'Ref. inválida' },
  { value: 'ProcessingError',      label: 'Erro de proc.' },
]

export function ReconciliationsPage() {
  const [tab, setTab]               = useState<Tab>('overview')
  const [fromDate, setFromDate]     = useState(sevenDaysAgoISO)
  const [toDate, setToDate]         = useState(todayISO)
  const [statusFilter, setStatus]   = useState<ReconciliationStatus | ''>('')
  const [page, setPage]             = useState(1)
  const [pageSize, setPageSize]     = useState(10)
  const [aiTarget, setAiTarget]     = useState<{ id: string; status: ReconciliationStatus } | null>(null)
  const [, setSearchParams]         = useSearchParams()

  // ── Data ─────────────────────────────────────────────────────────────────────

  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['dashboard-overview', fromDate, toDate],
    queryFn:  () => dashboardService.getOverview({ fromDate, toDate }),
    staleTime: 20_000,
  })

  const { data: report } = useQuery({
    queryKey: ['closing-report', fromDate, toDate],
    queryFn:  () => dashboardService.getClosingReport({ fromDate, toDate }),
    staleTime: 20_000,
  })

  const { data: reconData, isLoading: reconLoading } = useQuery({
    queryKey: ['reconciliations-enriched', statusFilter, fromDate, toDate, page, pageSize],
    queryFn:  () => reconciliationsService.listEnriched({ status: statusFilter || undefined, fromDate, toDate, page, pageSize }),
    staleTime: 30_000,
  })

  // ── Computed: KPI sparks from flux ────────────────────────────────────────────

  const flux = overview?.fluxSeries ?? []
  const sparks = {
    conciliado: flux.map(p => Math.max(0, p.received - p.divergent)),
    pendente:   flux.map(p => Math.max(0, p.expected - p.received)),
    divergente: flux.map(p => p.divergent),
    esperado:   flux.map(p => p.expected),
  }

  // ── Computed: KPI amounts ─────────────────────────────────────────────────────

  const totalEsperado   = report?.expectedAmount  ?? 0
  const totalConciliado = report?.receivedAmount   ?? 0
  const totalPendente   = report?.pendingAmount    ?? 0
  const totalDivergente = report?.divergentAmount  ?? 0

  const conciliadoPct = pctStr(totalConciliado, totalEsperado)
  const pendentePct   = pctStr(totalPendente,   totalEsperado)
  const divergentePct = pctStr(totalDivergente, totalEsperado)

  // ── Computed: Donut ───────────────────────────────────────────────────────────

  const ri = overview?.summary.reconciliationIssues
  const pwcAmount = (reconData?.items ?? [])
    .filter(r => r.status === 'PaymentWithoutCharge')
    .reduce((s, r) => s + r.paidAmount, 0)

  const donutData = [
    { label: 'Conciliado',  value: totalConciliado, pct: conciliadoPct, color: DONUT_COLORS[0] },
    { label: 'Pendente',    value: totalPendente,   pct: pendentePct,   color: DONUT_COLORS[1] },
    { label: 'Divergente',  value: totalDivergente, pct: divergentePct, color: DONUT_COLORS[2] },
    { label: 'Sem origem',  value: pwcAmount,        pct: pctStr(pwcAmount, totalEsperado + pwcAmount), color: DONUT_COLORS[3] },
  ]

  // ── Computed: Divergence rows ─────────────────────────────────────────────────

  const allItems   = reconData?.items ?? []
  const divergenceRows: DivergenceRow[] = [
    {
      label: 'Valor diferente do esperado',
      count: ri?.amountMismatch ?? 0,
      amount: allItems.filter(r => r.status === 'AmountMismatch').reduce((s, r) => s + Math.abs((r.paidAmount ?? 0) - (r.expectedAmount ?? r.paidAmount)), 0),
      maxAmount: 0,
    },
    {
      label: 'Pagamento sem cobrança',
      count: ri?.paymentWithoutCharge ?? 0,
      amount: allItems.filter(r => r.status === 'PaymentWithoutCharge').reduce((s, r) => s + r.paidAmount, 0),
      maxAmount: 0,
    },
    {
      label: 'Pagamento duplicado',
      count: ri?.duplicatePayment ?? 0,
      amount: allItems.filter(r => r.status === 'DuplicatePayment').reduce((s, r) => s + r.paidAmount, 0),
      maxAmount: 0,
    },
    {
      label: 'Cobrança expirada',
      count: ri?.expiredChargePaid ?? 0,
      amount: allItems.filter(r => r.status === 'ExpiredChargePaid').reduce((s, r) => s + r.paidAmount, 0),
      maxAmount: 0,
    },
  ]

  // ── Computed: Table row rendering ─────────────────────────────────────────────

  const items        = reconData?.items ?? []
  const totalItems   = reconData?.totalCount ?? 0
  const divergentCnt = items.filter(r => isDivergent(r.status)).length

  function handleStatusFilter(v: string) {
    setStatus(v as ReconciliationStatus | '')
    setPage(1)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (v) next.set('status', v); else next.delete('status')
      next.delete('filter')
      return next
    })
  }

  const isLoading = ovLoading || reconLoading

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-50">Conciliações</h1>
          <p className="text-sm text-gray-500 mt-0.5">Relacione o que foi esperado com o que foi recebido</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 bg-gray-900 text-sm text-gray-300 hover:bg-gray-800 transition-colors font-medium">
            <Download size={14} /> Exportar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
            <Sparkles size={14} /> Gerar conciliação
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total conciliado"       value={formatCurrency(totalConciliado)} subtitle={`${conciliadoPct} do esperado`} sparkValues={sparks.conciliado} color="#22c55e" textColor="text-green-400" />
        <KpiCard title="Pendente de conciliação" value={formatCurrency(totalPendente)}  subtitle={`${pendentePct} do esperado`}   sparkValues={sparks.pendente}   color="#3b82f6" textColor="text-blue-400" />
        <KpiCard title="Divergências"            value={formatCurrency(totalDivergente)} subtitle={`${divergentePct} do esperado`} sparkValues={sparks.divergente} color="#f97316" textColor="text-orange-400" />
        <KpiCard title="Total esperado"          value={formatCurrency(totalEsperado)}  subtitle="100%"                           sparkValues={sparks.esperado}   color="#8b5cf6" textColor="text-purple-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
        {([
          { id: 'overview',   label: 'Visão geral' },
          { id: 'by-charge',  label: 'Por cobrança' },
          { id: 'by-event',   label: 'Por evento' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-xs text-gray-300 h-9">
          <Calendar size={13} className="text-gray-500" />
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1) }}
            className="bg-transparent text-xs text-gray-300 focus:outline-none w-28" />
          <span className="text-gray-600">-</span>
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1) }}
            className="bg-transparent text-xs text-gray-300 focus:outline-none w-28" />
        </div>

        <FilterSelect label="Cliente" value="" options={[]} onChange={() => {}} />
        <FilterSelect label="Status"  value={statusFilter} options={STATUS_OPTIONS} onChange={handleStatusFilter} />
        <FilterSelect label="Tipo"    value="" options={[{ value: 'pix', label: 'PIX' }, { value: 'boleto', label: 'Boleto' }]} onChange={() => {}} />
        <FilterSelect label="Método"  value="" options={[]} onChange={() => {}} />
        <FilterSelect label="Valor"   value="" options={[]} onChange={() => {}} />

        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-xs text-gray-300 hover:bg-gray-800 h-9 transition-colors">
          <SlidersHorizontal size={13} /> Mais filtros
        </button>
      </div>

      {/* Analytics panels */}
      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ProgressDonut data={donutData} />
          <DivergenceReasons rows={divergenceRows} />
          <ByDayChart fluxSeries={flux} />
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Conciliações</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalItems.toLocaleString('pt-BR')} resultado{totalItems !== 1 ? 's' : ''} no período
              {divergentCnt > 0 && <span className="ml-2 text-orange-400">· {divergentCnt} divergente{divergentCnt !== 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['STATUS', 'REFERÊNCIA', 'TIPO', 'ESPERADO', 'RECEBIDO', 'DIFERENÇA', 'DATA', 'AÇÃO'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reconLoading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">Carregando...</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <GitMerge size={24} className="mx-auto text-gray-700 mb-2" />
                    <p className="text-sm text-gray-500">Nenhuma conciliação no período selecionado.</p>
                  </td>
                </tr>
              ) : items.map(r => <ReconciliationRow key={r.id} r={r} onAi={() => setAiTarget({ id: r.id, status: r.status })} />)}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={pageSize} total={totalItems} onPage={setPage} onPageSize={setPageSize} />
      </div>

      {aiTarget && (
        <AiExplanationModal
          reconciliationId={aiTarget.id}
          status={aiTarget.status}
          onClose={() => setAiTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Row component (extracted to avoid closure cost) ─────────────────────────

function ReconciliationRow({ r, onAi }: { r: RecentReconciliation; onAi: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const diff = r.expectedAmount != null ? r.paidAmount - r.expectedAmount : null

  const diffEl = diff == null ? <span className="text-gray-600">—</span>
    : diff === 0 ? <span className="text-green-400 font-bold tabular-nums">{formatCurrency(0)}</span>
    : <span className={`font-bold tabular-nums ${diff > 0 ? 'text-orange-400' : 'text-red-400'}`}>
        {diff > 0 ? '+' : ''}{formatCurrency(diff)}
      </span>

  const reference = r.chargeReferenceId ?? r.paymentEventId

  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors">
      <td className="px-4 py-3"><ReconcStatusBadge status={r.status} /></td>
      <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[160px] truncate" title={reference}>
        {reference || <span className="text-gray-600 font-sans not-italic">—</span>}
      </td>
      <td className="px-4 py-3"><PaymentType provider={r.provider} /></td>
      <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">
        {r.expectedAmount != null ? formatCurrency(r.expectedAmount) : <span className="text-gray-600">—</span>}
      </td>
      <td className="px-4 py-3 text-xs text-gray-200 font-semibold tabular-nums">
        {r.status === 'PaymentWithoutCharge' && r.expectedAmount == null
          ? formatCurrency(r.paidAmount)
          : formatCurrency(r.paidAmount)}
      </td>
      <td className="px-4 py-3 text-xs">{diffEl}</td>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateShort(r.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {r.chargeReferenceId ? (
            <Link to={`/charges`}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap">
              Ver detalhes <ArrowRight size={11} />
            </Link>
          ) : null}
          {isDivergent(r.status) && (
            <div className="relative">
              <button onClick={() => setMenuOpen(v => !v)} onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-10 overflow-hidden">
                  <button onClick={() => { onAi(); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                    <Sparkles size={12} /> Explicar com IA
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
