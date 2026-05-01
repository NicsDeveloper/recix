import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { GitMerge, Sparkles } from 'lucide-react'
import { reconciliationsService } from '../services/reconciliationsService'
import { Header } from '../components/layout/Header'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge } from '../components/ui/StatusBadge'
import { MoneyText } from '../components/ui/MoneyText'
import { DateTimeText } from '../components/ui/DateTimeText'
import { FilterBar, SelectFilter, SearchInput } from '../components/ui/FilterBar'
import { ErrorState } from '../components/ui/ErrorState'
import { AiExplanationModal } from '../components/modals/AiExplanationModal'
import type { ReconciliationResult, ReconciliationStatus } from '../types'
import { truncate } from '../lib/formatters'

const statusOptions: { value: ReconciliationStatus; label: string }[] = [
  { value: 'Matched', label: 'Conciliado' },
  { value: 'AmountMismatch', label: 'Valor Divergente' },
  { value: 'DuplicatePayment', label: 'Pag. Duplicado' },
  { value: 'PaymentWithoutCharge', label: 'Sem Cobrança' },
  { value: 'ExpiredChargePaid', label: 'Expirada Paga' },
  { value: 'InvalidReference', label: 'Ref. Inválida' },
  { value: 'ProcessingError', label: 'Erro de Proc.' },
]

const DIVERGENT_VIEWS = '__divergent__' as const

const reconciliationStatusSelectOptions: { value: ReconciliationStatus | typeof DIVERGENT_VIEWS | ''; label: string }[] = [
  { value: DIVERGENT_VIEWS, label: 'Todas as divergências' },
  { value: '', label: 'Todos os status' },
  ...statusOptions,
]

const divergentStatuses: ReconciliationStatus[] = [
  'AmountMismatch',
  'DuplicatePayment',
  'PaymentWithoutCharge',
  'ExpiredChargePaid',
  'InvalidReference',
  'ProcessingError',
]

function isDivergent(status: ReconciliationStatus) {
  return divergentStatuses.includes(status)
}

type PriorityLevel = 'Alta' | 'Média' | 'Baixa'

function getRecommendedAction(status: ReconciliationStatus) {
  const map: Record<ReconciliationStatus, { primary: string; secondary: string }> = {
    AmountMismatch: {
      primary: 'Validar diferença de valor',
      secondary: 'Revisar taxa, desconto ou arredondamento',
    },
    DuplicatePayment: {
      primary: 'Confirmar pagamento duplicado',
      secondary: 'Avaliar estorno ou baixa duplicada',
    },
    PaymentWithoutCharge: {
      primary: 'Vincular pagamento à cobrança',
      secondary: 'Buscar referência alternativa do evento',
    },
    ExpiredChargePaid: {
      primary: 'Reavaliar cobrança expirada',
      secondary: 'Definir aceite/manual ou ajuste de regra',
    },
    InvalidReference: {
      primary: 'Corrigir referência inválida',
      secondary: 'Padronizar formato de referência na origem',
    },
    ProcessingError: {
      primary: 'Reprocessar evento com erro',
      secondary: 'Inspecionar log técnico da falha',
    },
    Matched: {
      primary: 'Sem ação necessária',
      secondary: 'Conciliação concluída',
    },
  }
  return map[status]
}

function getPriorityScore(item: ReconciliationResult) {
  if (!isDivergent(item.status)) return 0

  const base: Record<ReconciliationStatus, number> = {
    ProcessingError: 95,
    PaymentWithoutCharge: 90,
    DuplicatePayment: 85,
    AmountMismatch: 80,
    ExpiredChargePaid: 70,
    InvalidReference: 65,
    Matched: 0,
  }

  const amountGap =
    item.expectedAmount == null
      ? Math.abs(item.paidAmount)
      : Math.abs(item.paidAmount - item.expectedAmount)
  const amountScore = Math.min(20, amountGap / 50)

  const ageHours = Math.max(0, (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60))
  const ageScore = Math.min(10, ageHours / 8)

  return base[item.status] + amountScore + ageScore
}

function getPriorityLevel(score: number): PriorityLevel {
  if (score >= 85) return 'Alta'
  if (score >= 70) return 'Média'
  return 'Baixa'
}

