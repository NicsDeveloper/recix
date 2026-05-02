import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, CreditCard } from 'lucide-react'
import { chargesService } from '../services/chargesService'
import { Header } from '../components/layout/Header'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge } from '../components/ui/StatusBadge'
import { MoneyText } from '../components/ui/MoneyText'
import { DateTimeText } from '../components/ui/DateTimeText'
import { FilterBar, SelectFilter, SearchInput } from '../components/ui/FilterBar'
import { ErrorState } from '../components/ui/ErrorState'
import { CreateChargeModal } from '../components/modals/CreateChargeModal'
import type { Charge, ChargeStatus } from '../types'

const statusOptions: { value: ChargeStatus; label: string }[] = [
  { value: 'Pending', label: 'Pendente' },
  { value: 'PendingReview', label: 'Em revisão' },
  { value: 'PartiallyPaid', label: 'Parcialmente pago' },
  { value: 'Paid', label: 'Pago' },
  { value: 'Expired', label: 'Expirado' },
  { value: 'Divergent', label: 'Divergente' },
  { value: 'Overpaid', label: 'Excedente' },
  { value: 'Cancelled', label: 'Cancelado' },
]

export function ChargesPage() {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ChargeStatus | ''>('')
  const [search, setSearch] = useState('')
  const [highlightedChargeId, setHighlightedChargeId] = useState<string | null>(null)

  useEffect(() => {
    if (!highlightedChargeId) return
    const t = setTimeout(() => setHighlightedChargeId(null), 5000)
    return () => clearTimeout(t)
  }, [highlightedChargeId])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['charges', statusFilter],
    queryFn: () =>
      chargesService.list(statusFilter ? { status: statusFilter } : {}),
    staleTime: 0,
    refetchInterval: false,
  })

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  }

  // Client-side text search
  const items = (data?.items ?? []).filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.referenceId.toLowerCase().includes(q) ||
      c.externalId.toLowerCase().includes(q)
    )
  })

  const columns: Column<Charge>[] = [
    {
      key: 'referenceId',
      header: 'ReferenceId',
      render: (c) => (
        <span className="font-mono text-xs text-gray-200">{c.referenceId}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Valor',
      render: (c) => <MoneyText value={c.amount} className="font-medium text-gray-200" />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: 'expiresAt',
      header: 'Expira em',
      render: (c) => <DateTimeText value={c.expiresAt} className="text-gray-400 text-xs" />,
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      render: (c) => <DateTimeText value={c.createdAt} className="text-gray-400 text-xs" />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12 text-center',
      render: (c) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/charges/${c.id}`)
          }}
          className="text-gray-500 hover:text-indigo-400 transition-colors"
          title="Ver detalhes"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ]

  return (
    <div>
      <Header
        title="Cobranças"
        subtitle={data ? `${data.totalCount} cobrança(s) no total` : undefined}
        action={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={15} />
            Nova Cobrança
          </button>
        }
      />

      <FilterBar>
        <SelectFilter
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={setStatusFilter}
        />
        <SearchInput
          placeholder="Buscar por ReferenceId ou ExternalId..."
          value={search}
          onChange={setSearch}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        emptyMessage="Nenhuma cobrança encontrada. Crie uma para começar."
        emptyIcon={<CreditCard size={24} />}
        onRowClick={(c) => navigate(`/charges/${c.id}`)}
        keyExtractor={(c) => c.id}
        rowClassName={(c) =>
          c.id === highlightedChargeId
            ? 'ring-1 ring-emerald-400/60 bg-emerald-500/5'
            : undefined
        }
      />

      {showModal && (
        <CreateChargeModal
          onClose={() => setShowModal(false)}
          onCreated={(charge) => {
            setHighlightedChargeId(charge.id)
            setStatusFilter('')
            setSearch('')
          }}
        />
      )}
    </div>
  )
}
