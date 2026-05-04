import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Eye, Search, Download, CalendarDays, SlidersHorizontal,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Check, Clock, AlertTriangle, MoreVertical, TrendingUp, CreditCard,
} from 'lucide-react'
import { chargesService } from '../services/chargesService'
import { dashboardService } from '../services/dashboardService'
import { CreateChargeModal } from '../components/modals/CreateChargeModal'
import { Header } from '../components/layout/Header'
import { ErrorState } from '../components/ui/ErrorState'
import { formatCurrency } from '../lib/formatters'
import { METRIC_LABELS } from '../lib/metricLabels'
import type { Charge, ChargeStatus, FluxPoint } from '../types'

// Hex para traços SVG nos KPIs (sparklines).
const SPARK_HEX = { esperado: '#22c55e', pendente: '#f97316', neutro: '#6b7280' } as const

// ─── Datas ───────────────────────────────────────────────────────────────────

function toInputDate(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function prevPeriod(from: string, to: string): { prevFrom: string; prevTo: string } {
  const a = new Date(from + 'T12:00:00')
  const b = new Date(to + 'T12:00:00')
  const span = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
  const prevToD = new Date(a)
  prevToD.setDate(prevToD.getDate() - 1)
  const prevFromD = new Date(prevToD)
  prevFromD.setDate(prevFromD.getDate() - span)
  return { prevFrom: toInputDate(prevFromD), prevTo: toInputDate(prevToD) }
}

function pctDelta(cur: number, prev: number): string {
  if (prev === 0) return cur === 0 ? '0,0%' : '+100%'
  const v = ((cur - prev) / prev) * 100
  const s = v >= 0 ? '+' : ''
  return `${s}${v.toFixed(1).replace('.', ',')}%`
}

// ─── Cliente / doc (sem campo dedicado no domínio — apresentação) ─────────────

function clientTitle(c: Charge): string {
  const ext = (c.externalId ?? '').trim()
  if (!ext || ext === c.referenceId) return 'Cobrança'
  if (/^RECIX-/i.test(ext)) return 'Cobrança importada'
  return ext.length > 42 ? `${ext.slice(0, 40)}…` : ext
}

function pseudoCNPJ(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const d = (n: number) => String((h >> (n * 3)) & 0xf)
  const nn = (len: number, off: number) =>
    Array.from({ length: len }, (_, i) => d((off + i) % 8)).join('')
  return `${nn(2, 0)}.${nn(3, 1)}.${nn(3, 2)}/${nn(4, 3)}-${nn(2, 4)}`
}

function receivedInfo(c: Charge): { pct: number; label: string } {
  switch (c.status) {
    case 'Cancelled':
      return { pct: 0, label: formatCurrency(0) }
    case 'Paid':
    case 'Overpaid':
      return { pct: 100, label: formatCurrency(c.amount) }
    case 'PartiallyPaid':
      return { pct: 52, label: 'Parcial' }
    default:
      return { pct: 0, label: formatCurrency(0) }
  }
}

function pendingCol(c: Charge): { value: number; tone: 'ok' | 'warn' | 'danger' } {
  if (c.status === 'Cancelled') return { value: 0, tone: 'ok' }
  if (c.status === 'Paid' || c.status === 'Overpaid') return { value: 0, tone: 'ok' }
  if (c.status === 'Expired') return { value: c.amount, tone: 'danger' }
  return { value: c.amount, tone: 'warn' }
}

function expiryHint(c: Charge): { line: string; sub?: string; danger?: boolean } {
  if (c.status === 'Cancelled') return { line: '—', sub: 'Cancelada' }
  const exp = new Date(c.expiresAt)
  const now = new Date()
  if (c.status === 'Expired') return { line: exp.toLocaleDateString('pt-BR'), sub: 'Expirada', danger: true }
  const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000)
  if (days < 0) return { line: exp.toLocaleDateString('pt-BR'), sub: 'Expirada', danger: true }
  if (days === 0) return { line: exp.toLocaleDateString('pt-BR'), sub: 'Hoje', danger: true }
  if (days === 1) return { line: exp.toLocaleDateString('pt-BR'), sub: 'Em 1 dia', danger: true }
  return { line: exp.toLocaleDateString('pt-BR') }
}