function PriorityBadge({ score }: { score: number }) {
  if (score <= 0) {
    return <span className="text-xs text-gray-600">—</span>
  }

  const level = getPriorityLevel(score)
  const styles: Record<PriorityLevel, string> = {
    Alta: 'bg-red-500/10 text-red-400 border border-red-500/20',
    Média: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    Baixa: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${styles[level]}`}>
      {level}
    </span>
  )
}

export function ReconciliationsPage() {
  const [statusFilter, setStatusFilter] = useState<ReconciliationStatus | ''>('')
  const [divergentOnly, setDivergentOnly] = useState(false)
  const [chargeIdFilter, setChargeIdFilter] = useState('')
  const [sortMode, setSortMode] = useState<'priority' | 'recent'>('priority')
  const [aiTarget, setAiTarget] = useState<{ id: string; status: ReconciliationStatus } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('filter') === 'divergent') {
      setDivergentOnly(true)
      setStatusFilter('')
      return
    }
    setDivergentOnly(false)
    const rawStatus = searchParams.get('status')
    const match = rawStatus && statusOptions.find((o) => o.value === rawStatus)
    setStatusFilter(match ? match.value : '')
  }, [searchParams])

  const statusSelectValue = divergentOnly ? DIVERGENT_VIEWS : statusFilter

  function onReconciliationStatusChange(v: string) {
    if (v === DIVERGENT_VIEWS) {
      setDivergentOnly(true)
      setStatusFilter('')
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('filter', 'divergent')
        next.delete('status')
        return next
      })
      return
    }
    setDivergentOnly(false)
    setStatusFilter(v as ReconciliationStatus | '')
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('filter')
      if (v) next.set('status', v)
      else next.delete('status')
      return next
    })
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reconciliations', statusFilter, chargeIdFilter],
    queryFn: () =>
      reconciliationsService.list({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(chargeIdFilter ? { chargeId: chargeIdFilter } : {}),
      }),
    staleTime: 30_000,
  })

  const sortedItems = useMemo(() => {
    let items = [...(data?.items ?? [])]
    if (divergentOnly) {
      items = items.filter((r) => isDivergent(r.status))
    }
    if (sortMode === 'recent') {
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return items.sort((a, b) => getPriorityScore(b) - getPriorityScore(a))
  }, [data?.items, sortMode, divergentOnly])

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  }

  const divergentCount = sortedItems.filter((r) => isDivergent(r.status)).length
  const highPriorityCount = sortedItems.filter((r) => getPriorityLevel(getPriorityScore(r)) === 'Alta').length

  const columns: Column<ReconciliationResult>[] = [
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'reason',
      header: 'Motivo',
      render: (r) => (
        <span title={r.reason} className="text-gray-400 text-xs">
          {truncate(r.reason, 48)}
        </span>
      ),
    },
    {
      key: 'expectedAmount',
      header: 'Esperado',
      render: (r) => <MoneyText value={r.expectedAmount} className="text-gray-300 text-sm" />,
    },
    {
      key: 'paidAmount',
      header: 'Pago',
      render: (r) => <MoneyText value={r.paidAmount} className="text-gray-300 text-sm" />,
    },
    {
      key: 'chargeId',
      header: 'Cobrança',
      render: (r) =>
        r.chargeId ? (
          <Link
            to={`/charges/${r.chargeId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-mono transition-colors"
          >
            ver cobrança →
          </Link>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Data',
      render: (r) => <DateTimeText value={r.createdAt} className="text-gray-400 text-xs" />,
    },
    {
      key: 'priority',
      header: 'Prioridade',
      render: (r) => <PriorityBadge score={getPriorityScore(r)} />,
    },
    {
      key: 'recommendedAction',
      header: 'Próxima ação sugerida',
      className: 'min-w-[280px]',
      render: (r) => {
        if (!isDivergent(r.status)) {
          return <span className="text-xs text-gray-600">Sem ação (conciliado)</span>
        }
        const action = getRecommendedAction(r.status)
        return (
          <div className="min-w-0">
            <p className="text-xs text-gray-200 font-medium">{action.primary}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{action.secondary}</p>
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: 'Ações',
      className: 'w-56',
      render: (r) =>
        isDivergent(r.status) ? (
          <div className="flex items-center gap-2">
            <Link
              to={r.chargeId ? `/charges/${r.chargeId}` : '/charges'}
              onClick={(e) => e.stopPropagation()}
              className="px-2.5 py-1 text-xs font-medium text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              Investigar
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setAiTarget({ id: r.id, status: r.status })
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-400 border border-indigo-500/30 bg-indigo-500/5 rounded-lg hover:bg-indigo-500/10 transition-colors whitespace-nowrap"
            >
              <Sparkles size={11} />
              Explicar IA
            </button>
          </div>
        ) : null,
    },
  ]

  return (
    <div>
      <Header
        title="Conciliações"
        subtitle={
          data
            ? divergentOnly
              ? `${sortedItems.length} divergência(s) · ${data.totalCount} conciliação(ões) carregada(s)`
              : `${data.totalCount} resultado(s) no total`
            : undefined
        }
      />

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
          <p className="text-xs text-gray-500">Divergências abertas</p>
          <p className="text-lg font-semibold text-gray-100">{divergentCount.toLocaleString('pt-BR')}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
          <p className="text-xs text-gray-500">Prioridade alta</p>
          <p className="text-lg font-semibold text-red-400">{highPriorityCount.toLocaleString('pt-BR')}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
          <p className="text-xs text-gray-500">Modo de triagem</p>
          <p className="text-sm font-medium text-gray-200">
            {sortMode === 'priority' ? 'Por impacto e urgência' : 'Mais recentes primeiro'}
          </p>
        </div>
      </div>

      <FilterBar>
        <SelectFilter<string>
          label="Status"
          value={statusSelectValue}
          options={reconciliationStatusSelectOptions}
          onChange={onReconciliationStatusChange}
          prependBlankOption={false}
        />
        <SearchInput
          placeholder="Filtrar por ChargeId..."
          value={chargeIdFilter}
          onChange={setChargeIdFilter}
        />
        <SelectFilter
          label="Ordenar por"
          value={sortMode}
          options={[
            { value: 'priority', label: 'Prioridade' },
            { value: 'recent', label: 'Mais recentes' },
          ]}
          onChange={(value) => setSortMode(value as 'priority' | 'recent')}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={sortedItems}
        isLoading={isLoading}
        emptyMessage={
          divergentOnly
            ? 'Nenhuma divergência nas conciliações carregadas. Tente “Todos os status” ou outro filtro.'
            : 'Nenhuma conciliação registrada ainda.'
        }
        emptyIcon={<GitMerge size={24} />}
        keyExtractor={(r) => r.id}
      />

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
