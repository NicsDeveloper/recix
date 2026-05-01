import { Link } from 'react-router-dom'
import { Calendar, Zap } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface DashboardHeaderProps {
  title: string
  subtitle: string
  fromDate: string
  toDate: string
  updatedAt: string | null | undefined
  onFromDateChange: (v: string) => void
  onToDateChange:   (v: string) => void
}

function timeAgo(updatedAt: string | null | undefined) {
  if (!updatedAt) return null
  const t = new Date(updatedAt).getTime()
  if (Number.isNaN(t)) return null
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (diffSec < 60) return `Atualizado há ${diffSec}s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Atualizado há ${diffMin} min`
  return `Atualizado há ${Math.floor(diffMin / 60)}h`
}

function fmtDateBr(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function DashboardHeader({
  title, subtitle, fromDate, toDate, updatedAt,
  onFromDateChange, onToDateChange,
}: DashboardHeaderProps) {
  const { currentOrg } = useAuth()
  const isAdmin = currentOrg?.role === 'Owner' || currentOrg?.role === 'Admin'
  const ago = timeAgo(updatedAt)

  return (
    <div className="flex items-start justify-between gap-6 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-50 leading-tight">{title}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Date range picker */}
        <div className="relative flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 hover:border-gray-600 transition-colors cursor-pointer group">
          <Calendar size={14} className="text-gray-400 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={fromDate}
                onChange={e => onFromDateChange(e.target.value)}
                className="bg-transparent text-sm text-gray-200 focus:outline-none w-[100px] cursor-pointer"
              />
              <span className="text-gray-500 text-sm">-</span>
              <input
                type="date"
                value={toDate}
                onChange={e => onToDateChange(e.target.value)}
                className="bg-transparent text-sm text-gray-200 focus:outline-none w-[100px] cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-gray-600 leading-none mt-0.5">
              {fmtDateBr(fromDate)} - {fmtDateBr(toDate)} · Período personalizado
            </p>
          </div>
        </div>

        {/* Last updated */}
        {ago && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {ago}
          </div>
        )}

        {/* Simulate event */}
        {isAdmin && (
          <Link
            to="/webhooks/simulator"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors whitespace-nowrap shadow-lg shadow-indigo-500/20"
          >
            <Zap size={14} />
            Simular Evento
          </Link>
        )}
      </div>
    </div>
  )
}
