import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { chargesService } from '../services/chargesService'
import { reconciliationsService } from '../services/reconciliationsService'
import { StatusBadge } from '../components/ui/StatusBadge'
import { MoneyText } from '../components/ui/MoneyText'
import { DateTimeText } from '../components/ui/DateTimeText'
import { DataTable, type Column } from '../components/ui/DataTable'
import { LoadingState } from '../components/ui/LoadingState'
import { ErrorState } from '../components/ui/ErrorState'
import { AiExplanationModal } from '../components/modals/AiExplanationModal'
import type { ReconciliationResult, ReconciliationStatus } from '../types'
import { truncate } from '../lib/formatters'

const divergentStatuses: ReconciliationStatus[] = [
  'AmountMismatch',
  'DuplicatePayment',
  'PaymentWithoutCharge',
  'ExpiredChargePaid',
  'InvalidReference',
  'ProcessingError',
]

export function ChargeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [aiTarget, setAiTarget] = useState<{ id: string; status: ReconciliationStatus } | null>(null)

  const {
    data: charge,
    isLoading: chargeLoading,
    isError: chargeError,
    error: chargeErr,
    refetch: refetchCharge,
  } = useQuery({
    queryKey: ['charge', id],
    queryFn: () => chargesService.getById(id!),
    enabled: !!id,
    staleTime: 30_000,
  })

  const {
    data: reconciliations,
    isLoading: reconcLoading,
  } = useQuery({
    queryKey: ['reconciliations-by-charge', id],
    queryFn: () => reconciliationsService.list({ chargeId: id! }),
    enabled: !!id,
    staleTime: 30_000,
  })

  if (chargeLoading) return <LoadingState />
  if (chargeError) {
    return (
      <ErrorState
        message={(chargeErr as Error)?.message ?? 'Cobrança não encontrada.'}
        onRetry={() => refetchCharge()}
      />
    )
  }
  if (!charge) return null

  const reconcColumns: Column<ReconciliationResult>[] = [
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
      key: 'createdAt',
      header: 'Data',
      render: (r) => <DateTimeText value={r.createdAt} className="text-gray-400 text-xs" />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-28',
      render: (r) =>
        divergentStatuses.includes(r.status) ? (
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
      {/* Back + Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/charges')}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-xs text-gray-500">Cobranças</p>
          <p className="text-sm font-semibold text-white font-mono">{charge.referenceId}</p>
        </div>
      </div>

      {/* Charge Info Card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">ReferenceId</p>
            <p className="text-base font-bold text-white font-mono">{charge.referenceId}</p>
          </div>
          <StatusBadge status={charge.status} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoField label="Valor">
            <MoneyText value={charge.amount} className="text-lg font-bold text-white" />
          </InfoField>
          <InfoField label="Criado em">
            <DateTimeText value={charge.createdAt} className="text-sm text-gray-300" />
          </InfoField>
          <InfoField label="Expira em">
            <DateTimeText value={charge.expiresAt} className="text-sm text-gray-300" />
          </InfoField>
          <InfoField label="ExternalId">
            <span className="text-xs text-gray-400 font-mono break-all">{charge.externalId}</span>
          </InfoField>
        </div>
      </div>

      {/* Reconciliations */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Conciliações relacionadas
        </h2>
        <DataTable
          columns={reconcColumns}
          data={reconciliations?.items ?? []}
          isLoading={reconcLoading}
          emptyMessage="Nenhuma conciliação registrada para esta cobrança."
          keyExtractor={(r) => r.id}
        />
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

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  )
}
