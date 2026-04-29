import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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

export function ReconciliationsPage() {
  const [statusFilter, setStatusFilter] = useState<ReconciliationStatus | ''>('')
  const [chargeIdFilter, setChargeIdFilter] = useState('')
  const [aiTarget, setAiTarget] = useState<{ id: string; status: ReconciliationStatus } | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reconciliations', statusFilter, chargeIdFilter],
    queryFn: () =>
      reconciliationsService.list({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(chargeIdFilter ? { chargeId: chargeIdFilter } : {}),
      }),
    staleTime: 30_000,
  })

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  }

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
      key: 'actions',
      header: '',
      className: 'w-28',
      render: (r) =>
        isDivergent(r.status) ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setAiTarget({ id: r.id, status: r.status })
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-400 border border-indigo-500/30 bg-indigo-500/5 rounded-lg hover:bg-indigo-500/10 transition-colors whitespace-nowrap"
          >
            <Sparkles size={11} />
            Explicar
          </button>
        ) : null,
    },
  ]

  return (
    <div>
      <Header
        title="Conciliações"
        subtitle={data ? `${data.totalCount} resultado(s) no total` : undefined}
      />

      <FilterBar>
        <SelectFilter
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={setStatusFilter}
        />
        <SearchInput
          placeholder="Filtrar por ChargeId..."
          value={chargeIdFilter}
          onChange={setChargeIdFilter}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="Nenhuma conciliação registrada ainda."
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