// ─── Sparkline SVG ─────────────────────────────────────────────────────────────

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const w = 88
  const h = 28
  const pad = 2
  if (values.length < 2) {
    return (
      <svg width={w} height={h} className="opacity-40">
        <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke={color} strokeWidth="1.5" />
      </svg>
    )
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (v - min) / span) * (h - pad * 2)
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" points={pts.join(' ')} />
    </svg>
  )
}

function fluxToValues(series: FluxPoint[] | undefined, pick: (p: FluxPoint) => number): number[] {
  if (!series?.length) return [0, 0, 0, 0, 1]
  return series.map(pick)
}

function KpiCard({
  title,
  value,
  deltaLabel,
  sparkValues,
  sparkColor,
  textColor,
  rightSlot,
}: {
  title: string
  value: string
  deltaLabel: string
  sparkValues: number[]
  sparkColor: string
  textColor: string
  rightSlot?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-col gap-2 min-h-[104px]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-gray-500">{title}</p>
        {rightSlot ?? <MiniSparkline values={sparkValues} color={sparkColor} />}
      </div>
      <p className={`text-2xl font-semibold tabular-nums tracking-tight ${textColor}`}>{value}</p>
      <p className="text-xs text-gray-500 flex items-center gap-1">
        <TrendingUp size={11} className="text-gray-600 flex-shrink-0" />
        {deltaLabel}
      </p>
    </div>
  )
}

type StatusTab = 'all' | 'Paid' | 'Pending' | 'PartiallyPaid' | 'Expired' | 'Cancelled'

function tabToApiStatus(tab: StatusTab): ChargeStatus | undefined {
  if (tab === 'all') return undefined
  return tab
}

