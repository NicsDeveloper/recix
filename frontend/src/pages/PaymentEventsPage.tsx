import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import { paymentEventsService } from '../services/paymentEventsService'
import { Header } from '../components/layout/Header'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge } from '../components/ui/StatusBadge'
import { MoneyText } from '../components/ui/MoneyText'
import { DateTimeText } from '../components/ui/DateTimeText'
import { FilterBar, SelectFilter, SearchInput } from '../components/ui/FilterBar'
import { ErrorState } from '../components/ui/ErrorState'
import { SendWebhookModal } from '../components/modals/SendWebhookModal'
import type { PaymentEvent, PaymentEventStatus } from '../types'
import { truncate } from '../lib/formatters'

const statusOptions: { value: PaymentEventStatus; label: string }[] = [
  { value: 'Received', label: 'Recebido' },
  { value: 'Processing', label: 'Processando' },
  { value: 'Processed', label: 'Processado' },
  { value: 'Failed', label: 'Falhou' },
  { value: 'IgnoredDuplicate', label: 'Duplicado' },
]

export function PaymentEventsPage() {
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<PaymentEventStatus | ''>('')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payment-events', statusFilter],
    queryFn: () =>
      paymentEventsService.list(statusFilter ? { status: statusFilter } : {}),
    staleTime: 0,
    refetchInterval: false,
  })

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
  }

  const items = (data?.items ?? []).filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.eventId.toLowerCase().includes(q) ||
      (e.referenceId ?? '').toLowerCase().includes(q) ||
      (e.externalChargeId ?? '').toLowerCase().includes(q)
    )
  })

  const columns: Column<PaymentEvent>[] = [
    {
      key: 'eventId',
      header: 'EventId',
      render: (e) => (
        <span
          title={e.eventId}
          className="font-mono text-xs text-gray-200"
        >
          {truncate(e.eventId, 28)}
        </span>
      ),
    },
    {
      key: 'paidAmount',
      header: 'Valor Pago',
      render: (e) => <MoneyText value={e.paidAmount} className="font-medium text-gray-200" />,
    },
    {
      key: 'provider',
      header: 'Provider',
      render: (e) => <span className="text-gray-400 text-xs">{e.provider}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <StatusBadge status={e.status} />,
    },
    {
      key: 'paidAt',
      header: 'Pago em',
      render: (e) => <DateTimeText value={e.paidAt} className="text-gray-400 text-xs" />,
    },
    {
      key: 'processedAt',
      header: 'Processado em',
      render: (e) => <DateTimeText value={e.processedAt} className="text-gray-400 text-xs" />,
    },
  ]

  return (
    <div>
      <Header
        title="Eventos de Pagamento"
        subtitle={data ? `${data.totalCount} evento(s) no total` : undefined}
        action={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Zap size={15} />
            Enviar Webhook Fake
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
          placeholder="Buscar por EventId, ReferenceId ou ExternalChargeId..."
          value={search}
          onChange={setSearch}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        emptyMessage="Nenhum evento de pagamento registrado ainda."
        emptyIcon={<Zap size={24} />}
        keyExtractor={(e) => e.id}
      />

      {showModal && <SendWebhookModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
