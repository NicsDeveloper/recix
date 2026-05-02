import type { ChargeStatus, PaymentEventStatus, ReconciliationStatus } from '../../types'

type AnyStatus = ChargeStatus | PaymentEventStatus | ReconciliationStatus

const statusConfig: Record<AnyStatus, { label: string; className: string }> = {
  // ChargeStatus
  Pending: {
    label: 'Pendente',
    className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  },
  PendingReview: {
    label: 'Aguardando revisão',
    className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  },
  PartiallyPaid: {
    label: 'Parcialmente pago',
    className: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  },
  Paid: {
    label: 'Pago',
    className: 'bg-green-500/10 text-green-400 border border-green-500/20',
  },
  Expired: {
    label: 'Expirado',
    className: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  },
  Divergent: {
    label: 'Divergente',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
  Overpaid: {
    label: 'Excedente',
    className: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  },
  Cancelled: {
    label: 'Cancelado',
    className: 'bg-gray-600/10 text-gray-500 border border-gray-600/20',
  },

  // PaymentEventStatus
  Received: {
    label: 'Recebido',
    className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  },
  Processing: {
    label: 'Processando',
    className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  },
  Processed: {
    label: 'Processado',
    className: 'bg-green-500/10 text-green-400 border border-green-500/20',
  },
  Failed: {
    label: 'Falhou',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
  IgnoredDuplicate: {
    label: 'Duplicado',
    className: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  },

  // ReconciliationStatus
  Matched: {
    label: 'Conciliado',
    className: 'bg-green-500/10 text-green-400 border border-green-500/20',
  },
  MatchedLowConfidence: {
    label: 'Revisar match',
    className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  },
  PartialPayment: {
    label: 'Pagamento parcial',
    className: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  },
  ChargeWithoutPayment: {
    label: 'Venda sem pagamento',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
  MultipleMatchCandidates: {
    label: 'Múltiplos candidatos',
    className: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  },
  AmountMismatch: {
    label: 'Valor Divergente',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
  PaymentExceedsExpected: {
    label: 'Valor excedente',
    className: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  },
  DuplicatePayment: {
    label: 'Pagamento Duplicado',
    className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  },
  PaymentWithoutCharge: {
    label: 'Sem Cobrança',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
  ExpiredChargePaid: {
    label: 'Cobrança Expirada',
    className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  },
  InvalidReference: {
    label: 'Referência Inválida',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
  ProcessingError: {
    label: 'Erro de Processamento',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
}

interface StatusBadgeProps {
  status: AnyStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]

  if (!config) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-700/20 text-gray-400 border border-gray-700/30">
        {status}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${config.className}`}
    >
      {config.label}
    </span>
  )
}
