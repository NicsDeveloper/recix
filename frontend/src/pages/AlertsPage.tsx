import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, Copy, Ban, UserCheck } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { LoadingState } from '../components/ui/LoadingState'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { dashboardService } from '../services/dashboardService'
import { organizationsService } from '../services/organizationsService'
import { useAuth } from '../contexts/AuthContext'

function toInputDate(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const alertIconMap = {
  amountMismatch: <AlertTriangle size={16} className="text-red-400" />,
  duplicatePayment: <Copy size={16} className="text-orange-400" />,
  paymentWithoutCharge: <Ban size={16} className="text-red-400" />,
} as const

export function AlertsPage() {
  const { currentOrg } = useAuth()
  const isAdmin = currentOrg?.role === 'Owner' || currentOrg?.role === 'Admin'

  const today = new Date()
  const fromDate = toInputDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000))
  const toDate = toInputDate(today)

  const { data: overview, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['alerts-overview', fromDate, toDate],
    queryFn: () => dashboardService.getOverview({ fromDate, toDate }),
    staleTime: 30_000,
  })

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['join-requests-count'],
    queryFn: () => organizationsService.getPendingCount(),
    enabled: isAdmin,
    staleTime: 30_000,
  })

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />

  const alerts = (overview?.alerts ?? []).filter((a) => a.count > 0)

  return (
    <div>
      <Header
        title="Alertas"
        subtitle="Central de atenção operacional da confiabilidade de pagamentos"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Divergências ativas (7 dias)</p>
          <p className="text-2xl font-semibold text-gray-100 mt-1">{alerts.reduce((sum, a) => sum + a.count, 0).toLocaleString('pt-BR')}</p>
          <p className="text-xs text-gray-500 mt-1">Amount mismatch, duplicidade e sem cobrança</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Solicitações pendentes</p>
          <p className="text-2xl font-semibold text-amber-400 mt-1">{isAdmin ? pendingCount.toLocaleString('pt-BR') : '—'}</p>
          <p className="text-xs text-gray-500 mt-1">{isAdmin ? 'Demandam revisão da organização' : 'Visível para Owner/Admin'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Alertas de Conciliação</h2>
        {alerts.length === 0 ? (
          <EmptyState message="Nenhum alerta de conciliação no período." icon={<AlertTriangle size={22} />} />
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.type} className="border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {alertIconMap[a.type]}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200 truncate">{a.description}</p>
                    <p className="text-xs text-gray-500">{a.count.toLocaleString('pt-BR')} ocorrência(s)</p>
                  </div>
                </div>
                <Link
                  to={`/reconciliations?status=${encodeURIComponent(a.routeStatus)}`}
                  className="px-3 py-1.5 text-xs text-gray-200 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Ver divergências
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Solicitações de Acesso</h2>
        {!isAdmin ? (
          <p className="text-sm text-gray-500">Disponível apenas para perfis Owner/Admin.</p>
        ) : pendingCount === 0 ? (
          <EmptyState message="Nenhuma solicitação pendente no momento." icon={<UserCheck size={22} />} />
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-300">
              Existem <span className="font-semibold text-amber-400">{pendingCount.toLocaleString('pt-BR')}</span> solicitação(ões) aguardando revisão.
            </p>
            <Link
              to="/join-requests"
              className="px-3 py-1.5 text-xs text-gray-200 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Revisar solicitações
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