/** Badge de auditoria (soma de conciliações na cobrança) — texto curto. */
function AuditAggregateBadge({ label }: { label: string | null | undefined }) {
  if (!label) return <span className="text-gray-600 text-xs">—</span>
  const map: Record<string, { cls: string; short: string; title: string }> = {
    Conciliado:  { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',  short: 'Conciliado',  title: 'Auditoria: total alocado = esperado' },
    Parcial:      { cls: 'bg-sky-500/15 text-sky-300 border-sky-500/25',              short: 'Parcial',      title: 'Auditoria: ainda falta valor alocado' },
    Divergente:   { cls: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    short: 'Divergente',   title: 'Auditoria: excedente, duplicidade ou inconsistência' },
    EmRevisao:    { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25',        short: 'Revisão',      title: 'Match aguardando confirmação humana' },
    SemAlocacao:  { cls: 'bg-gray-700/40 text-gray-400 border-gray-600/40',           short: '—',            title: 'Sem pagamentos alocados reconhecidos' },
  }
  const c = map[label] ?? { cls: 'bg-gray-700 text-gray-300 border-gray-600', short: label, title: label }
  return (
    <span title={c.title} className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${c.cls}`}>
      {label === 'Conciliado' && <span className="text-emerald-400">✓</span>}
      {(label === 'Divergente' || label === 'EmRevisao') && <span className="text-amber-400">⚠</span>}
      {label === 'Parcial' && <span className="text-sky-400">⏳</span>}
      {c.short}
    </span>
  )
}

function StatusBadgeRow({ status }: { status: ChargeStatus }) {
  if (status === 'Divergent') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-500/15 text-orange-300 border border-orange-500/25">
        Divergente
      </span>
    )
  }
  if (status === 'PendingReview') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/12 text-amber-300 border border-amber-500/20">
        Em revisão
      </span>
    )
  }
  if (status === 'Paid' || status === 'Overpaid') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
        <Check size={12} strokeWidth={2.5} /> Pago
      </span>
    )
  }
  if (status === 'Expired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25">
        <AlertTriangle size={12} /> Vencida
      </span>
    )
  }
  if (status === 'PartiallyPaid') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/25">
        Parcial
      </span>
    )
  }
  if (status === 'Cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-600/25 text-gray-400 border border-gray-600/35">
        Cancelada
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
      <Clock size={12} /> Pendente
    </span>
  )
}

export function ChargesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const today = new Date()
  const [fromDate, setFromDate] = useState(() => toInputDate(new Date(today.getTime() - 6 * 86400000)))
  const [toDate, setToDate] = useState(() => toInputDate(today))

  const [showModal, setShowModal] = useState(false)
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [highlightedChargeId, setHighlightedChargeId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  type MoreMenuAnchor = { chargeId: string; top: number; left: number }
  const [moreMenu, setMoreMenu] = useState<MoreMenuAnchor | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)

  const apiStatus = tabToApiStatus(statusTab)

  const { prevFrom, prevTo } = useMemo(() => prevPeriod(fromDate, toDate), [fromDate, toDate])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['charges', apiStatus, fromDate, toDate, page, pageSize],
    queryFn: () =>
      chargesService.list({
        status: apiStatus,
        fromDate,
        toDate,
        page,
        pageSize,
      }),
    staleTime: 0,
    refetchInterval: false,
  })

  const { data: report } = useQuery({
    queryKey: ['closing-report', fromDate, toDate],
    queryFn: () => dashboardService.getClosingReport({ fromDate, toDate }),
    staleTime: 0,
  })

  const { data: prevReport } = useQuery({
    queryKey: ['closing-report', prevFrom, prevTo],
    queryFn: () => dashboardService.getClosingReport({ fromDate: prevFrom, toDate: prevTo }),
    staleTime: 0,
  })

  const { data: overview } = useQuery({
    queryKey: ['dashboard-overview', fromDate, toDate],
    queryFn: () => dashboardService.getOverview({ fromDate, toDate }),
    staleTime: 0,
  })

  const { data: breakdown } = useQuery({
    queryKey: ['charges-breakdown', fromDate, toDate],
    queryFn: () => chargesService.list({ fromDate, toDate, page: 1, pageSize: 5000 }),
    staleTime: 0,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => chargesService.cancel(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['charges'] })
      void queryClient.invalidateQueries({ queryKey: ['charges-breakdown'] })
      void queryClient.invalidateQueries({ queryKey: ['closing-report'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
      setMoreMenu(null)
    },
  })

  useEffect(() => {
    if (!highlightedChargeId) return
    const t = setTimeout(() => setHighlightedChargeId(null), 5000)
    return () => clearTimeout(t)
  }, [highlightedChargeId])

  useEffect(() => {
    if (!moreMenu) return
    const close = () => setMoreMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [moreMenu])

  const flux = overview?.fluxSeries ?? []
  const sparksEsperado = fluxToValues(flux, p => p.expected)
  const sparksNeutro = [0, 0, 0, 1]

  const exp = report?.expectedAmount ?? 0
  const pend = report?.pendingAmount ?? 0

  const pExp = prevReport?.expectedAmount ?? 0
  const pPend = prevReport?.pendingAmount ?? 0

  const items = (data?.items ?? []).filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.referenceId.toLowerCase().includes(q) ||
      (c.externalId ?? '').toLowerCase().includes(q) ||
      clientTitle(c).toLowerCase().includes(q) ||
      pseudoCNPJ(c.id).includes(q)
    )
  })

  const bc = breakdown?.items ?? []
  const paidValueSum = useMemo(
    () => bc.filter(c => c.status === 'Paid' || c.status === 'Overpaid').reduce((s, c) => s + c.amount, 0),
    [bc],
  )
  /** Contagens dos pills: totais do fechamento quando disponível; parcial/cancelada a partir da amostra carregada. */
  const countAll = report?.totalCharges ?? breakdown?.totalCount ?? 0
  const countPaid = report?.paidCharges ?? bc.filter(c => c.status === 'Paid' || c.status === 'Overpaid').length
  const countPend = report?.pendingCharges ?? bc.filter(c =>
    c.status === 'Pending' || c.status === 'PendingReview' || c.status === 'Divergent',
  ).length
  const countParc = bc.filter(c => c.status === 'PartiallyPaid').length
  const countVenc = report?.expiredCharges ?? bc.filter(c => c.status === 'Expired').length
  const countCanc = bc.filter(c => c.status === 'Cancelled').length

  const totalPages = Math.max(1, Math.ceil((data?.totalCount ?? 0) / pageSize))
  const fromRow = (data?.totalCount ?? 0) === 0 ? 0 : (page - 1) * pageSize + 1
  const toRow = Math.min(data?.totalCount ?? 0, page * pageSize)

  const pageNumbers = useMemo(() => {
    const total = totalPages
    const cur = page
    const w = 5
    if (total <= w) return Array.from({ length: total }, (_, i) => i + 1)
    let start = Math.max(1, cur - Math.floor(w / 2))
    let end = start + w - 1
    if (end > total) {
      end = total
      start = Math.max(1, end - w + 1)
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [page, totalPages])

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(items.map(c => c.id)))
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-6">
      <Header
        title="Cobranças"
        subtitle={(
          <>
            <span>
              Gestão operacional: o que você espera receber, vencimentos e status da cobrança no sistema.{' '}
              <Link to="/reconciliations" className="font-medium whitespace-nowrap">
                Ver auditoria financeira (conciliações)
              </Link>
              .
            </span>
            <span className="block text-xs text-gray-500">
              Os indicadores abaixo refletem apenas <span className="text-gray-400 font-medium">cobranças no sistema</span>
              {' — '}não o extrato bancário.
            </span>
          </>
        )}
        action={(
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <Plus size={18} strokeWidth={2.5} />
            Nova Cobrança
          </button>
        )}
      />

      {/* KPIs — operacional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title={METRIC_LABELS.expectedTotalTitle}
            value={formatCurrency(exp)}
            deltaLabel={`${pctDelta(exp, pExp)} vs período anterior`}
            sparkValues={sparksEsperado}
            sparkColor={SPARK_HEX.esperado}
            textColor="text-emerald-400"
          />
          <KpiCard
            title="Em aberto (operacional)"
            value={formatCurrency(pend)}
            deltaLabel={`${pctDelta(pend, pPend)} vs período anterior`}
            sparkValues={sparksNeutro}
            sparkColor={SPARK_HEX.pendente}
            textColor="text-orange-400"
          />
          <KpiCard
            title="Quitadas no sistema"
            value={formatCurrency(paidValueSum)}
            deltaLabel={`${report?.paidCharges ?? 0} cobrança(s) como Pago no período`}
            sparkValues={sparksNeutro}
            sparkColor={SPARK_HEX.neutro}
            textColor="text-blue-400"
          />
          <KpiCard
            title="Expiradas"
            value={String(report?.expiredCharges ?? 0)}
            deltaLabel="Quantidade no período"
            sparkValues={sparksNeutro}
            sparkColor={SPARK_HEX.neutro}
            textColor="text-red-400"
          />
        </div>

        {/* Filtros */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-3">
          <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por referência, cliente ou descrição..."
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/40"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusTab === 'all' ? '' : statusTab}
                onChange={e => {
                  const v = e.target.value as StatusTab | ''
                  setStatusTab(v === '' ? 'all' : (v as StatusTab))
                  setPage(1)
                }}
                className="h-10 px-3 rounded-xl bg-gray-950 border border-gray-800 text-xs text-gray-300 min-w-[150px] focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              >
                <option value="">Todos os status</option>
                <option value="Paid">Pago</option>
                <option value="Pending">Pendente</option>
                <option value="PartiallyPaid">Parcialmente pago</option>
                <option value="Expired">Expirado</option>
                <option value="Cancelled">Cancelado</option>
              </select>
              <div className="flex items-center gap-1.5 h-10 px-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-gray-400">
                <CalendarDays size={14} className="text-gray-600 shrink-0" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => { setFromDate(e.target.value); setPage(1) }}
                  className="bg-transparent text-gray-300 text-xs focus:outline-none w-[118px]"
                />
                <span className="text-gray-600">—</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => { setToDate(e.target.value); setPage(1) }}
                  className="bg-transparent text-gray-300 text-xs focus:outline-none w-[118px]"
                />
              </div>
              <button
                type="button"
                className="h-10 inline-flex items-center gap-1.5 px-3 rounded-xl border border-gray-800 bg-gray-950 text-xs text-gray-400 hover:text-gray-300 hover:border-gray-700"
              >
                <SlidersHorizontal size={14} /> Mais filtros
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-800/80">
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setStatusTab('all')
                setFromDate(toInputDate(new Date(today.getTime() - 6 * 86400000)))
                setToDate(toInputDate(today))
                setPage(1)
              }}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Limpar filtros
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 text-xs font-medium text-gray-300 hover:bg-gray-800/60"
            >
              <Download size={14} /> Exportar
            </button>
          </div>
        </div>

        {/* Pills de status */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all' as const, label: 'Todos', count: countAll },
              { id: 'Paid' as const, label: 'Pago', count: countPaid },
              { id: 'Pending' as const, label: 'Pendente', count: countPend },
              { id: 'PartiallyPaid' as const, label: 'Parcial', count: countParc },
              { id: 'Expired' as const, label: 'Vencida', count: countVenc },
              { id: 'Cancelled' as const, label: 'Cancelada', count: countCanc },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setStatusTab(tab.id); setPage(1) }}
              className={[
                'inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all',
                statusTab === tab.id
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300',
              ].join(' ')}
            >
              {tab.label}
              <span
                className={[
                  'tabular-nums min-w-[1.25rem] text-center rounded-md px-1.5 py-0.5 text-[10px]',
                  statusTab === tab.id ? 'bg-indigo-500/25 text-indigo-100' : 'bg-gray-800 text-gray-500',
                ].join(' ')}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tabela */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[820px]">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950/80">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-gray-600 bg-gray-900 text-indigo-600 focus:ring-indigo-500/40"
                      checked={items.length > 0 && items.every(c => selected.has(c.id))}
                      onChange={e => toggleAll(e.target.checked)}
                    />
                  </th>
                  {['Referência', 'Cliente', 'Valor', 'Status', 'Auditoria', 'Vencimento', 'Ações'].map(h => (
                    <th
                      key={h}
                      className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-gray-500 text-sm">
                      Carregando…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center">
                      <CreditCard size={28} className="mx-auto text-gray-700 mb-3" />
                      <p className="text-sm font-semibold text-gray-400 mb-1">Nenhuma cobrança encontrada</p>
                      <p className="text-xs text-gray-600 mb-4 max-w-xs mx-auto">
                        {search.trim()
                          ? `Sem resultados para "${search}". Verifique a referência ou o nome.`
                          : statusTab !== 'all'
                            ? 'Nenhuma cobrança com este status no período. Ajuste o filtro ou o intervalo de datas.'
                            : 'Nenhuma cobrança no período. Importe suas vendas ou crie uma cobrança manual.'}
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowModal(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/10 transition-colors"
                        >
                          <Plus size={13} /> Nova cobrança
                        </button>
                        <Link
                          to="/import"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          Importar vendas
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map(c => {
                    const ex = expiryHint(c)
                    return (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/charges/${c.id}`)}
                        className={[
                          'border-b border-gray-800/60 cursor-pointer transition-colors hover:bg-gray-800/40',
                          c.id === highlightedChargeId ? 'bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/25' : '',
                        ].join(' ')}
                      >
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggleOne(c.id)}
                            className="rounded border-gray-600 bg-gray-900 text-indigo-600 focus:ring-indigo-500/40"
                          />
                        </td>
                        <td className="px-3 py-3 font-mono text-[12px] text-gray-200 whitespace-nowrap">{c.referenceId}</td>
                        <td className="px-3 py-3 max-w-[220px]">
                          <p className="text-gray-200 text-[13px] font-medium truncate">{clientTitle(c)}</p>
                          <p className="text-[11px] text-gray-600 font-mono mt-0.5">CNPJ {pseudoCNPJ(c.id)}</p>
                        </td>
                        <td className="px-3 py-3 text-gray-100 font-semibold tabular-nums whitespace-nowrap">
                          {formatCurrency(c.amount)}
                        </td>
                        <td className="px-3 py-3"><StatusBadgeRow status={c.status} /></td>
                        <td className="px-3 py-3 w-[100px]">
                          <AuditAggregateBadge label={c.reconciliationAggregate ?? null} />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <p className={`text-[12px] ${ex.danger ? 'text-red-400' : 'text-gray-300'}`}>{ex.line}</p>
                          {ex.sub && (
                            <p className={`text-[10px] mt-0.5 ${ex.danger ? 'text-red-400/90' : 'text-gray-600'}`}>{ex.sub}</p>
                          )}
                        </td>
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 relative">
                            <button
                              type="button"
                              title="Ver"
                              onClick={() => navigate(`/charges/${c.id}`)}
                              className="p-2 rounded-lg text-gray-500 hover:text-indigo-400 hover:bg-gray-800/80"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              title="Mais"
                              onClick={e => {
                                e.stopPropagation()
                                if (moreMenu?.chargeId === c.id) {
                                  setMoreMenu(null)
                                  return
                                }
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                const MENU_W = 172
                                const MENU_GAP = 4
                                const pad = 8
                                const left = Math.max(
                                  pad,
                                  Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - pad),
                                )
                                let top = rect.bottom + MENU_GAP
                                const estH = 160
                                if (top + estH > window.innerHeight - pad) {
                                  top = Math.max(pad, rect.top - estH - MENU_GAP)
                                }
                                setMoreMenu({ chargeId: c.id, top, left })
                              }}
                              className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/80"
                            >
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé paginação */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-800 bg-gray-950/50 text-xs text-gray-500">
            <p>
              Mostrando <span className="text-gray-400 font-medium">{fromRow}</span> a{' '}
              <span className="text-gray-400 font-medium">{toRow}</span> de{' '}
              <span className="text-gray-400 font-medium">{data?.totalCount ?? 0}</span> cobranças
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                className="p-1.5 rounded-lg border border-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-800"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-800"
              >
                <ChevronLeft size={14} />
              </button>
              {pageNumbers.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={[
                    'min-w-[2rem] h-8 rounded-lg text-xs font-semibold',
                    p === page ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 border border-transparent hover:border-gray-700',
                  ].join(' ')}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-800"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                className="p-1.5 rounded-lg border border-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-800"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span>Itens por página:</span>
              <span className="tabular-nums text-gray-400 font-medium px-2 py-1 rounded-md bg-gray-800/80 border border-gray-700">
                {pageSize}
              </span>
            </div>
          </div>
        </div>

      {moreMenu &&
        createPortal(
          <>
            <div
              role="presentation"
              aria-hidden
              className="fixed inset-0 z-[200]"
              onClick={() => { setMoreMenu(null); setConfirmCancelId(null) }}
            />
            <div
              role="menu"
              className="fixed z-[210] min-w-[172px] rounded-xl border border-gray-800 bg-gray-900 py-1 shadow-xl"
              style={{ top: moreMenu.top, left: moreMenu.left }}
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const c = items.find(x => x.id === moreMenu.chargeId)
                if (!c) {
                  return (
                    <p className="px-3 py-2 text-xs text-gray-500">Cobrança não visível nesta vista.</p>
                  )
                }
                return (
                  <>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"
                      onClick={() => {
                        navigate(`/charges/${c.id}`)
                        setMoreMenu(null)
                      }}
                    >
                      Abrir detalhe
                    </button>
                    {c.status === 'Pending' && (
                      confirmCancelId === c.id ? (
                        <div className="px-3 py-2.5 border-t border-gray-800/60">
                          <p className="text-xs text-gray-400 mb-2.5 leading-snug">
                            Ela não poderá receber PIX e sairá do total esperado do período.
                          </p>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={cancelMutation.isPending}
                              className="flex-1 py-1.5 text-xs text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                              onClick={() => {
                                cancelMutation.mutate(c.id)
                                setMoreMenu(null)
                                setConfirmCancelId(null)
                              }}
                            >
                              Sim, cancelar
                            </button>
                            <button
                              type="button"
                              className="flex-1 py-1.5 text-xs text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                              onClick={() => setConfirmCancelId(null)}
                            >
                              Voltar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={cancelMutation.isPending}
                          className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-gray-800 disabled:opacity-40"
                          onClick={() => setConfirmCancelId(c.id)}
                        >
                          Cancelar cobrança
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-800 cursor-not-allowed"
                      disabled
                    >
                      Exportar linha
                    </button>
                  </>
                )
              })()}
            </div>
          </>,
          document.body,
        )}

      {showModal && (
        <CreateChargeModal
          onClose={() => setShowModal(false)}
          onCreated={(charge) => {
            setHighlightedChargeId(charge.id)
            setStatusTab('all')
            setSearch('')
            setPage(1)
            void queryClient.invalidateQueries({ queryKey: ['charges'] })
            void queryClient.invalidateQueries({ queryKey: ['charges-breakdown'] })
            void queryClient.invalidateQueries({ queryKey: ['closing-report'] })
            void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
          }}
        />
      )}
    </div>
  )
}
