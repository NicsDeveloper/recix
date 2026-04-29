import type { DashboardAlert } from '../../types'
import type { ReactNode } from 'react'
import { AlertTriangle, Copy, Ban } from 'lucide-react'
import { Link } from 'react-router-dom'

function timeAgo(iso: string) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'há —'

  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (diffSec < 60) return `há ${diffSec}s`

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `há ${diffMin}min`

  const diffHr = Math.floor(diffMin / 60)
  return `há ${diffHr}h`
}

const alertStyle: Record<
  DashboardAlert['type'],
  { iconBg: string; iconFg: string; icon: ReactNode; color: string }
> = {
  amountMismatch: {
    iconBg: 'bg-red-50',
    iconFg: 'text-red-600',
    icon: <AlertTriangle size={16} />,
    color: '#EF4444',
  },
  duplicatePayment: {
    iconBg: 'bg-orange-50',
    iconFg: 'text-orange-600',
    icon: <Copy size={16} />,
    color: '#F97316',
  },
  paymentWithoutCharge: {
    iconBg: 'bg-red-50',
    iconFg: 'text-red-600',
    icon: <Ban size={16} />,
    color: '#EF4444',
  },
}

interface DashboardAlertsProps {
  alerts: DashboardAlert[]
}

export function DashboardAlerts({ alerts }: DashboardAlertsProps) {
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">Alertas</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {alerts.map((a) => {
          const s = alertStyle[a.type]
          const viewTo = `/reconciliations?status=${encodeURIComponent(a.routeStatus)}`

          return (
            <div key={a.type} className="border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${s.iconBg} flex items-center justify-center border border-gray-700`}>
                    <div className={s.iconFg}>{s.icon}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-50">{a.count.toLocaleString('pt-BR')}</div>
                    <div className="text-sm text-gray-300 truncate">{a.description}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">{timeAgo(a.lastDetectedAt)}</div>

                <Link
                  to={viewTo}
                  className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-gray-200 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Ver detalhes
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

