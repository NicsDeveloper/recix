import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Download, Sparkles, GitMerge, ArrowRight,
  CheckCircle, AlertTriangle, Copy, Clock, Ban,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown,
  MoreVertical, Zap, CreditCard, Banknote, SlidersHorizontal,
  Calendar, Eye, X, ThumbsUp, ThumbsDown, Info, Circle, Check,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { dashboardService } from '../services/dashboardService'
import { reconciliationsService } from '../services/reconciliationsService'
import { Header } from '../components/layout/Header'
import { AiExplanationModal } from '../components/modals/AiExplanationModal'
import { LoadingState } from '../components/ui/LoadingState'
import { formatCurrency } from '../lib/formatters'
import { getLocalTodayYmd, shiftLocalDaysFromToday } from '../lib/dateRangeParam'
import { METRIC_LABELS } from '../lib/metricLabels'
import type { ChargeReconciliationSummary, RecentReconciliation, ReconciliationStatus, FluxPoint, PendingReviewItem } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateShort(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}


function pctStr(part: number, total: number) {
  if (total === 0) return '0,0%'
  return `${(part / total * 100).toFixed(1).replace('.', ',')}%`
}

function isDivergent(status: ReconciliationStatus) {
  return ['AmountMismatch','PaymentExceedsExpected','DuplicatePayment','PaymentWithoutCharge','ChargeWithoutPayment',
          'ExpiredChargePaid','InvalidReference','ProcessingError','MultipleMatchCandidates'].includes(status)
}

const AGG_STATUS_PT: Record<string, string> = {
  Conciliado: 'Conciliado',
  Parcial: 'Parcial',
  Divergente: 'Divergente',
  EmRevisao: 'Em revisão',
  SemAlocacao: 'Sem alocação',
}

