import { Link } from 'react-router-dom'

interface DashboardHeaderProps {
  title: string
  subtitle: string
  fromDate: string // yyyy-MM-dd
  toDate: string // yyyy-MM-dd
  updatedAt: string | null | undefined
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
}

function timeAgo(updatedAt: string | null | undefined) {
  if (!updatedAt) return 'Atualizado há —'
  const t = new Date(updatedAt).getTime()
  if (Number.isNaN(t)) return 'Atualizado há —'

  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (diffSec < 60) return `Atualizado há ${diffSec}s`

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Atualizado há ${diffMin}min`

  const diffHr = Math.floor(diffMin / 60)
  return `Atualizado há ${diffHr}h`
}

export function DashboardHeader({
  title,
  subtitle,
  fromDate,
  toDate,
  updatedAt,
  onFromDateChange,
  onToDateChange,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 gap-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-gray-50 leading-tight">{title}</h1>
        <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-50 focus:outline-none focus:border-green-400"
            aria-label="Data inicial"
          />
          <span className="text-gray-400 text-sm">-</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-50 focus:outline-none focus:border-green-400"
            aria-label="Data final"
          />
        </div>

        <div className="text-sm text-gray-400 whitespace-nowrap">{timeAgo(updatedAt)}</div>

        <Link
          to="/webhooks/simulator"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors whitespace-nowrap"
        >
          Simular Evento
        </Link>
      </div>
    </div>
  )
}