function AggregateStatusBadge({ status }: { status: string }) {
  const label = AGG_STATUS_PT[status] ?? status
  const strong = status === 'Divergente' || status === 'EmRevisao'
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${
      strong ? 'bg-orange-500/20 text-orange-200 border-orange-500/40 ring-1 ring-orange-500/15'
        : status === 'Conciliado' ? 'bg-green-500/15 text-green-300 border-green-500/30'
          : status === 'Parcial' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
            : 'bg-gray-700/50 text-gray-400 border-gray-600'
    }`}>
      {label}
    </span>
  )
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
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs text-gray-500 mb-2">{title}</p>
      <p className={`text-2xl font-semibold tabular-nums leading-none ${textColor}`}>{value}</p>
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
  // Sucesso
  Matched:                { label: 'Conciliado',              cls: 'bg-green-500/15  text-green-400  border-green-500/25',  icon: <CheckCircle   size={11}/> },
  MatchedLowConfidence:   { label: 'Revisar match',           cls: 'bg-amber-500/15  text-amber-400  border-amber-500/25',  icon: <AlertTriangle size={11}/> },
  PartialPayment:         { label: 'Parcial',                 cls: 'bg-sky-500/15    text-sky-400    border-sky-500/25',    icon: <Banknote      size={11}/> },
  // Divergências
  AmountMismatch:         { label: 'Valor divergente',        cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25', icon: <AlertTriangle size={11}/> },
  PaymentExceedsExpected: { label: 'Excedente',               cls: 'bg-rose-500/15   text-rose-400   border-rose-500/25',   icon: <AlertTriangle size={11}/> },
  DuplicatePayment:       { label: 'Pag. duplicado',          cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25', icon: <Copy          size={11}/> },
  ExpiredChargePaid:      { label: 'Cobrança expirada',       cls: 'bg-gray-500/15   text-gray-400   border-gray-500/25',   icon: <Clock         size={11}/> },
  // Ausência
  PaymentWithoutCharge:   { label: 'Pag. sem cobrança',       cls: 'bg-amber-500/15  text-amber-400  border-amber-500/25',  icon: <Ban           size={11}/> },
  ChargeWithoutPayment:   { label: 'Venda sem pagamento',     cls: 'bg-red-500/15    text-red-400    border-red-500/25',    icon: <Ban           size={11}/> },
  MultipleMatchCandidates:{ label: 'Múlt. candidatos',        cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25', icon: <AlertTriangle size={11}/> },
  // Erros
  InvalidReference:       { label: 'Ref. inválida',           cls: 'bg-purple-500/15 text-purple-400 border-purple-500/25', icon: <AlertTriangle size={11}/> },
  ProcessingError:        { label: 'Erro de proc.',           cls: 'bg-red-500/15    text-red-400    border-red-500/25',    icon: <AlertTriangle size={11}/> },
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
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 h-full">
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
            <p className="text-lg font-semibold text-gray-50 leading-none tabular-nums">
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
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 h-full">
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
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 h-full flex flex-col">
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
      className="bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-colors h-9">
      <option value="">{label}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ─── Match Reason Labels ───────────────────────────────────────────────────────

const MATCH_REASON_LABEL: Record<string, string> = {
  ExactExternalChargeId:  'ID da cobrança no pagamento (exato)',
  ExactReferenceId:         'Código RECIX / referência (exato)',
  ValueWithinTimeWindow:  'Mesmo valor e data próxima',
  ValueFifo:                'Mesmo valor — fila de cobranças pendentes',
  NoMatch:                  'Nenhum candidato encontrado',
  AlreadySettled:           'Cobrança já conciliada',
  InvalidReference:         'Referência não encontrada',
  MultipleCandidates:       'Várias cobranças possíveis',
  FoundWithAmountMismatch:  'Cobrança encontrada, valor diferente',
  FoundButExpired:          'Cobrança encontrada, mas expirada',
  CumulativeSettlement:     'Soma de pagamentos completou o valor',
  PaymentExceedsBalance:    'Pagamento excede saldo pendente',
}

const CONFIDENCE_LABEL: Record<string, { label: string; color: string }> = {
  High:   { label: 'Alta confiança',        color: 'text-green-400' },
  Medium: { label: 'Confirme se faz sentido', color: 'text-amber-300' },
  Low:    { label: 'Confirme se faz sentido', color: 'text-amber-300' },
}

function formatReviewDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function reviewGuidanceParagraph(item: PendingReviewItem): string {
  if (item.matchReason === 'ValueFifo') {
    return 'Os valores coincidem, mas o extrato não trouxe um identificador que amarre só a esta cobrança. O sistema sugeriu a cobrança pendente mais antiga com o mesmo valor. Confirme se este crédito no banco é realmente desta venda — e não de outra com o mesmo preço.'
  }
  if (item.matchReason === 'MultipleCandidates') {
    return 'Há mais de uma cobrança que encaixa neste pagamento. Confirme qual delas recebeu este valor.'
  }
  if (item.matchReason === 'ValueWithinTimeWindow') {
    return 'O sistema associou por valor e data próxima, sem código único. Confirme se a data do pagamento e o valor batem com o que sabe da venda.'
  }
  return item.reason || 'Confirme se o pagamento listado corresponde à cobrança sugerida.'
}

// ─── Trilha técnica (opcional, para auditoria) ────────────────────────────────

function MatchTrailTechnical({ item }: { item: PendingReviewItem }) {
  const steps = [
    { label: 'ID da cobrança no pagamento (PIX / gateway)', success: item.matchReason === 'ExactExternalChargeId' },
    { label: 'Código RECIX ou referência na cobrança',     success: item.matchReason === 'ExactReferenceId' },
    { label: 'Mesmo valor e data dentro da janela',        success: item.matchReason === 'ValueWithinTimeWindow' },
    { label: 'Mesmo valor na fila de cobranças pendentes',  success: item.matchReason === 'ValueFifo' },
  ]

  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          {s.success
            ? <Check size={14} className="text-green-400 flex-shrink-0" strokeWidth={2.5} />
            : <Circle size={12} className="text-gray-600 flex-shrink-0" />}
          <span className={s.success ? 'text-gray-200' : 'text-gray-500'}>
            {s.label}
            {s.success && <span className="text-gray-600 font-normal"> — usado nesta sugestão</span>}
          </span>
        </div>
      ))}
      <p className="text-[10px] text-gray-600 pt-1">
        Campo técnico: {MATCH_REASON_LABEL[item.matchReason] ?? item.matchReason}
      </p>
    </div>
  )
}

// ─── Review Panel (slide-over) ────────────────────────────────────────────────

function ReviewPanel({
  item,
  onClose,
  onConfirm,
  onReject,
  isSubmitting,
}: {
  item: PendingReviewItem
  onClose: () => void
  onConfirm: () => void
  onReject: () => void
  isSubmitting: boolean
}) {
  const confidence = CONFIDENCE_LABEL[item.confidence] ?? { label: item.confidence, color: 'text-gray-400' }
  const diff = item.expectedAmount != null ? item.paidAmount - item.expectedAmount : null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-gray-900 border-l border-gray-700 shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-gray-200">Confirmar vínculo</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="text-xs font-semibold text-amber-300 mb-1.5">Sugestão do sistema — vale conferir</p>
            <p className={`text-xs font-medium ${confidence.color} mb-2`}>{confidence.label}</p>
            <p className="text-sm text-gray-300 leading-relaxed">{reviewGuidanceParagraph(item)}</p>
          </div>

          {/* Cobrança vs pagamento — base objectiva para o humano */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">O que comparar</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl border border-gray-800 bg-gray-800/40 p-3">
                <p className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wide mb-2">Cobrança (esperado)</p>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">Valor</dt>
                    <dd className="text-gray-200 font-semibold tabular-nums text-right">
                      {item.expectedAmount != null ? formatCurrency(item.expectedAmount) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">Código</dt>
                    <dd className="text-gray-200 font-mono text-[11px] text-right truncate" title={item.chargeReferenceId ?? ''}>
                      {item.chargeReferenceId ?? '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">ID no ERP / arquivo</dt>
                    <dd className="text-gray-400 font-mono text-[11px] text-right truncate" title={item.chargeExternalId ?? ''}>
                      {item.chargeExternalId ?? '—'}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-800/40 p-3">
                <p className="text-[10px] font-semibold text-emerald-300/90 uppercase tracking-wide mb-2">Pagamento (recebido)</p>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">Valor</dt>
                    <dd className="text-gray-200 font-semibold tabular-nums text-right">{formatCurrency(item.paidAmount)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">ID no extrato</dt>
                    <dd className="text-gray-200 font-mono text-[11px] text-right truncate" title={item.paymentTransactionId ?? ''}>
                      {item.paymentTransactionId ?? '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">Data do crédito</dt>
                    <dd className="text-gray-400 text-right">{formatReviewDateTime(item.paymentPaidAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 shrink-0">Origem</dt>
                    <dd className="text-gray-400 text-right truncate" title={item.paymentProvider ?? ''}>
                      {item.paymentProvider ?? '—'}
                      {item.paymentReferenceId ? (
                        <span className="block text-[10px] text-gray-500 mt-0.5 font-mono truncate" title={item.paymentReferenceId}>
                          Ref.: {item.paymentReferenceId}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Resumo numérico</p>
            <div className="rounded-xl border border-gray-800 bg-gray-800/50 divide-y divide-gray-800">
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-400">Diferença</span>
                <span className={`font-bold tabular-nums ${diff == null ? 'text-gray-500' : diff === 0 ? 'text-green-400' : diff > 0 ? 'text-orange-400' : 'text-red-400'}`}>
                  {diff == null ? '—' : <>{diff > 0 ? '+' : ''}{formatCurrency(diff)}</>}
                </span>
              </div>
            </div>
          </div>

          <details className="group rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
            <summary className="px-4 py-3 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-300 list-none flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Info size={13} className="text-gray-500" />
                Detalhes técnicos (auditoria)
              </span>
              <span className="text-[10px] text-gray-600 group-open:hidden">mostrar</span>
              <span className="text-[10px] text-gray-600 hidden group-open:inline">ocultar</span>
            </summary>
            <div className="px-4 pb-4 pt-0 border-t border-gray-800/80">
              <MatchTrailTechnical item={item} />
            </div>
          </details>

          <div className="rounded-xl border border-gray-800 bg-gray-800/30 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 mb-2">Ações</p>
            <div className="flex items-start gap-2 text-xs text-gray-500">
              <ThumbsUp size={12} className="text-green-400 mt-0.5 flex-shrink-0" />
              <span><span className="text-green-400 font-medium">Confirmar</span> — torna o vínculo definitivo e marca a cobrança como paga.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-gray-500">
              <ThumbsDown size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
              <span><span className="text-red-400 font-medium">Rejeitar</span> — descarta esta sugestão; a cobrança volta a pendente e o pagamento pode ser casado de outra forma.</span>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="p-5 border-t border-gray-800 flex gap-3">
          <button
            onClick={onReject}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-red-400 border border-red-500/25 bg-red-500/5 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            <ThumbsDown size={14} /> Rejeitar
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-green-400 border border-green-500/25 bg-green-500/8 rounded-xl hover:bg-green-500/15 transition-colors disabled:opacity-50"
          >
            <ThumbsUp size={14} /> Confirmar
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Pending Review Tab ────────────────────────────────────────────────────────

function PendingReviewTab() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<PendingReviewItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['pending-review'],
    queryFn:  () => reconciliationsService.getPendingReview(),
    staleTime: 30_000,
  })

  function invalidateReconciliationViews() {
    queryClient.invalidateQueries({ queryKey: ['pending-review'] })
    queryClient.invalidateQueries({ queryKey: ['reconciliations-enriched'] })
    // KPIs desta página vêm de closing-report + dashboard-overview (prefixo = qualquer intervalo de datas)
    queryClient.invalidateQueries({ queryKey: ['closing-report'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
  }

  const confirm = useMutation({
    mutationFn: (id: string) => reconciliationsService.confirmMatch(id),
    onSuccess: () => {
      invalidateReconciliationViews()
      setSelected(null)
    },
  })

  const reject = useMutation({
    mutationFn: (id: string) => reconciliationsService.rejectMatch(id),
    onSuccess: () => {
      invalidateReconciliationViews()
      setSelected(null)
    },
  })

  const isSubmitting = confirm.isPending || reject.isPending
  const items = data?.items ?? []

  if (isLoading) return <LoadingState />

  return (
    <div>
      {selected && (
        <ReviewPanel
          item={selected}
          onClose={() => setSelected(null)}
          onConfirm={() => confirm.mutate(selected.id)}
          onReject={() => reject.mutate(selected.id)}
          isSubmitting={isSubmitting}
        />
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
          <CheckCircle size={32} className="mx-auto text-green-400 mb-3" />
          <p className="text-sm font-semibold text-gray-200 mb-1">Nenhum item pendente</p>
          <p className="text-xs text-gray-500">Todas as conciliações estão resolvidas. O período pode ser fechado.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800 bg-amber-500/5">
            <Eye size={15} className="text-amber-400" />
            <div>
              <h2 className="text-sm font-semibold text-gray-200">
                {items.length} item{items.length !== 1 ? 's' : ''} pendente{items.length !== 1 ? 's' : ''}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Ordenado por valor — maior impacto financeiro primeiro</p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Situação', 'Revisão', 'Como casou', 'Esperado', 'Recebido', 'Diferença', 'Data', 'Ação'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const conf = CONFIDENCE_LABEL[item.confidence] ?? { label: item.confidence, color: 'text-gray-400' }
                const diff = item.expectedAmount != null ? item.paidAmount - item.expectedAmount : null

                return (
                  <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs text-amber-300/90 font-medium">
                        {item.status === 'MultipleMatchCandidates'
                          ? 'Várias cobranças possíveis'
                          : 'Mesmo valor — conferir se é esta venda'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${conf.color}`}>{conf.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate" title={MATCH_REASON_LABEL[item.matchReason] ?? item.matchReason}>
                      {MATCH_REASON_LABEL[item.matchReason] ?? item.matchedField ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">
                      {item.expectedAmount != null ? formatCurrency(item.expectedAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-200 font-semibold tabular-nums">
                      {formatCurrency(item.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      {diff == null ? <span className="text-gray-600">—</span>
                        : diff === 0 ? <span className="text-green-400 font-bold">{formatCurrency(0)}</span>
                        : <span className={`font-bold ${diff > 0 ? 'text-orange-400' : 'text-red-400'}`}>
                            {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                          </span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 border border-amber-500/25 bg-amber-500/8 rounded-lg hover:bg-amber-500/15 transition-colors whitespace-nowrap"
                      >
                        <Eye size={11} /> Revisar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'by-charge' | 'by-event'

const STATUS_OPTIONS: { value: ReconciliationStatus; label: string }[] = [
  { value: 'Matched',                  label: 'Conciliado' },
  { value: 'MatchedLowConfidence',     label: 'Revisar match' },
  { value: 'PartialPayment',           label: 'Pagamento parcial' },
  { value: 'AmountMismatch',           label: 'Valor divergente' },
  { value: 'PaymentExceedsExpected',   label: 'Valor excedente' },
  { value: 'DuplicatePayment',         label: 'Pagamento duplicado' },
  { value: 'PaymentWithoutCharge',     label: 'Pagamento sem cobrança' },
  { value: 'ChargeWithoutPayment',     label: 'Venda sem pagamento' },
  { value: 'MultipleMatchCandidates',  label: 'Múltiplos candidatos' },
  { value: 'ExpiredChargePaid',        label: 'Cobrança expirada' },
  { value: 'InvalidReference',         label: 'Referência inválida' },
  { value: 'ProcessingError',          label: 'Erro de processamento' },
]


export function ReconciliationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | 'review' | null
  const initialTab: Tab | 'review' =
    tabParam === 'by-charge' || tabParam === 'by-event' ? tabParam
      : tabParam === 'overview' ? 'overview'
        : 'review'
  const [tab, setTab] = useState<Tab | 'review'>(initialTab)
  const [fromDate, setFromDate]     = useState(() => shiftLocalDaysFromToday(-6))
  const [toDate, setToDate]         = useState(getLocalTodayYmd)
  const [page, setPage]             = useState(1)
  const [pageSize, setPageSize]     = useState(10)
  const [aiTarget, setAiTarget]     = useState<{ id: string; status: ReconciliationStatus } | null>(null)

  // ?filter=divergent pré-seleciona o primeiro status divergente; ?status=X seleciona um específico
  const filterParam  = searchParams.get('filter')
  const statusParam  = searchParams.get('status') as ReconciliationStatus | null
  const initialStatus: ReconciliationStatus | '' =
    statusParam ?? (filterParam === 'divergent' ? 'AmountMismatch' : '')

  const [statusFilter, setStatus] = useState<ReconciliationStatus | ''>(initialStatus)

  function goTab(next: Tab | 'review') {
    setTab(next)
    setSearchParams(prev => {
      const n = new URLSearchParams(prev)
      if (next === 'overview') n.delete('tab')
      else n.set('tab', next)
      return n
    }, { replace: true })
  }

  // ── Data ─────────────────────────────────────────────────────────────────────

  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['dashboard-overview', fromDate, toDate],
    queryFn:  () => dashboardService.getOverview({ fromDate, toDate }),
    staleTime: 0,
    refetchInterval: false,
  })

  const { data: report } = useQuery({
    queryKey: ['closing-report', fromDate, toDate],
    queryFn:  () => dashboardService.getClosingReport({ fromDate, toDate }),
    staleTime: 0,
    refetchInterval: false,
  })

  const { data: pendingReviewData } = useQuery({
    queryKey: ['pending-review'],
    queryFn:  () => reconciliationsService.getPendingReview(),
    staleTime: 0,
    refetchInterval: false,
  })
  const pendingCount = pendingReviewData?.totalCount ?? 0

  const isDivergentMode = filterParam === 'divergent' && !statusParam
  const effectiveStatus = isDivergentMode ? undefined : (statusFilter || undefined)

  const { data: reconData, isLoading: reconLoading } = useQuery({
    queryKey: ['reconciliations-enriched', effectiveStatus, isDivergentMode, fromDate, toDate, page, pageSize],
    queryFn:  () => reconciliationsService.listEnriched({
      status: effectiveStatus,
      divergentOnly: isDivergentMode || undefined,
      fromDate, toDate, page, pageSize,
    }),
    staleTime: 0,
    refetchInterval: false,
    enabled: tab === 'overview' || tab === 'by-event',
  })

  const [expandedCharge, setExpandedCharge] = useState<string | null>(null)

  const { data: byChargeData, isLoading: byChargeLoading } = useQuery({
    queryKey: ['charge-recon-summaries', fromDate, toDate, page, pageSize],
    queryFn: () => dashboardService.getChargeReconciliationSummaries({ fromDate, toDate, page, pageSize }),
    enabled: tab === 'by-charge',
    staleTime: 0,
  })

  useEffect(() => {
    setPage(1)
    setExpandedCharge(null)
  }, [tab])

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
  const totalItems   = tab === 'by-charge' ? (byChargeData?.totalCount ?? 0) : (reconData?.totalCount ?? 0)
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

  const isLoading = ovLoading || (tab === 'by-charge' ? byChargeLoading : reconLoading)

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Header
        title="Conciliações"
        subtitle={(
          <>
            <span>
              Auditoria financeira: bate o que caiu no banco com o esperado, divergências e origem do evento.{' '}
              <Link to="/charges" className="font-medium whitespace-nowrap">Ir para cobranças (operacional)</Link>.
            </span>
            <span className="block text-xs text-gray-500">
              KPIs e gráficos usam o fechamento e a visão geral do período selecionado nos filtros abaixo.
            </span>
          </>
        )}
        action={(
          <>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-800 bg-gray-950 text-sm font-medium text-gray-300 hover:bg-gray-800/80 transition-colors"
            >
              <Download size={14} /> Exportar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              <Sparkles size={14} /> Gerar conciliação
            </button>
          </>
        )}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total conciliado"       value={formatCurrency(totalConciliado)} subtitle={`${conciliadoPct} do esperado`} sparkValues={sparks.conciliado} color="#22c55e" textColor="text-green-400" />
        <KpiCard title="Pendente de conciliação" value={formatCurrency(totalPendente)}  subtitle={`${pendentePct} do esperado`}   sparkValues={sparks.pendente}   color="#3b82f6" textColor="text-blue-400" />
        <KpiCard title="Divergências"            value={formatCurrency(totalDivergente)} subtitle={`${divergentePct} do esperado`} sparkValues={sparks.divergente} color="#f97316" textColor="text-orange-400" />
        <KpiCard title={METRIC_LABELS.expectedTotalTitle} value={formatCurrency(totalEsperado)} subtitle="Mesmo total do fechamento no período" sparkValues={sparks.esperado} color="#8b5cf6" textColor="text-purple-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
        <button onClick={() => goTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'overview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
          Visão geral
        </button>
        <button onClick={() => goTab('by-charge')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'by-charge' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
          Por cobrança
        </button>
        <button onClick={() => goTab('by-event')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'by-event' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
          Por evento
        </button>
        <button onClick={() => goTab('review')}
          className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'review' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'}`}>
          <Eye size={13} />
          Revisão
          {(pendingCount) > 0 && (
            <span className={`flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full text-[10px] font-bold ${tab === 'review' ? 'bg-white/25 text-white' : 'bg-amber-500/20 border border-amber-500/30 text-amber-400'}`}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Aba de revisão — mostra componente próprio e encerra o render */}
      {tab === 'review' && <PendingReviewTab />}

      {/* Filter bar — só visível nas abas normais */}
      {tab !== 'review' && <>
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-800 bg-gray-950 text-xs text-gray-300 h-9">
            <Calendar size={13} className="text-gray-500 shrink-0" />
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

          <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-800 bg-gray-950 text-xs text-gray-300 hover:bg-gray-800/80 h-9 transition-colors">
            <SlidersHorizontal size={13} /> Mais filtros
          </button>
        </div>
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

      {/* Tabela: visão geral = só painéis acima; por cobrança = agregado; por evento = uma linha por pagamento */}
      {tab !== 'overview' && (
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">
              {tab === 'by-charge' ? 'Auditoria por cobrança' : 'Eventos de conciliação'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {tab === 'by-charge'
                ? (
                  <>
                    {totalItems.toLocaleString('pt-BR')} cobrança{totalItems !== 1 ? 's' : ''} com movimento no período
                    <span className="ml-2 text-gray-600">· Soma dos pagamentos alocados vs valor esperado</span>
                  </>
                  )
                : (
                  <>
                    {totalItems.toLocaleString('pt-BR')} resultado{totalItems !== 1 ? 's' : ''} no período
                    {divergentCnt > 0 && <span className="ml-2 text-orange-400">· {divergentCnt} divergente{divergentCnt !== 1 ? 's' : ''}</span>}
                  </>
                  )}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {tab === 'by-charge' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['—', 'STATUS', 'REFERÊNCIA', 'ESPERADO', 'RECEBIDO (Σ)', 'DIFERENÇA', 'ÚLTIMO EVENTO', 'AÇÃO'].map((h, i) => (
                    <th key={`${h}-${i}`} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h === '—' ? '' : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byChargeLoading ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">Carregando...</td></tr>
                ) : (byChargeData?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <GitMerge size={24} className="mx-auto text-gray-700 mb-3" />
                      <p className="text-sm font-semibold text-gray-400 mb-1">Nenhuma cobrança com conciliação</p>
                      <p className="text-xs text-gray-600">
                        Nenhum pagamento foi processado neste período.{' '}
                        <Link to="/import" className="text-indigo-400 hover:text-indigo-300">Importe um extrato bancário</Link>{' '}
                        ou envie um webhook para iniciar.
                      </p>
                    </td>
                  </tr>
                ) : (
                  (byChargeData?.items ?? []).map(s => (
                    <ChargeSummaryRow
                      key={s.chargeId}
                      s={s}
                      expanded={expandedCharge === s.chargeId}
                      onToggle={() => setExpandedCharge(expandedCharge === s.chargeId ? null : s.chargeId)}
                      onAi={(id, status) => setAiTarget({ id, status })}
                    />
                  ))
                )}
              </tbody>
            </table>
          ) : (
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
                      <GitMerge size={24} className="mx-auto text-gray-700 mb-3" />
                      <p className="text-sm font-semibold text-gray-400 mb-1">Nenhuma conciliação encontrada</p>
                      <p className="text-xs text-gray-600">
                        {statusFilter
                          ? 'Nenhum resultado com este status no período. Tente outro filtro.'
                          : <>Nenhum pagamento processado neste período.{' '}
                            <Link to="/import" className="text-indigo-400 hover:text-indigo-300">Importe um extrato</Link>{' '}
                            ou ajuste o intervalo de datas.</>}
                      </p>
                    </td>
                  </tr>
                ) : items.map(r => <ReconciliationRow key={r.id} r={r} onAi={() => setAiTarget({ id: r.id, status: r.status })} />)}
              </tbody>
            </table>
          )}
        </div>

        <Pagination page={page} pageSize={pageSize} total={totalItems} onPage={setPage} onPageSize={setPageSize} />
      </div>
      )}

      {aiTarget && (
        <AiExplanationModal
          reconciliationId={aiTarget.id}
          status={aiTarget.status}
          onClose={() => setAiTarget(null)}
        />
      )}
      </>}
    </div>
  )
}

// ─── Linha agregada por cobrança (auditoria) ───────────────────────────────────

function ChargeSummaryRow({
  s,
  expanded,
  onToggle,
  onAi,
}: {
  s: ChargeReconciliationSummary
  expanded: boolean
  onToggle: () => void
  onAi: (id: string, status: ReconciliationStatus) => void
}) {
  const diff = s.netDifference
  const diffEl = diff === 0
    ? <span className="text-green-400 font-bold tabular-nums">{formatCurrency(0)}</span>
    : <span className={`font-bold tabular-nums ${diff > 0 ? 'text-orange-400' : 'text-red-400'}`}>
        {diff > 0 ? '+' : ''}{formatCurrency(diff)}
      </span>

  return (
    <>
      <tr className="border-b border-gray-800/50 hover:bg-gray-800/25 transition-colors bg-gray-950/20">
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            className="p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            aria-expanded={expanded}
            title={expanded ? 'Ocultar pagamentos' : 'Ver pagamentos'}
          >
            <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </td>
        <td className="px-4 py-3"><AggregateStatusBadge status={s.aggregateStatus} /></td>
        <td className="px-4 py-3 font-mono text-xs text-gray-300 max-w-[180px] truncate" title={s.chargeReferenceId}>
          {s.chargeReferenceId}
        </td>
        <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">{formatCurrency(s.expectedAmount)}</td>
        <td className="px-4 py-3 text-xs text-gray-200 font-semibold tabular-nums">{formatCurrency(s.totalPaidAllocated)}</td>
        <td className="px-4 py-3 text-xs">{diffEl}</td>
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateShort(s.lastEventAt)}</td>
        <td className="px-4 py-3">
          <Link
            to={`/charges/${s.chargeId}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-300 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/10 whitespace-nowrap"
          >
            Ver cobrança <ArrowRight size={11} />
          </Link>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-800/50 bg-gray-950/40">
          <td colSpan={8} className="px-4 py-3">
            <p className="text-[11px] font-semibold text-gray-500 mb-2">Pagamentos alocados nesta cobrança</p>
            <div className="rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800">
                    <th className="px-3 py-2 text-left text-gray-500">Status</th>
                    <th className="px-3 py-2 text-left text-gray-500">Ref. / evento</th>
                    <th className="px-3 py-2 text-right text-gray-500">Valor</th>
                    <th className="px-3 py-2 text-left text-gray-500">Data</th>
                    <th className="px-3 py-2 text-left text-gray-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {s.paymentLines.map(line => (
                    <tr key={line.id} className="border-b border-gray-800/40">
                      <td className="px-3 py-2"><ReconcStatusBadge status={line.status} /></td>
                      <td className="px-3 py-2 font-mono text-gray-400 truncate max-w-[200px]" title={line.chargeReferenceId ?? line.paymentEventId}>
                        {line.chargeReferenceId ?? line.paymentEventId}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-200">{formatCurrency(line.paidAmount)}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDateShort(line.createdAt)}</td>
                      <td className="px-3 py-2">
                        {isDivergent(line.status) && (
                          <button
                            type="button"
                            onClick={() => onAi(line.id, line.status)}
                            title="Explicar divergência com IA"
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-indigo-400 border border-indigo-500/25 rounded-md hover:bg-indigo-500/10 transition-colors"
                          >
                            <Sparkles size={10} /> Explicar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
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
          {r.chargeId ? (
            <Link
              to={`/charges/${r.chargeId}`}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
              title="Abre a cobrança ligada a esta conciliação"
            >
              Ver cobrança <ArrowRight size={11} />
            </Link>
          ) : r.chargeReferenceId ? (
            <Link
              to="/charges"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
              title="Sem ID de cobrança na API — localize pela referência na lista"
            >
              Lista de cobranças <ArrowRight size={11} />
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
